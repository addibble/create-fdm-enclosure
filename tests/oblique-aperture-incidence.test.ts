import { expect, test } from "bun:test"
import {
  getApertureIncidenceDegrees,
  getObliqueTangentShift,
} from "../lib/fdm/resolve-oblique-aperture"

/**
 * A wall is axis-aligned and a part is not. Face selection quantizes to the
 * nearest of four walls, so any rotation that is not a multiple of 90 degrees
 * leaves the part leaning against the wall it exits through -- and the cut has
 * to lean with it, or the hole is the wrong shape in the wrong place.
 */
test.each([
  [0, 0],
  [-30, -30],
  [90, 0], // square to the next wall round
  [-60, 30], // past 45: the next wall is nearer, leaning the other way
  [45, -45], // the boundary belongs to one side, not both
  [330, -30], // normalized rotations behave the same
])("a part rotated %s degrees meets its wall at %s", (rotation, expected) => {
  expect(getApertureIncidenceDegrees({ face: "x_neg", rotation })).toBeCloseTo(
    expected,
  )
})

/**
 * A rotation about Z turns an opening in the lid or the floor in its own plane.
 * That is a roll, not an approach angle: the part still meets the plate square.
 */
test("a horizontal face never leans", () => {
  for (const face of ["z_pos", "z_neg"] as const) {
    expect(getApertureIncidenceDegrees({ face, rotation: -30 })).toBe(0)
    expect(
      getObliqueTangentShift({
        face,
        incidenceDegrees: -30,
        distanceToWall: 5,
      }),
    ).toBe(0)
  }
})

/**
 * Where the mating axis crosses the wall, not where the part's centre projects
 * onto it. Square-on the two coincide, which is why every fixture missed this.
 *
 * The signs differ per wall because the tangent is the outward normal turned 90
 * degrees counter-clockwise; the case that caught a sign error was `y_pos`,
 * where the shift runs the opposite way to `x_neg` for the same lean.
 */
test.each([
  ["x_neg", -30, 1.4, 0.808],
  ["y_pos", 30, 1.4, -0.808],
  ["x_pos", 30, 1.4, 0.808],
  ["y_neg", -30, 1.4, -0.808],
] as const)(
  "%s leaning %s degrees shifts the opening %s along the wall",
  (face, incidenceDegrees, distanceToWall, expected) => {
    expect(
      getObliqueTangentShift({ face, incidenceDegrees, distanceToWall }),
    ).toBeCloseTo(expected, 2)
  },
)

test("a part square to its wall is not moved at all", () => {
  expect(
    getObliqueTangentShift({
      face: "x_neg",
      incidenceDegrees: 0,
      distanceToWall: 12,
    }),
  ).toBeCloseTo(0)
})
