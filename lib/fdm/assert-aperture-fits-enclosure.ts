import {
  type Axis,
  type EnclosureFace,
  getEnclosureSpanAlongAxis,
  getFaceTangentAxes,
} from "../enclosure"
import { formatMm } from "../validation/format-mm"
import type { ResolvedFdmEnclosureDimensions } from "./types"

/**
 * Check that a placed aperture is actually on the enclosure.
 *
 * The two checks below are one rule and one exception, expressed over the
 * face's tangent axes rather than over the six faces:
 *
 * - on any tangent axis the box is symmetric in, the opening must stay within
 *   the outer span. The bound is the OUTER footprint, not the cavity: an
 *   opening is allowed to run off its own face and into the wall beside it,
 *   which is how a part in a corner gets out (see `depth`). Only an
 *   opening that leaves the box altogether is an error.
 * - **Z is the exception**, because the box is not symmetric in Z: there is a
 *   floor at the bottom and nothing at the top. It gets its own rules below.
 *
 * The first tangent axis is never Z and the second is Z exactly on the four
 * side faces, so this reduces to the horizontal faces being checked in both of
 * their axes and the side faces being checked along the wall and in height.
 */
const assertWithinOuterSpan = ({
  axis,
  offset,
  extent,
  dimensions,
  face,
  prefix,
}: {
  axis: Axis
  offset: number
  extent: number
  dimensions: ResolvedFdmEnclosureDimensions
  face: EnclosureFace
  prefix: string
}): void => {
  const limit = getEnclosureSpanAlongAxis(dimensions, axis) / 2
  const halfExtent = extent / 2
  const openingMin = offset - halfExtent
  const openingMax = offset + halfExtent
  const spanDescription =
    `the opening spans ${formatMm(openingMin)} to ${formatMm(openingMax)} ` +
    `but the enclosure only spans ${formatMm(-limit)} to ${formatMm(limit)}`

  // Partial overlap is intentional at a corner: global subtraction then
  // relieves the neighbouring wall too. Reject when the complete projected
  // profile lies beyond the enclosure and therefore cuts nothing.
  if (Math.abs(offset) - halfExtent > limit) {
    throw new Error(
      `${prefix} misses the ${face} face along ${axis.toUpperCase()}: ${spanDescription}`,
    )
  }

  // The opposite extreme is invalid too. A profile wider than the entire box
  // can consume every bit of a lid or split a shell into disconnected pieces;
  // accepting it as merely "overlapping" returns an empty printed part without
  // any diagnostic. Exact edge-to-edge fit remains allowed.
  if (halfExtent - Math.abs(offset) > limit) {
    throw new Error(
      `${prefix} engulfs the ${face} face along ${axis.toUpperCase()}: ${spanDescription}`,
    )
  }
}

/**
 * Z is bounded below and open above.
 *
 * Downward the floor is hard: an opening that reaches into it would breach the
 * bottom of the box. Upward there is no bound at all -- an opening may run past
 * the top of a deliberately short enclosure so a tall part can poke out, and may
 * straddle the base/lid seam, which is what lets one connector be cut from the
 * base wall, the lid plate and the lid lip at once. Only an opening whose lowest
 * edge is already above the box has missed it entirely.
 */
const assertVerticalFit = ({
  centerZ,
  extent,
  dimensions,
  prefix,
}: {
  centerZ: number
  extent: number
  dimensions: ResolvedFdmEnclosureDimensions
  prefix: string
}): void => {
  const lowestEdge = centerZ - extent / 2
  if (lowestEdge < dimensions.floorThickness) {
    throw new Error(
      `${prefix} intersects the enclosure floor: its lowest edge is at ` +
        `${formatMm(lowestEdge)} but the floor top is at ${formatMm(
          dimensions.floorThickness,
        )}. Raise heightDimensionOffset, or reduce the opening height.`,
    )
  }
  if (lowestEdge > dimensions.depth) {
    throw new Error(
      `${prefix} sits entirely above the enclosure: its lowest edge is at ` +
        `${formatMm(lowestEdge)} but the enclosure is only ${formatMm(
          dimensions.depth,
        )} tall`,
    )
  }
}

export const assertApertureFitsEnclosure = ({
  face,
  center,
  width,
  height,
  dimensions,
  prefix,
}: {
  face: EnclosureFace
  /** Already projected onto the face plane. */
  center: { x: number; y: number; z: number }
  /** Margin-inflated opening size across the first tangent axis. */
  width: number
  /** Margin-inflated opening size across the second tangent axis. */
  height: number
  dimensions: ResolvedFdmEnclosureDimensions
  /** Caller-facing path of the aperture, e.g. `apertures[2]`. */
  prefix: string
}): void => {
  const tangentAxes = getFaceTangentAxes(face)
  const extents: [number, number] = [width, height]

  tangentAxes.forEach((axis, index) => {
    const extent = extents[index]!
    if (axis === "z") {
      assertVerticalFit({ centerZ: center.z, extent, dimensions, prefix })
      return
    }
    assertWithinOuterSpan({
      axis,
      offset: axis === "x" ? center.x : center.y,
      extent,
      dimensions,
      face,
      prefix,
    })
  })
}
