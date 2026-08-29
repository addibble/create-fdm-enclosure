import { expect, test } from "bun:test"
import { checkWallThickness } from "../lib/fdm/design-rule-checks/check-wall-thickness"
import { DEFAULT_FDM_DESIGN_RULES } from "../lib/fdm/design-rules"

/**
 * A thickness can fall below what the printer can lay down without any authored
 * number doing so -- the lip wall is a ratio of the side wall, and a lid is
 * raised to suit a fastener stack -- which is why this is checked on the
 * resolved dimensions rather than on the input.
 */
test("a lid thinner than the minimum printable wall is reported against the nozzle", () => {
  const rules = DEFAULT_FDM_DESIGN_RULES
  const violations = checkWallThickness({
    dimensions: {
      width: 40,
      height: 24,
      depth: 12,
      wallThickness: 2,
      floorThickness: 2,
      boardClearance: 1,
      lidThickness: 0.6,
      standoffHeight: 4,
      topHeadroom: 6,
      lidLipDepth: 3,
    },
    rules,
  })

  expect(violations).toHaveLength(1)
  expect(violations[0]!.rule).toBe("wall_below_minimum_thickness")
  expect(violations[0]!.measuredMm).toBe(0.6)
  expect(violations[0]!.limitMm).toBe(rules.minWallThicknessMm)
  // 0.6mm is thinner than two perimeters but wider than one extrusion, so it
  // prints as something -- just not as a sound wall.
  expect(violations[0]!.severity).toBe("warning")
  expect(violations[0]!.message).toContain("lid")
})
