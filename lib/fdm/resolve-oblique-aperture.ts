import {
  getFaceNormalAxis,
  getFaceNormalSign,
  isHorizontalFace,
} from "../enclosure"
import type { EnclosureFace } from "../enclosure"

/**
 * How far off square a part meets the wall its opening pierces.
 *
 * A wall is axis-aligned and a part is not: rotate a side-entry connector by 30
 * degrees and it still exits through the same wall -- face selection quantizes
 * to the nearest of four -- but it now meets that wall at 30 degrees rather than
 * head on. The residual after quantization is exactly that angle, so it can be
 * recovered from the part's own rotation without knowing which direction the
 * footprint declared:
 *
 *     -30 deg part  ->  -30 deg incidence (same wall, leaning)
 *     -60 deg part  ->  +30 deg incidence (next wall round, leaning the other way)
 *
 * Always within (-45, 45]: beyond that the next wall is nearer, and face
 * selection has already switched to it.
 *
 * Zero on the horizontal faces. A rotation about Z is a *roll* of an opening in
 * the lid or the floor -- it turns the shape in its own plane and changes
 * nothing about how the part approaches -- which is handled separately.
 */
export const getApertureIncidenceDegrees = ({
  face,
  rotation = 0,
}: {
  face: EnclosureFace
  rotation?: number
}): number => {
  if (isHorizontalFace(face)) return 0
  const wrapped = ((((rotation + 45) % 90) + 90) % 90) - 45
  return wrapped
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
