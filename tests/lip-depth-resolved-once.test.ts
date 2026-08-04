import { expect, test } from "bun:test"
import { createFdmEnclosure, resolveFdmEnclosureProblem } from "../lib"
import type { CreateFdmEnclosureInput } from "../lib"

// A lip can only be as deep as the base cavity it seats into. The shell used to
// discover that for itself while the aperture projection went on using the
// authored value, so the two disagreed: the printed lip was short but openings
// were still projected clear of the full requested depth.
const input: CreateFdmEnclosureInput = {
  board: { width: 40, height: 24, thickness: 1.6 },
  // Deliberately shallow, so a 20mm lip cannot possibly fit the cavity.
  depth: 18,
  lidLipDepth: 20,
  apertures: [
    {
      shape: "rect",
      face: "z_pos",
      width: 6,
      height: 3,
      center: { x: 0, y: 0 },
    },
  ],
}

test("an over-deep lip is clamped once, in resolution", () => {
  const resolved = resolveFdmEnclosureProblem(input)
  const { lidLipDepth, floorThickness, lidThickness } = resolved.dimensions

  const cavityDepth = resolved.frame.seamZ - floorThickness
  expect(lidLipDepth).toBeCloseTo(cavityDepth, 6)
  expect(lidLipDepth).toBeLessThan(20)

  // The resolved value is the EFFECTIVE lip, so it must fit between the floor
  // and the seam rather than being the number the caller asked for.
  expect(floorThickness + lidLipDepth).toBeLessThanOrEqual(
    resolved.frame.seamZ + 1e-9,
  )
  expect(lidThickness).toBeGreaterThan(0)
})

test("the aperture projection agrees with the lip that is actually printed", () => {
  const resolved = resolveFdmEnclosureProblem(input)
  const placement = resolved.apertures[0]!

  // A LID aperture is the one that must clear the lip, so it is the only face
  // that reads lidLipDepth at all.
  // Compare against the cavity, NOT against dimensions.lidLipDepth: that field
  // is the thing under test, so asserting on it would hold no matter how wrong
  // it was. Previously the projection read the authored 20mm while the shell
  // printed the clamped depth, so the opening was cut further inboard than
  // anything it had to clear.
  const cavityDepth = resolved.frame.seamZ - resolved.dimensions.floorThickness
  expect(placement.inwardProjection).toBeLessThanOrEqual(cavityDepth + 1e-9)
})

test("the enclosure still builds with an over-deep lip", () => {
  const output = createFdmEnclosure(input)
  expect(output.parts.map((part) => part.id)).toEqual(["base", "lid"])
})
