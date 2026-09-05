import { pointToBoxDistance } from "@tscircuit/math-utils"
import type {
  EnclosureBoardComponent,
  EnclosureBoardInput,
  ResolvedEnclosureInput,
} from "../../enclosure/types"
import type { FdmDesignRules } from "../design-rules"
import type {
  FdmDesignRuleViolation,
  ResolvedFdmEnclosureDimensions,
  ResolvedFdmMount,
} from "../types"

/**
 * Distance from a mount axis to a part, in millimetres, or `undefined` when
 * nothing supplied bounds it.
 *
 * **The two envelopes a part supplies are in different frames, and cannot be
 * combined into one box.**
 *
 * - `size` is the body in the part's own, unrotated frame, so the rectangle it
 *   actually occupies is found by rotating the axis into that frame -- exact,
 *   including for a part turned 45 degrees.
 * - `footprint` is already an axis-aligned *board-frame* box measured across the
 *   pads. Its orientation has been projected away, so there is nothing to
 *   un-rotate it back to.
 *
 * Each is therefore tested in the frame it is stated in, and the nearer answer
 * wins. "Neither alone bounds the part" is a statement about the part -- a
 * connector shell overhangs its pads, a pad fan reaches past the shell -- not
 * licence to `Math.max` two numbers that mean different things. Doing that read
 * a board-frame width as a part-frame one: for a 20x2mm connector rotated 90
 * degrees, the box came out 20mm wide along the axis the boss approached from
 * when the part is 2mm wide there, and the boss driven straight through it
 * reported nothing. That is a false negative on the one finding this check
 * exists to raise.
 */
const getAxisToComponentDistanceMm = (
  component: EnclosureBoardComponent,
  /** Mount axis relative to the part's centre, in board-frame millimetres. */
  axisFromComponentCenter: { x: number; y: number },
): number | undefined => {
  const { size, footprint, rotation } = component.body
  const distancesMm: number[] = []

  if (size && size.x > 0 && size.y > 0) {
    const turn = ((rotation ?? 0) * Math.PI) / 180
    const axisInPartFrame = {
      x:
        axisFromComponentCenter.x * Math.cos(-turn) -
        axisFromComponentCenter.y * Math.sin(-turn),
      y:
        axisFromComponentCenter.x * Math.sin(-turn) +
        axisFromComponentCenter.y * Math.cos(-turn),
    }
    distancesMm.push(
      pointToBoxDistance(axisInPartFrame, {
        center: { x: 0, y: 0 },
        width: size.x,
        height: size.y,
      }),
    )
  }

  if (footprint && footprint.width > 0 && footprint.height > 0) {
    distancesMm.push(
      pointToBoxDistance(axisFromComponentCenter, {
        center: { x: 0, y: 0 },
        width: footprint.width,
        height: footprint.height,
      }),
    )
  }

  return distancesMm.length ? Math.min(...distancesMm) : undefined
}

/**
 * How far a part reaches off the board face it is mounted on, or `undefined`
 * when nothing supplied says.
 *
 * `aboveBoardHeight` is the honest number -- derived from measured model bounds
 * about the board surface -- and `size.z` is the fallback for parts that were
 * never measured. `size.z` spans pins and any through-board shell, so it
 * over-reports, which for a clearance check errs towards reporting.
 *
 * Deliberately not defaulted to zero. A part of unknown height is not a part of
 * no height, and treating it as flat is how a clearance check ends up silently
 * passing everything: today most `cad_component` records carry neither field, so
 * a zero default would skip every component ever supplied.
 */
const getComponentReachMm = (
  component: EnclosureBoardComponent,
): number | undefined =>
  component.body.aboveBoardHeight ?? component.body.size?.z

/**
 * Checks that mounting features leave room for the parts on the board.
 *
 * A floor boss stands between the inside floor and the underside of the board,
 * which is exactly the space a bottom-side part occupies; a lid column runs from
 * the board's top face to the lid, which is where top-side parts are. So each
 * kind of column can only ever foul parts on the side of the board it reaches,
 * and a part on the far side is not its business.
 *
 * Interference here is an error, not a judgement: the board cannot seat. The
 * fix is to move the mount or the part, and neither is something this package
 * can choose.
 */
