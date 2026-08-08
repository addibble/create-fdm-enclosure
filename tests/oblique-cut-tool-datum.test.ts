import { expect, test } from "bun:test"
import { createApertureCutoutPlan } from "../lib/apertures/create-aperture-cutout-plan"
import type { ResolvedEnclosureAperturePlacement } from "../lib/enclosure"

/**
 * The cutter is centred on the part's rotated mating axis, not translated along
 * the unrotated wall normal. Its plate-crossing span grows symmetrically at both
 * ends, while the authored inward depth remains the exact difference between
 * the inboard and outboard reaches.
 */
test("an oblique tool keeps its rotation datum and fully spans both wall surfaces", () => {
  const center = { x: -20, y: 6, z: 11 }
  const faceThickness = 2
  const booleanTolerance = 0.1
  const width = 6.5
  const inwardProjection = 6

  for (const incidenceDegrees of [0, -30, 30, -45, 45]) {
    const placement: ResolvedEnclosureAperturePlacement = {
      aperture: {
        shape: "circle",
        face: "x_neg",
        radius: width / 2,
        center: { x: -19, y: 6 },
      },
      face: "x_neg",
      center,
      width,
      height: width,
      rotation: 0,
      incidenceDegrees,
      inwardProjection,
    }
    const cutout = createApertureCutoutPlan({
      placement,
      faceThickness,
      booleanTolerance,
    })

    const radians = (incidenceDegrees * Math.PI) / 180
    const axis = {
      // x_neg normal (-1, 0), rotated counter-clockwise by incidence.
      x: -Math.cos(radians),
      y: -Math.sin(radians),
    }
    const expectedOrigin = {
      x: center.x - (axis.x * inwardProjection) / 2,
      y: center.y - (axis.y * inwardProjection) / 2,
    }
    const plan = cutout.jscadPlan as {
      type: string
      vector: [number, number, number]
    }

    expect(plan.type).toBe("translate")
    expect(plan.vector[0]).toBeCloseTo(expectedOrigin.x)
    expect(plan.vector[1]).toBeCloseTo(expectedOrigin.y)
    expect(plan.vector[2]).toBe(center.z)

    const cosine = Math.abs(Math.cos(radians))
    const expectedDepth =
      (faceThickness + booleanTolerance * 2) / cosine +
      width * Math.abs(Math.tan(radians)) +
      inwardProjection
    expect(cutout.cutDepth).toBeCloseTo(expectedDepth)

    // Measured along the physical tool axis, the inboard endpoint remains
    // exactly `inwardProjection` farther from the wall datum than the outboard
    // endpoint. Rotation lengthens only what is required to cross the plate.
    const outboardReach = cutout.cutDepth / 2 - inwardProjection / 2
    const inboardReach = cutout.cutDepth / 2 + inwardProjection / 2
    expect(inboardReach - outboardReach).toBeCloseTo(inwardProjection)

    // At either wall surface, the trailing edge of the finite-width tool still
    // overreaches by the full boolean tolerance -- no reliance on spare depth.
    const plateAndTolerance = faceThickness / 2 + booleanTolerance
    const trailingCornerLoss = (width / 2) * Math.abs(Math.sin(radians))
    expect(outboardReach * cosine - trailingCornerLoss).toBeCloseTo(
      plateAndTolerance,
    )
  }
})
