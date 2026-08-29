import { expect, test } from "bun:test"
import { createFdmEnclosure } from "../lib"

/**
 * The top edge of a side-wall opening is printed into free air across the
 * opening's width. Past the span the printer can bridge it droops into the
 * opening, and the part it was cut for stops fitting.
 */
test("a side aperture wider than the bridging limit is reported, and a lid one is not", () => {
  const wideOpening = {
    shape: "rect" as const,
    width: 24,
    height: 6,
    depth: 4,
  }

  const enclosure = createFdmEnclosure({
    board: { width: 60, height: 40, thickness: 1.6 },
    apertures: [
      { ...wideOpening, face: "x_neg", center: { x: -20, y: 0 } },
      // The same span on the lid, which is printed flat: its edges are
      // supported all the way round, so there is nothing to bridge.
      { ...wideOpening, face: "z_pos", center: { x: 0, y: 10 } },
    ],
  })

  const bridging = enclosure.designRuleViolations.filter(
    (violation) => violation.rule === "unsupported_bridge",
  )
  expect(bridging).toHaveLength(1)
  expect(bridging[0]!.face).toBe("x_neg")
  expect(bridging[0]!.apertureIndex).toBe(0)
  expect(bridging[0]!.measuredMm).toBeGreaterThan(bridging[0]!.limitMm)
})
