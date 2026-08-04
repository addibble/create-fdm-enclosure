import { expect, test } from "bun:test"
import * as jscadModeling from "@jscad/modeling"
import { executeJscadOperations } from "jscad-planner"
import { createFdmEnclosure, resolveFdmEnclosureProblem } from "../lib"

/**
 * A large opening in a horizontal face is allowed to run off the cavity and into
 * a side wall, and this is the case that motivates the three aperture dimensions
 * being named in the frame of the face they pierce.
 *
 * `width` and `height` size the hole in the lid, in X and Y.
 * `depth` is the third dimension, along the face normal -- so on a
 * horizontal face it runs in Z, and what it cuts is not the lid at all but the
 * *side walls* the opening overlaps. Without it a part sitting in a corner would
 * be trapped: the lid would open above it while the wall stayed intact beside it.
 *
 * The depth is taken at face value. Inboard of the lid is the floor, only a
 * couple of centimetres away, so a deep enough opening cuts the floor too --
 * that is the drawn consequence of the depth, not a bug to be clamped away.
 */

// Outer 46 x 30 x 20: wall 2, floor 2, lid 2, lip 4, seam at z=18, cavity 16.
// The +X wall therefore occupies x 21..23.
const board = { width: 40, height: 24, thickness: 1.6 }
const SEAM_Z = 18
const WALL_INNER_X = 21
const FLOOR_TOP_Z = 2
const APERTURE_DEPTH = 8

/** Spans x 9..23 -- across the cavity edge and flush with the outside wall. */
const input = {
  board,
  depth: 20,
  topHeadroom: 0,
  apertures: [
    {
      shape: "rect" as const,
      face: "z_pos" as const,
      width: 14,
      height: 10,
      center: { x: 16, y: 0 },
      depth: APERTURE_DEPTH,
    },
  ],
}

/**
 * Volume of a 1mm probe cube at a point, so ~1 means solid there and ~0 means
 * the material was cut away. A volume comparison alone cannot tell a wall that
 * was relieved from a floor that was destroyed.
 */
const solidAt = (plan: unknown, center: [number, number, number]) => {
  const geometry = executeJscadOperations(
    jscadModeling as any,
    plan as any,
  ) as any
  const probe = jscadModeling.primitives.cuboid({ center, size: [1, 1, 1] })
  return jscadModeling.measurements.measureVolume(
    jscadModeling.booleans.intersect(geometry, probe) as any,
  )
}

const baseOf = (config: typeof input) =>
  createFdmEnclosure(config).parts.find((part) => part.id === "base")!.jscadPlan

test("a large top aperture cuts down into the side wall it overlaps", () => {
  const resolved = resolveFdmEnclosureProblem(input)
  const placement = resolved.apertures[0]!

  // The opening really does run past the cavity and onto the wall.
  expect(placement.center.x + placement.width / 2).toBeGreaterThan(WALL_INNER_X)
  // Depth is honoured outright here: 8mm fits inside the 16mm cavity.
  expect(placement.inwardProjection).toBeCloseTo(APERTURE_DEPTH)

  const cut = baseOf(input)
  const uncut = baseOf({ ...input, apertures: [] })

  // Inside the wall band, just below the seam: gone from the cut base, present
  // in the blank. The lid alone could never have removed this -- it is base.
  const inWall: [number, number, number] = [22, 0, SEAM_Z - 2]
  expect(solidAt(uncut, inWall)).toBeCloseTo(1)
  expect(solidAt(cut, inWall)).toBeCloseTo(0)

  // Lower down the same wall the material is untouched, so the notch has a
  // bottom and the box still stands on its walls.
  const belowNotch: [number, number, number] = [
    22,
    0,
    SEAM_Z - APERTURE_DEPTH - 2,
  ]
  expect(solidAt(cut, belowNotch)).toBeCloseTo(1)

  // The wall outside the opening's Y span is untouched too.
  expect(solidAt(cut, [22, 12, SEAM_Z - 2])).toBeCloseTo(1)
})

test("the notch stops where the depth says, not at the wall's base", () => {
  const cut = baseOf(input)
  // The tool overruns by one booleanTolerance (0.5), so the cut bottom sits at
  // seam - depth - 0.5 = 9.5. Probe either side of it, clear of that boundary.
  expect(solidAt(cut, [22, 0, SEAM_Z - APERTURE_DEPTH + 1])).toBeCloseTo(0)
  expect(solidAt(cut, [22, 0, SEAM_Z - APERTURE_DEPTH - 1])).toBeCloseTo(1)
})

test("a depth deeper than the box cuts through everything below it", () => {
  const deep = {
    ...input,
    apertures: [{ ...input.apertures[0]!, depth: 100 }],
  }
  const resolved = resolveFdmEnclosureProblem(deep)
  // Rendered as authored -- no cap to the cavity.
  expect(resolved.apertures[0]!.inwardProjection).toBeCloseTo(100)

  const cut = baseOf(deep)
  // The wall is relieved for its whole height...
  expect(solidAt(cut, [22, 0, FLOOR_TOP_Z + 2])).toBeCloseTo(0)
  // ...and so is the floor beneath the opening. An author who wants the floor
  // kept gives a depth that stops above it, or lets the depth come from the
  // component envelope.
  expect(solidAt(cut, [16, 0, FLOOR_TOP_Z - 1])).toBeCloseTo(0)
})
