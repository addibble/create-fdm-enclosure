import { mat4 } from "gl-matrix"
import type { Matrix4 } from "jscad-planner"

/** Serializable column-major matrix storage, operated on by gl-matrix. */
export const createFdmMatrix = (): Matrix4 => [
  1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
]

/** Place a hardware-owned local datum on the solver-owned assembly target. */
export const getFdmHardwarePlacement = (
  enclosureFromTarget: Matrix4,
  partFromDatum: Matrix4,
) => {
  const datumFromPart = mat4.invert(createFdmMatrix(), partFromDatum)
  if (!datumFromPart) throw new Error("Hardware datum matrix is not invertible")
  const enclosureFromPart = createFdmMatrix()
  mat4.multiply(enclosureFromPart, enclosureFromTarget, datumFromPart)
  return {
    enclosureFromPart,
    // Compatibility boundary for Circuit JSON's current translation DTO.
    position: {
      x: enclosureFromPart[12],
      y: enclosureFromPart[13],
      z: enclosureFromPart[14],
    },
  }
}
