import { expect, test } from "bun:test"
import { measurements } from "@jscad/modeling"
import { createApertureCutoutPlan } from "../lib/apertures/create-aperture-cutout-plan"
import { resolveFdmEnclosureProblem } from "../lib"
import type { EnclosureFace } from "../lib"
import { executeApertureTestSolid } from "./fixtures/execute-aperture-solid"

const planFor = (face: EnclosureFace, rotation: number) =>
  createApertureCutoutPlan({
    faceThickness: 2,
    booleanTolerance: 0.5,
    placement: {
      face,
      center: { x: 0, y: 0, z: 0 },
      width: 10,
      height: 4,
      inwardProjection: 0,
      rotation,
      aperture: {
        shape: "rect",
        face,
        width: 10,
        height: 4,
        center: { x: 0, y: 0 },
      },
    },
  }).jscadPlan

// A part on the lid or the floor can sit at any rotation on the board, so its
// opening has to turn with it. Otherwise a rotated rectangular connector gets a
// cutout still squared to board X/Y, and the part fouls its own hole.
test("a horizontal aperture turns with the part", () => {
  const unrotated = measurements.measureDimensions(
    executeApertureTestSolid(planFor("z_pos", 0)),
  )
  const rotated = measurements.measureDimensions(
    executeApertureTestSolid(planFor("z_pos", 30)),
  )
  expect(unrotated).toEqual([10, 4, 3])
  expect(rotated[0]).toBeCloseTo(10.660254037844386, 9)
  expect(rotated[1]).toBeCloseTo(8.464101615137754, 9)
  expect(rotated[2]).toBeCloseTo(3, 9)
})

test("the floor turns the same way as the lid", () => {
  const lid = planFor("z_pos", 45)
  const floor = planFor("z_neg", 45)
  expect(floor).toEqual(lid)
})

// A board rotation is about Z, so the part of it that rolls an opening is its
// component about the face normal: 1 where the normal is Z, and exactly 0 on the
// side walls, whose normals lie in the board plane. The part's rotation is still
// accounted for on a side wall -- one stage earlier, where it rotates the
// footprint's insertion direction to pick which wall the aperture belongs in.
test("a side wall has no roll to apply", () => {
  const resolved = resolveFdmEnclosureProblem({
    board: { width: 40, height: 24, thickness: 1.6 },
    apertures: [
      {
        shape: "rect",
        face: "y_pos",
        width: 6,
        height: 3,
        center: { x: 0, y: 0 },
        rotation: 30,
      },
      {
        shape: "rect",
        face: "z_pos",
        width: 6,
        height: 3,
        center: { x: 0, y: 0 },
        rotation: 30,
      },
    ],
  })

  expect(resolved.apertures[0]!.rotation).toBe(0)
  expect(resolved.apertures[1]!.rotation).toBe(30)
})
