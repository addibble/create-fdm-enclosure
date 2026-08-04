import type { JscadOperation } from "jscad-planner"
import {
  type EnclosureFace,
  getAxisIndex,
  getFaceNormalAxis,
  getFaceNormalSign,
  type ResolvedEnclosureAperture,
  type ResolvedEnclosureAperturePlacement,
} from "../enclosure"

const cuboid = (size: [number, number, number]): JscadOperation => ({
  type: "cuboid",
  size,
})

const cylinder = (radius: number, height: number): JscadOperation => ({
  type: "cylinder",
  radius,
  height,
  resolution: 32,
})

const translate = (
  vector: [number, number, number],
  shape: JscadOperation,
): JscadOperation => ({ type: "translate", vector, shape })

/**
 * Rotation taking the face-local frame onto the world, keyed by the face's
 * normal axis. Every cutting tool in this file is authored in that local frame:
 *
 * - local **X** is `width`
 * - local **Y** is `height`
 * - local **Z** is the cut depth, running along the face normal
 *
 * so a tool is built once, in two dimensions, without knowing which face it is
 * for, and is turned onto that face exactly once. The rotations realize the
 * axis table in the README:
 *
 * | Face | width | height | depth |
 * |---|---|---|---|
 * | `x_pos`, `x_neg` | Y | Z | X |
 * | `y_pos`, `y_neg` | X | Z | Y |
 * | `z_pos`, `z_neg` | X | Y | Z |
 *
 * The x-normal entry is a two-angle rotation, not the single quarter turn about
 * Y that merely points local Z at X. That simpler turn leaves width on Z and
 * height on Y -- the table's two tangent axes swapped. The extra roll is what
 * puts them back. It went unnoticed while this rotation was used only on
 * cylinders, which are symmetric about the axis being rolled.
 *
 * Faces normal to Z need no rotation onto the face, so a lid tool stays a plain
 * primitive in the plan -- apart from any in-face roll, which is the only
 * rotation a horizontal aperture ever carries.
 */
const FACE_LOCAL_ROTATION: Record<"x" | "y", [number, number, number]> = {
  x: [Math.PI / 2, 0, Math.PI / 2],
  y: [Math.PI / 2, 0, 0],
}

const rotateForFace = (
  face: EnclosureFace,
  shape: JscadOperation,
): JscadOperation => {
  const axis = getFaceNormalAxis(face)
  if (axis === "z") return shape
  return { type: "rotate", angles: FACE_LOCAL_ROTATION[axis], shape }
}

/**
 * The tools below are all face-local and symmetric about local Z, so a face's
 * normal SIGN never reaches them: `left` and `right` take the same prism, and
 * only the placement of its midpoint differs.
 */
const createRectCutout = ({
  width,
  height,
  cutDepth,
}: {
  width: number
  height: number
  cutDepth: number
}): JscadOperation => cuboid([width, height, cutDepth])

const createCircleCutout = ({
  diameter,
  cutDepth,
}: {
  diameter: number
  cutDepth: number
}): JscadOperation => cylinder(diameter / 2, cutDepth)

const createPillCutout = ({
  width,
  height,
  cutDepth,
}: {
  width: number
  height: number
  cutDepth: number
}): JscadOperation => {
  if (Math.abs(width - height) < Number.EPSILON) {
    return createCircleCutout({ diameter: width, cutDepth })
  }

  const isHorizontal = width > height
  const radius = Math.min(width, height) / 2
  const centerLength = Math.abs(width - height)
  const center = createRectCutout({
    width: isHorizontal ? centerLength : width,
    height: isHorizontal ? height : centerLength,
    cutDepth,
  })
  const end = createCircleCutout({ diameter: radius * 2, cutDepth })
  // Step the rounded ends along whichever tangent axis the pill is long in.
  const offsetVector = (distance: number): [number, number, number] =>
    isHorizontal ? [distance, 0, 0] : [0, distance, 0]

  return {
    type: "union",
    shapes: [
      center,
      translate(offsetVector(-centerLength / 2), end),
      translate(offsetVector(centerLength / 2), end),
    ],
  }
}

/**
 * Builds the complete through-face subtraction for one already-resolved
 * aperture. Shape, clearance, and face orientation live with the aperture rather
 * than in the enclosure-shell planner; placement is read from the resolved
 * problem and never re-derived here.
 */
export const createApertureCutoutPlan = ({
  placement,
  faceThickness,
  booleanTolerance,
}: {
  placement: ResolvedEnclosureAperturePlacement
  /**
   * Thickness of the material this face is made of -- a side wall, the lid top
   * plate, or the base floor. The construction layer decides which.
   */
  faceThickness: number
  /** Slop so the tool breaks cleanly through both surfaces of the face. */
  booleanTolerance: number
}): ResolvedEnclosureAperture => {
  const { aperture, face, center, width, height, inwardProjection } = placement
  // The tool over-extends past BOTH surfaces of the face so the boolean breaks
  // through cleanly, and continues `inwardProjection` further inboard so nothing
  // inside the enclosure (notably the lid lip) is left blocking the part.
  const cutDepth = faceThickness + booleanTolerance * 2 + inwardProjection

  let localShape: JscadOperation
  switch (aperture.shape) {
    case "rect":
      localShape = createRectCutout({ width, height, cutDepth })
      break
    case "circle":
      localShape = createCircleCutout({ diameter: width, cutDepth })
      break
    case "pill":
      localShape = createPillCutout({ width, height, cutDepth })
      break
  }

  // Growing the tool inboard has to move its midpoint inboard by half the
  // growth, or the extra depth would poke out of the OUTSIDE of the face
  // instead.
  // A part on the lid or the floor can be placed at any rotation, so its opening
  // turns with it. This is a roll about the face normal, applied in the
  // face-local frame before the tool is turned onto its face -- which for a
  // horizontal face is the only rotation there is. The resolver zeroes this on
  // side faces, whose openings are fixed by the wall.
  const orientedShape =
    placement.rotation === 0
      ? localShape
      : {
          type: "rotate" as const,
          angles: [0, 0, (placement.rotation * Math.PI) / 180] as [
            number,
            number,
            number,
          ],
          shape: localShape,
        }

  const normalAxis = getFaceNormalAxis(face)
  const inwardShift = (-getFaceNormalSign(face) * inwardProjection) / 2
  const origin: [number, number, number] = [center.x, center.y, center.z]
  origin[getAxisIndex(normalAxis)] += inwardShift

  return {
    aperture,
    width,
    height,
    cutDepth,
    jscadPlan: translate(origin, rotateForFace(face, orientedShape)),
  }
}
