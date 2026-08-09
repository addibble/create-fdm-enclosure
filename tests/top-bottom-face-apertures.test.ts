import { expect, test } from "bun:test"
import * as jscadModeling from "@jscad/modeling"
import * as geom3 from "@jscad/modeling/src/geometries/geom3"
import { executeJscadOperations } from "jscad-planner"
import { createFdmEnclosure, resolveFdmEnclosureProblem } from "../lib"

const input = {
  board: { width: 40, height: 24, thickness: 1.6 },
  apertures: [
    // A pushbutton stem exiting the lid, centered on the part.
    {
      shape: "circle" as const,
      face: "z_pos" as const,
      radius: 3.3,
      center: { x: 8, y: -4 },
    },
    // A bottom-mounted LED shining out through the floor.
    {
      shape: "circle" as const,
      face: "z_neg" as const,
      radius: 1.6,
      center: { x: -10, y: 5 },
    },
  ],
}

test("horizontal apertures pin to their face plane and keep board X/Y", () => {
  const resolved = resolveFdmEnclosureProblem(input)
  const { dimensions, frame } = resolved

  const [top, bottom] = resolved.apertures
  expect(top!.face).toBe("z_pos")
  expect(top!.center.x).toBe(8)
  expect(top!.center.y).toBe(-4)
  // Through the lid top plate.
  expect(top!.center.z).toBeCloseTo(frame.seamZ + dimensions.lidThickness / 2)

  expect(bottom!.face).toBe("z_neg")
  expect(bottom!.center.x).toBe(-10)
  expect(bottom!.center.y).toBe(5)
  // Through the base floor.
  expect(bottom!.center.z).toBeCloseTo(dimensions.floorThickness / 2)
})

test("a horizontal aperture does not force a taller enclosure", () => {
  // Only side-face apertures can push the depth out; a lid hole is bounded by
  // the plate it pierces.
  const withHoles = resolveFdmEnclosureProblem(input)
  const withoutHoles = resolveFdmEnclosureProblem({
    board: input.board,
  })
  expect(withHoles.dimensions.depth).toBe(withoutHoles.dimensions.depth)
})

test("a top aperture cuts only the lid and a bottom aperture only the base", () => {
  const output = createFdmEnclosure(input)

  const zPlanesOf = (partId: "base" | "lid") => {
    const part = output.parts.find((p) => p.id === partId)!
    const geometry = executeJscadOperations(
      jscadModeling as any,
      part.jscadPlan as any,
    ) as any
    const xs = new Set<number>()
    for (const polygon of geom3.toPolygons(geometry)) {
      for (const vertex of polygon.vertices) {
        xs.add(Math.round(vertex[0] * 100) / 100)
      }
    }
    return xs
  }

  // The lid hole is at x=8, the floor hole at x=-10. Each part should show
  // vertices from its own hole and not the other's.
  const baseXs = zPlanesOf("base")
  const lidXs = zPlanesOf("lid")

  const near = (xs: Set<number>, target: number, tol: number) =>
    [...xs].some((x) => Math.abs(x - target) < tol)

  expect(near(lidXs, 8, 3.5)).toBe(true)
  expect(near(baseXs, -10, 1.7)).toBe(true)
  // The base must not carry the lid's cutout, and vice versa.
  expect(near(baseXs, 8, 3.5)).toBe(false)
  expect(near(lidXs, -10, 1.7)).toBe(false)
})

test("a horizontal aperture must stay on the enclosure", () => {
  // The bound is the outer footprint, not the cavity: an opening is allowed to
  // overlap a side wall (see top-aperture-cuts-side-wall.test.ts), but one that
  // clears the box entirely has nothing to cut.
  const beyond = (center: { x: number; y: number }) =>
    createFdmEnclosure({
      board: input.board,
      apertures: [{ shape: "circle", face: "z_pos", radius: 3, center }],
    })

  expect(() => beyond({ x: 30, y: 0 })).toThrow(
    "misses the z_pos face along X: the opening spans 27mm to 33mm but the enclosure only spans -23mm to 23mm",
  )
  expect(() => beyond({ x: 0, y: 30 })).toThrow(
    "misses the z_pos face along Y: the opening spans 27mm to 33mm but the enclosure only spans -15mm to 15mm",
  )
})