export const checkComponentClearance = ({
  components,
  mounts,
  board,
  dimensions,
  rules,
}: {
  components: ResolvedEnclosureInput["components"]
  mounts: ResolvedFdmMount[]
  board: EnclosureBoardInput
  dimensions: ResolvedFdmEnclosureDimensions
  rules: FdmDesignRules
}): FdmDesignRuleViolation[] => {
  if (!components?.length) return []

  const boardBottomZ = dimensions.floorThickness + dimensions.standoffHeight
  const boardTopZ = boardBottomZ + board.thickness
  const violations: FdmDesignRuleViolation[] = []
  /**
   * Parts that stand where a mounting feature is, whose envelope does not say
   * whether they actually touch it. Collected rather than reported inline so a
   * part near several mounts is named once.
   */
  const unmeasuredComponentIds = new Set<string>()

  for (const mount of mounts) {
    const columns: Array<{
      label: string
      radiusMm: number
      /** The board face this column reaches parts on. */
      side: "top" | "bottom"
      /** How far past that face it reaches. */
      reachMm: number
    }> = [
      {
        label: "screw boss",
        radiusMm: mount.bossDiameterMm / 2,
        side: "bottom",
        reachMm: boardBottomZ - mount.bossBottomZ,
      },
    ]
    if (mount.lidColumn) {
      columns.push({
        label: "lid column",
        radiusMm: mount.lidColumn.diameterMm / 2,
        side: "top",
        reachMm: mount.lidColumn.topZ - boardTopZ,
      })
    }

    for (const component of components) {
      const componentSide = component.boardSide ?? "top"
      const distanceMm = getAxisToComponentDistanceMm(component, {
        x: mount.center.x - component.center.x,
        y: mount.center.y - component.center.y,
      })
      if (distanceMm === undefined) {
        unmeasuredComponentIds.add(component.id)
        continue
      }

      for (const column of columns) {
        if (column.side !== componentSide) continue

        const clearanceMm = distanceMm - column.radiusMm

        // Clear of each other in plan, so how tall either one is cannot matter.
        if (clearanceMm >= rules.minComponentClearanceMm) continue

        // Only now does the height decide the answer, which is the one place
        // worth saying that we do not have it.
        const componentReachMm = getComponentReachMm(component)
        if (componentReachMm === undefined) {
          unmeasuredComponentIds.add(component.id)
          continue
        }
        // Neither reaches far enough off the board to be in the other's way.
        if (
          Math.min(column.reachMm, componentReachMm) <=
          rules.minComponentClearanceMm
        )
          continue

        violations.push({
          rule: "component_clearance",
          severity: clearanceMm > 0 ? "warning" : "error",
          measuredMm: clearanceMm,
          limitMm: rules.minComponentClearanceMm,
          mountId: mount.mount.id,
          componentId: component.id,
          message:
            clearanceMm > 0
              ? `The ${column.label} of mount "${mount.mount.id}" passes ${clearanceMm.toFixed(2)}mm from "${component.id}", closer than the ${rules.minComponentClearanceMm}mm this profile allows.`
              : `The ${column.label} of mount "${mount.mount.id}" runs through "${component.id}" on the ${componentSide} of the board. The board cannot seat: move the mount or the part.`,
        })
      }
    }
  }

  for (const componentId of unmeasuredComponentIds) {
    violations.push({
      rule: "component_bounds_unknown",
      // Not an error: the design may well be fine. What is certain is that this
      // check did not decide, and a check that stays silent about that is worse
      // than no check, because it reads as a pass.
      severity: "warning",
      measuredMm: Number.NaN,
      limitMm: rules.minComponentClearanceMm,
      componentId,
      message: `"${componentId}" stands where a mounting feature does, but its supplied envelope does not give the extent needed to tell whether they touch. Supply the part's body size, or its height above the board.`,
    })
  }

  return violations
}
