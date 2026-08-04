import { expect, test } from "bun:test"
import { getComponentBodyFaceExtent, resolveFdmEnclosureProblem } from "../lib"

const baseInput = {
  board: { width: 40, height: 24, thickness: 1.6 },
  depth: 14.6,
  topHeadroom: 4,
  lidLipDepth: 4,
}

const apertureWith = (extra: Record<string, unknown>) => ({
  shape: "rect" as const,
  face: "y_pos" as const,
  width: 10,
  height: 6,
  center: { x: 0, y: 0 },
  heightDimensionOffset: 2 - 3,
  ...extra,
})

test("a body envelope is projected onto the face normal", () => {
  const resolved = resolveFdmEnclosureProblem({
    ...baseInput,
    apertures: [
      apertureWith({
        componentBody: {
          size: { x: 6, y: 12 },
          footprint: { width: 6, height: 4 },
        },
      }),
    ],
  })

  // A `front` face is pierced along Y, so the body's Y extent is what matters.
  expect(resolved.apertures[0]!.inwardProjection).toBeCloseTo(12)
})

test("rotation is applied when projecting the envelope", () => {
  // Rotated a quarter turn, the body's 12mm X extent now faces front/back.
  const resolved = resolveFdmEnclosureProblem({
    ...baseInput,
    apertures: [
      apertureWith({
        componentBody: { size: { x: 12, y: 6 }, rotation: 90 },
      }),
    ],
  })

  expect(resolved.apertures[0]!.inwardProjection).toBeCloseTo(12)
})

test("the footprint is a floor under the body extent", () => {
  const resolved = resolveFdmEnclosureProblem({
    ...baseInput,
    apertures: [
      apertureWith({
        // Wide pad fan reaches further inboard than the body itself.
        componentBody: {
          size: { x: 6, y: 3 },
          footprint: { width: 6, height: 11 },
        },
      }),
    ],
  })

  expect(resolved.apertures[0]!.inwardProjection).toBeCloseTo(11)
})

test("an explicit depth overrides the envelope", () => {
  const resolved = resolveFdmEnclosureProblem({
    ...baseInput,
    apertures: [
      apertureWith({
        depth: 3,
        componentBody: { size: { x: 6, y: 12 } },
      }),
    ],
  })

  expect(resolved.apertures[0]!.inwardProjection).toBeCloseTo(3)
})

test("a horizontal face projects the body's Z extent", () => {
  // On a horizontal face the normal is Z, so the extent is `size.z`. It
  // over-reports -- it spans pins below the board too -- but a cut that travels
  // further through cavity removes nothing, and the FDM layer clamps it so it
  // can never reach the far shell. Reporting it is what lets a part in a corner
  // relieve the side walls it presses against.
  expect(
    getComponentBodyFaceExtent({
      body: { size: { x: 6, y: 6, z: 15 }, footprint: { width: 6, height: 6 } },
      face: "z_pos",
    }),
  ).toBe(15)

  expect(
    getComponentBodyFaceExtent({
      body: { size: { x: 6, y: 6, z: 15 } },
      face: "z_neg",
    }),
  ).toBe(15)

  // A footprint has no Z extent, so there is no floor to fall back on.
  expect(
    getComponentBodyFaceExtent({
      body: { size: { x: 6, y: 6 }, footprint: { width: 6, height: 6 } },
      face: "z_pos",
    }),
  ).toBeUndefined()
})
