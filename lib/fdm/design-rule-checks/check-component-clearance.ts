import * as jscad from "@jscad/modeling"
import { pointToBoxDistance } from "@tscircuit/math-utils"
import { mat4, vec3 } from "gl-matrix"
import type {
  EnclosureBoardInput,
  ResolvedEnclosureAperture,
} from "../../enclosure/types"
import type { FdmDesignRules } from "../design-rules"
import { createFdmComponentBodyPlan } from "../create-component-body-plan"
import { createMountFeaturePlans } from "../create-mount-feature-plans"
import { executeFdmSolid, fdmSolidsIntersect } from "../execute-solid"
import { getFdmSolidAxisDistanceMm } from "../solid-axis-distance"
import type {
  FdmBoardComponent,
  FdmDesignRuleViolation,
  ResolvedFdmEnclosureDimensions,
  ResolvedFdmMount,
} from "../types"

/** Used only when missing height prevents constructing even a conservative solid. */
const planarDistance = (
  component: FdmBoardComponent,
  mount: ResolvedFdmMount,
): number | undefined => {
  const { size, footprint, rotation = 0 } = component.body
  const axis = [
    mount.center.x - component.center.x,
    mount.center.y - component.center.y,
    0,
  ]
  const distances: number[] = []
  if (size) {
    const local = vec3.transformMat4(
      vec3.create(),
      axis,
      mat4.fromZRotation(mat4.create(), (-rotation * Math.PI) / 180),
    )
    distances.push(
      pointToBoxDistance(
        { x: local[0], y: local[1] },
        {
          center: { x: 0, y: 0 },
          width: size.x,
          height: size.y,
        },
      ),
    )
  }
  if (footprint) {
    distances.push(
      pointToBoxDistance(
        { x: axis[0]!, y: axis[1]! },
        {
          center: { x: 0, y: 0 },
          width: footprint.width,
          height: footprint.height,
        },
      ),
    )
  }
  return distances.length ? Math.min(...distances) : undefined
}

export const checkComponentClearance = ({
  components,
  mounts,
  board,
  dimensions,
  rules,
  apertures = [],
}: {
  components: FdmBoardComponent[] | undefined
  mounts: ResolvedFdmMount[]
  board: EnclosureBoardInput
  dimensions: ResolvedFdmEnclosureDimensions
  rules: FdmDesignRules
  apertures?: ResolvedEnclosureAperture[]
}): FdmDesignRuleViolation[] => {
  if (!components?.length || mounts.length === 0) return []
  const boardBottomZ = dimensions.floorThickness + dimensions.standoffHeight
  const bodies = components.map((component) => {
    const body = createFdmComponentBodyPlan({
      component,
      boardThicknessMm: board.thickness,
      boardBottomZ,
    })
    return { component, body, solid: body && executeFdmSolid(body.jscadPlan) }
  })
  const violations: FdmDesignRuleViolation[] = []
  const unknownIds = new Set<string>()
  for (const mount of mounts) {
    const plans = createMountFeaturePlans({
      mount,
      rules,
      lidThicknessMm: dimensions.lidThickness,
      totalHeightMm: dimensions.depth,
    })
    const columns = [
      {
        label: "screw boss",
        side: "bottom",
        radius: mount.bossDiameterMm / 2,
        adds: plans.baseAdds,
        cuts: plans.baseSubtracts,
      },
      {
        label: "lid column",
        side: "top",
        radius: (mount.lidColumn?.diameterMm ?? 0) / 2,
        adds: plans.lidAdds,
        cuts: plans.lidSubtracts,
      },
    ] as const
    for (const column of columns) {
      if (column.adds.length === 0) continue
      const solid = executeFdmSolid({
        type: "subtract",
        shapes: [
          { type: "union", shapes: column.adds },
          ...column.cuts,
          ...apertures.map(({ jscadPlan }) => jscadPlan),
        ],
      })
      let clearanceSolid: typeof solid | undefined
      for (const { component, body, solid: componentSolid } of bodies) {
        if (!componentSolid) {
          if ((component.boardSide ?? "top") !== column.side) continue
          const distance = planarDistance(component, mount)
          if (
            distance === undefined ||
            distance - column.radius < rules.minComponentClearanceMm
          )
            unknownIds.add(component.id)
          continue
        }
        if (
          jscad.geometries.geom3.toPolygons(componentSolid).length === 0 ||
          jscad.geometries.geom3.toPolygons(solid).length === 0
        )
          continue
        const intersects = fdmSolidsIntersect(solid, componentSolid)
        if (!intersects) {
          if (rules.minComponentClearanceMm <= 0) continue
          // A true projection of the solid gives a cheap distance lower bound,
          // unlike its AABB (which includes empty corners of nonconvex parts).
          if (
            getFdmSolidAxisDistanceMm(componentSolid, mount.center) -
              column.radius >=
            rules.minComponentClearanceMm
          )
            continue
          const [aMin, aMax] = jscad.measurements.measureBoundingBox(solid)
          const [bMin, bMax] =
            jscad.measurements.measureBoundingBox(componentSolid)
          if (
            [0, 1, 2].some(
              (axis) =>
                aMax[axis]! + rules.minComponentClearanceMm <= bMin[axis]! ||
                bMax[axis]! + rules.minComponentClearanceMm <= aMin[axis]!,
            )
          )
            continue
          if (
            jscad.geometries.geom3.toPolygons(componentSolid).length <
            jscad.geometries.geom3.toPolygons(solid).length
          ) {
            const expandedBody = jscad.expansions.expand(
              {
                delta: rules.minComponentClearanceMm,
                corners: "round",
                segments: 16,
              },
              componentSolid,
            )
            if (!fdmSolidsIntersect(solid, expandedBody)) continue
          } else {
            clearanceSolid ??= jscad.expansions.expand(
              {
                delta: rules.minComponentClearanceMm,
                corners: "round",
                segments: 16,
              },
              solid,
            )
            if (!fdmSolidsIntersect(clearanceSolid, componentSolid)) continue
          }
        }
        const fallback =
          body!.fidelity === "conservative_box"
            ? " This uses an explicit conservative box envelope, not measured component geometry."
            : ""
        const overlapBounds = intersects
          ? jscad.measurements.measureBoundingBox(
              jscad.booleans.intersect(solid, componentSolid),
            )
          : undefined
        // Negative values report the smallest occupied axial overlap, not an
        // AABB-only collision decision. Positive-clearance distance is unknown.
        const measuredMm = overlapBounds
          ? -Math.min(
              ...overlapBounds[0].map(
                (min, axis) => overlapBounds[1][axis]! - min,
              ),
            )
          : Number.NaN
        violations.push({
          rule: "component_clearance",
          severity: intersects ? "error" : "warning",
          measuredMm,
          limitMm: rules.minComponentClearanceMm,
          mountId: mount.mount.id,
          componentId: component.id,
          message:
            (intersects
              ? `The ${column.label} of mount "${mount.mount.id}" runs through "${component.id}". The board cannot seat: move the mount or the part.`
              : `The ${column.label} of mount "${mount.mount.id}" passes within ${rules.minComponentClearanceMm}mm of "${component.id}".`) +
            fallback,
        })
      }
    }
  }
  for (const componentId of unknownIds) {
    violations.push({
      rule: "component_bounds_unknown",
      severity: "warning",
      measuredMm: Number.NaN,
      limitMm: rules.minComponentClearanceMm,
      componentId,
      message: `"${componentId}" is near a mounting feature, but no native solid or complete conservative envelope is available to decide clearance. Supply body geometry or body size and height.`,
    })
  }
  return violations
}
