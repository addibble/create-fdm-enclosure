import { geometries } from "@jscad/modeling"
import { mat4 } from "gl-matrix"
import type { JscadOperation } from "jscad-planner"
import type { FdmBoardComponent } from "./types"
import {
  assertFinite,
  assertNonNegative,
  assertPositive,
} from "../validation/assert-number"
import { createFdmMatrix } from "./placement-matrix"

/**
 * Canonical placed body for solid consumers, including DRC. Native geometry
 * is authoritative; footprint/body boxes are an explicitly conservative fallback.
 */
export const createFdmComponentBodyPlan = ({
  component,
  boardThicknessMm,
  boardBottomZ,
}: {
  component: FdmBoardComponent
  boardThicknessMm: number
  boardBottomZ: number
}):
  | { jscadPlan: JscadOperation; fidelity: "native" | "conservative_box" }
  | undefined => {
  const enclosureFromBoard = createFdmMatrix()
  mat4.fromTranslation(enclosureFromBoard, [
    0,
    0,
    boardBottomZ + boardThicknessMm / 2,
  ])
  const place = (shape: JscadOperation): JscadOperation => ({
    type: "transform",
    matrix: enclosureFromBoard,
    shape,
  })
  if (component.solid?.type === "jscad") {
    return { jscadPlan: place(component.solid.jscadPlan), fidelity: "native" }
  }
  if (component.solid?.type === "triangle_mesh") {
    const { positions, indices } = component.solid
    if (
      positions.length % 3 !== 0 ||
      (indices ? indices.length % 3 !== 0 : positions.length % 9 !== 0)
    ) {
      throw new Error(
        `${component.id}: triangle mesh must contain complete XYZ vertices and triangles`,
      )
    }
    positions.forEach((value) =>
      assertFinite(value, `${component.id}.solid.positions`),
    )
    const points: [number, number, number][] = []
    for (let i = 0; i < positions.length; i += 3) {
      points.push([positions[i]!, positions[i + 1]!, positions[i + 2]!])
    }
    const vertexIndices = indices ?? points.map((_, index) => index)
    if (
      vertexIndices.some(
        (index) =>
          !Number.isInteger(index) || index < 0 || index >= points.length,
      )
    ) {
      throw new Error(
        `${component.id}: triangle mesh index is outside the vertex array`,
      )
    }
    const polygons = []
    for (let i = 0; i < vertexIndices.length; i += 3) {
      polygons.push(
        geometries.poly3.create([
          points[vertexIndices[i]!]!,
          points[vertexIndices[i + 1]!]!,
          points[vertexIndices[i + 2]!]!,
        ]),
      )
    }
    return {
      jscadPlan: place({ type: "createGeom3", polygons }),
      fidelity: "native",
    }
  }
  const { size, footprint, rotation = 0 } = component.body
  assertFinite(rotation, `${component.id}.body.rotation`)
  assertFinite(component.center.x, `${component.id}.center.x`)
  assertFinite(component.center.y, `${component.id}.center.y`)
  const reach = component.body.aboveBoardHeight ?? size?.z
  if (reach === undefined || (!size && !footprint)) return undefined
  assertNonNegative(reach, `${component.id}.body.height`)
  if (reach === 0)
    return {
      jscadPlan: place({ type: "createGeom3", polygons: [] }),
      fidelity: "conservative_box",
    }
  const side = component.boardSide === "bottom" ? -1 : 1
  const boardFromBody = createFdmMatrix()
  mat4.fromTranslation(boardFromBody, [
    component.center.x,
    component.center.y,
    (side * (boardThicknessMm + reach)) / 2,
  ])
  const boxes: JscadOperation[] = []
  if (size) {
    assertPositive(size.x, `${component.id}.body.size.x`)
    assertPositive(size.y, `${component.id}.body.size.y`)
    const boardFromRotatedBody = createFdmMatrix()
    mat4.rotateZ(
      boardFromRotatedBody,
      boardFromBody,
      (rotation * Math.PI) / 180,
    )
    boxes.push({
      type: "transform",
      matrix: boardFromRotatedBody,
      shape: { type: "cuboid", size: [size.x, size.y, reach] },
    })
  }
  if (footprint) {
    assertPositive(footprint.width, `${component.id}.body.footprint.width`)
    assertPositive(footprint.height, `${component.id}.body.footprint.height`)
    boxes.push({
      type: "transform",
      matrix: boardFromBody,
      shape: {
        type: "cuboid",
        size: [footprint.width, footprint.height, reach],
      },
    })
  }
  return {
    jscadPlan: place(
      boxes.length === 1 ? boxes[0]! : { type: "union", shapes: boxes },
    ),
    fidelity: "conservative_box",
  }
}
