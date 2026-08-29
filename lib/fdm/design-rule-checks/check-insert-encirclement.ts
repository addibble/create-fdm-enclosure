import {
  getAxisIndex,
  getFaceNormalAxis,
  getFaceNormalSign,
  getFaceTangentAxes,
} from "../../enclosure/faces"
import type { ResolvedEnclosureAperturePlacement } from "../../enclosure/types"
import type { FdmDesignRules } from "../design-rules"
import type { FdmDesignRuleViolation, ResolvedFdmMount } from "../types"

/** An axis-aligned box, in enclosure-local coordinates. */
interface Box3 {
  min: [number, number, number]
  max: [number, number, number]
}

/**
 * The volume an aperture actually removes, as an axis-aligned box.
 *
 * Derived from the same `center`/`width`/`height`/`inwardProjection` the cutout
 * planner uses, and displaced inboard by half the projection exactly as
 * `createApertureCutoutPlan` displaces its tool -- a check that measured a
 * different box than the one being subtracted would be worse than no check.
 *
 * Where the tool turns (a rotated opening on a horizontal face, an oblique
 * incidence on a side wall) the footprint is expanded to the turned rectangle's
 * bounding box. That is deliberately conservative: a rotation only ever moves
 * material within that bound, so this can report a cut a hair deeper than the
 * exact solid takes, and can never miss one.
 */
const getApertureCutBox = (
  placement: ResolvedEnclosureAperturePlacement,
  cutDepth: number,
): Box3 => {
  const { face, center, width, height, inwardProjection } = placement
  const normalAxis = getFaceNormalAxis(face)
  const normalSign = getFaceNormalSign(face)
  const [firstTangent, secondTangent] = getFaceTangentAxes(face)

  const halfExtents: [number, number, number] = [0, 0, 0]
  halfExtents[getAxisIndex(normalAxis)] = cutDepth / 2
  halfExtents[getAxisIndex(firstTangent)] = width / 2
  halfExtents[getAxisIndex(secondTangent)] = height / 2

  // Both turns the planner can apply are about world Z, so only the X and Y
  // half-extents change; the Z span is exact either way.
  const turnDegrees =
    normalAxis === "z" ? placement.rotation : (placement.incidenceDegrees ?? 0)
  if (turnDegrees !== 0) {
    const turn = (turnDegrees * Math.PI) / 180
    const cos = Math.abs(Math.cos(turn))
    const sin = Math.abs(Math.sin(turn))
    const [halfX, halfY] = [halfExtents[0], halfExtents[1]]
    halfExtents[0] = halfX * cos + halfY * sin
    halfExtents[1] = halfX * sin + halfY * cos
  }

  const center3: [number, number, number] = [center.x, center.y, center.z]
  center3[getAxisIndex(normalAxis)] -= (normalSign * inwardProjection) / 2

  return {
    min: [
      center3[0] - halfExtents[0],
      center3[1] - halfExtents[1],
      center3[2] - halfExtents[2],
    ],
    max: [
      center3[0] + halfExtents[0],
      center3[1] + halfExtents[1],
      center3[2] + halfExtents[2],
    ],
  }
}

/**
 * How far a cut reaches in past a column's outer surface, towards its axis, or
 * 0 when the two do not meet.
 *
 * Radial penetration specifically, not a general overlap measure: what decides
 * whether the column can still hold a screw is how much of the wall between its
 * outside and its bore survives, and that is measured along the radius.
 */
const getRadialPenetrationMm = (
  column: {
    center: { x: number; y: number }
    radiusMm: number
    bottomZ: number
    topZ: number
  },
  box: Box3,
): number => {
  if (
    Math.min(column.topZ, box.max[2]) - Math.max(column.bottomZ, box.min[2]) <=
    0
  )
    return 0

  // Closest point on the box footprint to the axis, which is what decides
  // whether a round boss and a square opening actually touch. Comparing
  // bounding boxes alone would report a boss that only shares a corner.
  const closestX = Math.min(Math.max(column.center.x, box.min[0]), box.max[0])
  const closestY = Math.min(Math.max(column.center.y, box.min[1]), box.max[1])
  const distance = Math.hypot(
    column.center.x - closestX,
    column.center.y - closestY,
  )
  return distance >= column.radiusMm ? 0 : column.radiusMm - distance
}

/**
 * Checks that a boss still encircles its fastener.
 *
 * Apertures are subtracted after the bosses and lid columns are fused, so an
 * opening that overlaps one removes the material in its way rather than being
 * covered by it. The part fits either way, which is why this is not a
 * resolution failure -- but the column is left thinner than it was designed to
 * be, with nothing in the geometry to say so.
 *
 * The limit is not a new number. A boss is *sized* as `bore + 2 *
 * minInsertWallMm`, and `getMountBossDiameterMm` already refuses an authored
 * `bossDiameter` that leaves less. This applies the identical rule to the boss
 * as built rather than as designed, so a boss deliberately made oversized may
 * lose material down to the same wall and no further.
 */
export const checkInsertEncirclement = ({
  mounts,
  placements,
  cutDepths,
  rules,
}: {
  mounts: ResolvedFdmMount[]
  placements: ResolvedEnclosureAperturePlacement[]
  /** Tool depth per placement, positionally matched, from the cutout planner. */
  cutDepths: number[]
  rules: FdmDesignRules
}): FdmDesignRuleViolation[] => {
  const violations: FdmDesignRuleViolation[] = []

  for (const mount of mounts) {
    const boreRadiusMm = mount.boreDiameterMm / 2
    const columns: Array<{
      label: string
      bottomZ: number
      topZ: number
      radiusMm: number
    }> = [
      {
        label: "screw boss",
        bottomZ: mount.bossBottomZ,
        topZ: mount.bossTopZ,
        radiusMm: mount.bossDiameterMm / 2,
      },
    ]
    if (mount.lidColumn) {
      columns.push({
        label: "lid column",
        bottomZ: mount.lidColumn.bottomZ,
        topZ: mount.lidColumn.topZ,
        radiusMm: mount.lidColumn.diameterMm / 2,
      })
    }

    for (const [apertureIndex, placement] of placements.entries()) {
      const box = getApertureCutBox(placement, cutDepths[apertureIndex] ?? 0)
      for (const column of columns) {
        const penetrationMm = getRadialPenetrationMm(
          { ...column, center: mount.center },
          box,
        )
        if (penetrationMm <= 0) continue

        const remainingWallMm = column.radiusMm - boreRadiusMm - penetrationMm
        if (remainingWallMm >= rules.minInsertWallMm) continue

        violations.push({
          rule: "insert_not_encircled",
          // Past the bore there is no wall left at all: the fastener would be
          // gripping an opening. That is not a design the author can accept by
          // judgement, so it is not a warning.
          severity: remainingWallMm > 0 ? "warning" : "error",
          measuredMm: remainingWallMm,
          limitMm: rules.minInsertWallMm,
          mountId: mount.mount.id,
          apertureIndex,
          face: placement.face,
          message:
            remainingWallMm > 0
              ? `The ${placement.face} aperture cuts ${penetrationMm.toFixed(2)}mm into the ${column.label} of mount "${mount.mount.id}", leaving ${remainingWallMm.toFixed(2)}mm of wall around its bore where the design rules require ${rules.minInsertWallMm}mm.`
              : `The ${placement.face} aperture cuts ${penetrationMm.toFixed(2)}mm into the ${column.label} of mount "${mount.mount.id}", breaking through to its ${mount.boreDiameterMm}mm bore. The fastener has no material to hold it.`,
        })
      }
    }
  }

  return violations
}
