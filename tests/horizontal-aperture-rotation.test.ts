import { expect, test } from "bun:test"
import { createApertureCutoutPlan } from "../lib/apertures/create-aperture-cutout-plan"
import { resolveFdmEnclosureProblem } from "../lib"
import type { EnclosureFace } from "../lib"

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

const rotationsIn = (plan: any): number[][] => {
  const found: number[][] = []
  const walk = (node: any) => {
    if (!node || typeof node !== "object") return
    if (node.type === "rotate") found.push(node.angles)
    for (const key of ["shape", "shapes"]) {
      const child = node[key]
      if (Array.isArray(child)) child.forEach(walk)
      else walk(child)
    }
  }
  walk(plan)
  return found
}

// A part on the lid or the floor can sit at any rotation on the board, so its
// opening has to turn with it. Otherwise a rotated rectangular connector gets a
// cutout still squared to board X/Y, and the part fouls its own hole.
test("a horizontal aperture turns with the part", () => {
  const unrotated = rotationsIn(planFor("z_pos", 0))
  const rotated = rotationsIn(planFor("z_pos", 30))

  // A horizontal face needs no rotation onto the face, so the roll is the only
  // rotation in the plan.
  expect(unrotated).toEqual([])
  expect(rotated).toHaveLength(1)
  expect(rotated[0]![0]).toBeCloseTo(0, 9)
  expect(rotated[0]![1]).toBeCloseTo(0, 9)
  expect(rotated[0]![2]).toBeCloseTo((30 * Math.PI) / 180, 9)
})

test("the floor turns the same way as the lid", () => {
  const lid = rotationsIn(planFor("z_pos", 45))
  const floor = rotationsIn(planFor("z_neg", 45))
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
