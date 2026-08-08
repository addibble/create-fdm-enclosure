import { expect, test } from "bun:test"
import {
  getApertureIncidenceDegrees,
  getObliqueTangentShift,
} from "../lib/fdm/resolve-oblique-aperture"

const directionAtDegrees = (degrees: number) => {
  const radians = (degrees * Math.PI) / 180
  return { x: Math.cos(radians), y: Math.sin(radians), z: 0 }
}

/**
 * The incidence is measured between two board-space directions: the exact part
 * axis and the normal of the face core selected. It is not reconstructed from
 * component rotation. In particular, the two exact 45-degree ties stay on the
 * same x_neg face but lean in opposite directions; collapsing both to -45 was
 * what sent one cutter through the adjacent wall.
 */
test.each([
  ["x_neg", 180, 0],
  ["x_neg", 150, -30],
  ["x_neg", 225, 45],
  ["x_neg", 135, -45],
  ["y_pos", 120, 30],
  ["y_neg", 226, -44],
  ["x_pos", 30, 30],
] as const)(
  "%s normal to an axis at %s degrees has signed incidence %s",
  (face, axisDegrees, expected) => {
    expect(
      getApertureIncidenceDegrees({
        face,
        apertureAxisDirection: directionAtDegrees(axisDegrees),
      }),
    ).toBeCloseTo(expected)
  },
)

/**
 * A rotation about Z turns an opening in the lid or the floor in its own plane.
 * That is a roll, not an approach angle: the part still meets the plate square.
 */
test("a horizontal face never leans", () => {
  for (const face of ["z_pos", "z_neg"] as const) {
    expect(
      getApertureIncidenceDegrees({
        face,
        apertureAxisDirection: directionAtDegrees(-30),
      }),
    ).toBe(0)
    expect(
      getObliqueTangentShift({
        face,
        incidenceDegrees: -30,
        distanceToWall: 5,
      }),
    ).toBe(0)
  }
})

/** Low-information adapters retain the historical square-to-wall behavior. */
test("an absent continuous axis does not invent an incidence", () => {
  expect(getApertureIncidenceDegrees({ face: "x_neg" })).toBe(0)
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
