import {
  getFaceNormalAxis,
  getFaceNormalSign,
  isHorizontalFace,
} from "../enclosure"
import type { EnclosureFace } from "../enclosure"

/**
 * Signed angle from a selected wall's outward normal to the part's actual
 * interaction axis, measured counter-clockwise in board XY.
 *
 * Both inputs are directions in the board's right-handed frame (+Z above the
 * board), not points, and carry no translation or units. `face` is the nearest
 * quantized Cartesian choice; `apertureAxisDirection` retains the continuous
 * vector that led to that choice. Measuring one against the other is crucial:
 * recovering a residual from the component's rotation alone loses the
 * footprint's local axis and disagrees with face selection at exactly +/-45
 * degrees, making the cutter lean 90 degrees toward the wrong wall.
 *
 * Zero on horizontal faces. A rotation about board Z is a roll in the lid/floor
 * plane, not an approach angle, and is handled separately as aperture rotation.
 * An absent vector also means zero so low-information adapters retain the
 * historical square-to-wall cut rather than guessing an axis.
 */
export const getApertureIncidenceDegrees = ({
  face,
  apertureAxisDirection,
}: {
  face: EnclosureFace
  apertureAxisDirection?: { x: number; y: number; z: number }
}): number => {
  if (isHorizontalFace(face) || !apertureAxisDirection) return 0

  const normalAxis = getFaceNormalAxis(face)
  const normalSign = getFaceNormalSign(face)
  const normal = {
    x: normalAxis === "x" ? normalSign : 0,
    y: normalAxis === "y" ? normalSign : 0,
  }
  const axisLength = Math.hypot(
    apertureAxisDirection.x,
    apertureAxisDirection.y,
  )
  if (!Number.isFinite(axisLength) || axisLength === 0) {
    throw new Error(
      `apertureAxisDirection must have a finite, non-zero XY projection for side face ${face}`,
    )
  }
  const axis = {
    x: apertureAxisDirection.x / axisLength,
    y: apertureAxisDirection.y / axisLength,
  }

  const cross = normal.x * axis.y - normal.y * axis.x
  const dot = normal.x * axis.x + normal.y * axis.y
  return (Math.atan2(cross, dot) * 180) / Math.PI
}

/**
 * Where the part's mating axis actually crosses the wall, as an offset along the
 * wall from the part's own position.
 *
 * Projecting the part's centre straight onto the wall is only right when it
 * meets the wall square. Leaning by `incidence`, the axis travels
 * `distanceToWall / cos(incidence)` to reach the plane and lands
 * `distanceToWall * tan(incidence)` further along it -- 0.8mm for a part 1.4mm
 * off the wall at 30 degrees, which is most of a 3.5mm jack's radius.
 *
 * Signed along the face's tangent, taken as the outward normal turned 90 degrees
 * counter-clockwise, so the same expression serves all four walls.
 */
export const getObliqueTangentShift = ({
  face,
  incidenceDegrees,
  distanceToWall,
}: {
  face: EnclosureFace
  incidenceDegrees: number
  /** Along the outward normal, from the part's point to the wall's mid-plane. */
  distanceToWall: number
}): number => {
  if (isHorizontalFace(face)) return 0
  const alongTangent =
    distanceToWall * Math.tan((incidenceDegrees * Math.PI) / 180)

  // Tangent = outward normal rotated +90 degrees CCW. For n = +X that is +Y; for
  // n = -X, -Y; for n = +Y, -X; for n = -Y, +X. Only the sign is needed, since
  // the tangent is a board axis either way.
  const normalAxis = getFaceNormalAxis(face)
  const sign = getFaceNormalSign(face)
  const tangentSign = normalAxis === "x" ? sign : -sign
  return alongTangent * tangentSign
}
