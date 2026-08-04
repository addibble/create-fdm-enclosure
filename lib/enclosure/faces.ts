import type { EnclosureFace } from "./types"

export type Axis = "x" | "y" | "z"

export const ENCLOSURE_FACES = [
  "x_pos",
  "x_neg",
  "y_pos",
  "y_neg",
  "z_pos",
  "z_neg",
] as const

/**
 * Whether a value is one of the six faces.
 *
 * Worth having because the retired names fail *quietly* otherwise: the helpers
 * below read the axis and sign off the name, so a stale `"top"` yields axis
 * `"t"` and a negative sign, and the solver goes on to place a malformed side
 * wall rather than throwing. Anything crossing the package boundary as a face
 * should be checked here first.
 */
export const isEnclosureFace = (value: unknown): value is EnclosureFace =>
  typeof value === "string" &&
  (ENCLOSURE_FACES as readonly string[]).includes(value)

export const assertEnclosureFace = (
  value: unknown,
  context = "face",
): EnclosureFace => {
  if (!isEnclosureFace(value)) {
    throw new Error(
      `${context} must be one of ${ENCLOSURE_FACES.join(", ")}, got ${JSON.stringify(value)}. ` +
        "The named directions (front/back/left/right/top/bottom) were retired: " +
        "faces are named for the axis their outward normal points along, so the " +
        "old `top` (+Z) is `z_pos` and the old `front` (+Y) is `y_pos`.",
    )
  }
  return value
}

/**
 * Face names encode their own geometry (`<axis>_<sign>`), so the normal axis and
 * sign are read off the name rather than looked up. A table here could disagree
 * with the names; a projection cannot.
 */

/** The axis an aperture cuts along on each face. */
export const getFaceNormalAxis = (face: EnclosureFace): Axis =>
  face.slice(0, 1) as Axis

/**
 * Which way the face's outward normal points along its axis. `y_pos` is +Y,
 * agreeing with `insertion_direction`, whose `from_top` is the footprint's +Y.
 */
export const getFaceNormalSign = (face: EnclosureFace): 1 | -1 =>
  face.endsWith("_pos") ? 1 : -1

/**
 * The two axes tangent to a face. An aperture center is free in these and
 * pinned to the face plane in the normal axis.
 */
export const getFaceTangentAxes = (face: EnclosureFace): [Axis, Axis] => {
  const normal = getFaceNormalAxis(face)
  if (normal === "x") return ["y", "z"]
  if (normal === "y") return ["x", "z"]
  return ["x", "y"]
}

export const isHorizontalFace = (face: EnclosureFace): boolean =>
  getFaceNormalAxis(face) === "z"

/**
 * Position of an axis in an `[x, y, z]` tuple.
 *
 * Named because the mapping is otherwise written out as a nested ternary at
 * each use, which reads as a decision rather than as the indexing it is.
 */
export const getAxisIndex = (axis: Axis): 0 | 1 | 2 =>
  axis === "x" ? 0 : axis === "y" ? 1 : 2

/**
 * The enclosure's OUTER extent along an axis.
 *
 * `width`/`height`/`depth` name the three spans in the enclosure's own frame,
 * which is a different vocabulary from the face-local `aperture*` dimensions.
 * This is the one place the two meet, so callers can ask "how far does the box
 * go along the axis this face is tangent to" instead of re-deriving it with a
 * face comparison each time.
 */
export const getEnclosureSpanAlongAxis = (
  dimensions: { width: number; height: number; depth: number },
  axis: Axis,
): number =>
  [dimensions.width, dimensions.height, dimensions.depth][getAxisIndex(axis)]!
