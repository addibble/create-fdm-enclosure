import { expect, test } from "bun:test"
import * as jscadModeling from "@jscad/modeling"
import { executeJscadOperations } from "jscad-planner"
import { createApertureCutoutPlan, type EnclosureFace } from "../lib"

/**
 * Cutting tools are authored in the face-local frame -- width on local X, height
 * on local Y, depth on local Z -- and rotated onto their face once. This pins
 * down where those three axes actually come to rest in world space, which is the
 * contract the README's axis table states and the one every consumer authoring
 * an `width` is relying on.
 *
 * It is asserted by measuring the executed solid rather than by reading the
 * plan, because the plan can be correct in structure and still wrong in
 * orientation. That is not hypothetical: the rotation used for x-normal faces
 * was for a long time a single quarter turn about Y, which points the depth at X
 * correctly but leaves width and height swapped. Nothing caught it, because it
 * was only ever applied to cylinders, which are symmetric about the axis the
 * error rolls them around.
 */

/** Deliberately three different numbers, so a swap cannot hide. */
const WIDTH = 9
const HEIGHT = 4
const CUT_DEPTH = 3 // faceThickness 2 + 2 * booleanTolerance 0.5

const extentsOf = (face: EnclosureFace): [number, number, number] => {
  const { jscadPlan } = createApertureCutoutPlan({
    faceThickness: 2,
    booleanTolerance: 0.5,
    placement: {
      face,
      center: { x: 0, y: 0, z: 0 },
      width: WIDTH,
      height: HEIGHT,
      inwardProjection: 0,
      rotation: 0,
      aperture: {
        shape: "rect",
        face,
        width: WIDTH,
        height: HEIGHT,
        center: { x: 0, y: 0 },
      },
    },
  })
  const [lo, hi] = jscadModeling.measurements.measureBoundingBox(
    executeJscadOperations(jscadModeling as any, jscadPlan as any) as any,
  ) as [number[], number[]]
  return [hi[0]! - lo[0]!, hi[1]! - lo[1]!, hi[2]! - lo[2]!].map((n) =>
    Number(n.toFixed(6)),
  ) as [number, number, number]
}

test("aperture width, height and depth land on the axes the face dictates", () => {
  // | Face            | width | height | depth |
  // | left, right     | Y     | Z      | X     |
  // | front, back     | X     | Z      | Y     |
  // | top, bottom     | X     | Y      | Z     |
  expect(extentsOf("x_neg")).toEqual([CUT_DEPTH, WIDTH, HEIGHT])
  expect(extentsOf("x_pos")).toEqual([CUT_DEPTH, WIDTH, HEIGHT])
  expect(extentsOf("y_pos")).toEqual([WIDTH, CUT_DEPTH, HEIGHT])
  expect(extentsOf("y_neg")).toEqual([WIDTH, CUT_DEPTH, HEIGHT])
  expect(extentsOf("z_pos")).toEqual([WIDTH, HEIGHT, CUT_DEPTH])
  expect(extentsOf("z_neg")).toEqual([WIDTH, HEIGHT, CUT_DEPTH])

  // On every side face the height is the board-Z dimension. This is the whole
  // reason the dimensions are named for the face rather than for the world.
  for (const face of ["x_neg", "x_pos", "y_pos", "y_neg"] as const) {
    expect(extentsOf(face)[2]).toBe(HEIGHT)
  }
})
