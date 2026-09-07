import {
  assertTransformMatrix,
  type JscadOperation,
  type Matrix4,
} from "jscad-planner"
import { mat4, quat, vec3 } from "gl-matrix"
import {
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
 * Tool-local (X width, Y height, Z depth) to enclosure-local Z-up mm.
 * The matrix maps points; the inward offset follows the rotated outward
 * direction, not the unrotated wall normal. Both frames are right-handed.
 *
 * The face basis preserves the existing planner's Rz(pi/2)*Rx(pi/2) for
 * X-normal faces and Rx(pi/2) for Y-normal faces, pinned by
 * tests/aperture-face-axis-mapping.test.ts. Roll acts before that basis;
 * incidence acts after it, about enclosure Z.
 */
const getApertureToolMatrix = (
  placement: ResolvedEnclosureAperturePlacement,
): Matrix4 => {
  const axis = getFaceNormalAxis(placement.face)
  const sign = getFaceNormalSign(placement.face)
  const face: quat = [0, 0, 0, 1]
  if (axis !== "z") {
    quat.setAxisAngle(face, [1, 0, 0], Math.PI / 2)
    if (axis === "x") {
      const quarterTurn: quat = [0, 0, 0, 1]
      quat.setAxisAngle(quarterTurn, [0, 0, 1], Math.PI / 2)
      quat.multiply(face, quarterTurn, face)
    }
  }
  const roll: quat = [0, 0, 0, 1]
  quat.setAxisAngle(roll, [0, 0, 1], (placement.rotation * Math.PI) / 180)
  const incidence: quat = [0, 0, 0, 1]
  quat.setAxisAngle(
    incidence,
    [0, 0, 1],
    ((placement.incidenceDegrees ?? 0) * Math.PI) / 180,
  )
  const orientation: quat = [0, 0, 0, 1]
  quat.multiply(orientation, face, roll)
  quat.multiply(orientation, incidence, orientation)

  const outward: vec3 =
    axis === "x" ? [sign, 0, 0] : axis === "y" ? [0, sign, 0] : [0, 0, sign]
  vec3.transformQuat(outward, outward, incidence)
  const midpoint: vec3 = [
    placement.center.x,
    placement.center.y,
    placement.center.z,
  ]
  vec3.scaleAndAdd(midpoint, midpoint, outward, -placement.inwardProjection / 2)
  const matrix = new Array<number>(16).fill(0)
  mat4.fromRotationTranslation(matrix, orientation, midpoint)
  assertTransformMatrix(matrix)
  return matrix
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
  const { aperture, width, height, inwardProjection } = placement
  const incidenceDegrees = placement.incidenceDegrees ?? 0
  const incidence = (incidenceDegrees * Math.PI) / 180
  const cosine = Math.abs(Math.cos(incidence))
  const lean = Math.abs(Math.tan(incidence))

  // Exact axial span of a width-W tool through a thickness-T plate:
  //
  //   (T + 2*tolerance) / cos(incidence) + W*tan(incidence)
  //
  // The first term is the longer path through the plate. The second clears both
  // trailing corners: a square end face is W/2*tan short at each surface. The
  // previous approximation added only one half-corner and did not scale the
  // tolerance, leaving a wall sliver from about 25 degrees onward.
  //
  // `inwardProjection` is added unchanged. It is measured along the part's own
  // mating axis -- now also the tool axis -- so front-to-back component depth
  // stays authored rather than growing merely because the part was rotated.
  const cutDepth =
    (faceThickness + booleanTolerance * 2) / cosine +
    width * lean +
    inwardProjection

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

  return {
    aperture,
    width,
    height,
    cutDepth,
    jscadPlan: {
      type: "transform",
      matrix: getApertureToolMatrix(placement),
      shape: localShape,
    },
  }
}
