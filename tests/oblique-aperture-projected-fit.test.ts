import { expect, test } from "bun:test"
import { resolveFdmEnclosureProblem } from "../lib/fdm/resolve-fdm-enclosure-problem"

const axisAtMinus45FromXNeg = {
  x: -Math.SQRT1_2,
  y: Math.SQRT1_2,
  z: 0,
}

/**
 * A 45-degree profile intersects the wall over width/cos(45), not its authored
 * square-on width. Corner overlap is valid because subtraction from both parts
 * naturally wraps the opening into the neighbouring wall; only a projected
 * profile lying wholly outside the enclosure should be rejected.
 */
test("fit validation uses the oblique wall projection and permits corner overlap", () => {
  const resolveAt = (originY: number) =>
    resolveFdmEnclosureProblem({
      board: { width: 52, height: 24, thickness: 1.6 },
      apertures: [
        {
          shape: "rect",
          face: "x_neg",
          width: 4,
          height: 2,
          center: { x: -26, y: originY },
          apertureAxisDirection: axisAtMinus45FromXNeg,
        },
      ],
    })

  // At the x_neg mid-plane this centre is y=17.5. The authored width spans
  // 15.5..19.5 and appears to miss a box ending at y=15, but the true oblique
  // section spans about 14.67..20.33 and clips the corner.
  expect(() => resolveAt(15.5)).not.toThrow()

  // One millimetre farther out, even the projected profile is wholly beyond the
  // outer span and there is no enclosure material for the tool to intersect.
  expect(() => resolveAt(16.5)).toThrow(
    "misses the x_neg face along Y: the opening spans 15.672mm to 21.328mm but the enclosure only spans -15mm to 15mm",
  )

  // Corner overlap must not turn into permission to consume a whole part. This
  // profile covers both outer edges and would subtract the complete lid.
  expect(() =>
    resolveFdmEnclosureProblem({
      board: { width: 40, height: 24, thickness: 1.6 },
      apertures: [
        {
          shape: "rect",
          face: "z_pos",
          width: 100,
          height: 60,
          center: { x: 0, y: 0 },
        },
      ],
    }),
  ).toThrow(
    "engulfs the z_pos face along X: the opening spans -50mm to 50mm but the enclosure only spans -23mm to 23mm",
  )
})
