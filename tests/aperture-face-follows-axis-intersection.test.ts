import { expect, test } from "bun:test"
import { resolveFdmEnclosureProblem } from "../lib/fdm/resolve-fdm-enclosure-problem"

const fromLeftRotated = (degrees: number) => {
  const radians = (degrees * Math.PI) / 180
  return { x: -Math.cos(radians), y: -Math.sin(radians), z: 0 }
}

/**
 * This reproduces the PJ-320D's placement relative to a 52x36mm board. Although
 * orientation quantization changes from x_neg to y_neg at 45 degrees, its axis
 * still reaches the nearer X wall first at both 41 and 49 degrees. The physical
 * transition occurs later, where the ray itself crosses the enclosure corner.
 * Centres on either side of 45 must therefore remain on one continuous line
 * through the component rotation datum rather than jumping between AABB sides.
 */
test("a side aperture follows its physical axis through the first wall", () => {
  const origin = { x: -18.5, y: -4.7 }
  const resolveAt = (rotation: number, quantizedFace: "x_neg" | "y_neg") =>
    resolveFdmEnclosureProblem({
      board: { width: 52, height: 36, thickness: 1.4 },
      apertures: [
        {
          shape: "circle",
          radius: 1,
          face: quantizedFace,
          center: origin,
          apertureAxisDirection: fromLeftRotated(rotation),
        },
      ],
    }).apertures[0]!

  const at41 = resolveAt(41, "x_neg")
  const at49 = resolveAt(49, "y_neg")
  const at60 = resolveAt(60, "y_neg")

  expect(at41.face).toBe("x_neg")
  expect(at49.face).toBe("x_neg")
  expect(at60.face).toBe("y_neg")

  for (const [rotation, aperture] of [
    [41, at41],
    [49, at49],
  ] as const) {
    const direction = fromLeftRotated(rotation)
    const travel = (aperture.center.x - origin.x) / direction.x
    expect(aperture.center.y).toBeCloseTo(origin.y + travel * direction.y)
  }

  // The opening progresses continuously toward the corner as the body turns;
  // it no longer jumps to opposite sides of the connector at the 45° tie.
  expect(at49.center.y).toBeLessThan(at41.center.y)
})
