import { expect, test } from "bun:test"
import { createFdmEnclosure } from "../lib"

/**
 * Every mount hangs off a hole in the board -- that is what makes a lid screw
 * cost no floor area. A mount placed past the board edge has no hole to hang
 * off, which is a different failure from a boss that merely overhangs: there is
 * nothing there at all.
 */
test("a mount placed off the board is an error, not an overhang warning", () => {
  const enclosure = createFdmEnclosure({
    board: { width: 40, height: 24, thickness: 1.6 },
    mounts: [
      {
        id: "EN1.H1",
        fastens: "board",
        anchor: { x: 24, y: 0 },
        thread: "m3",
        fastening: "heat_set_insert",
        head: "socketcap",
      },
    ],
  })

  const violations = enclosure.designRuleViolations.filter(
    (violation) => violation.rule === "board_edge_clearance",
  )
  expect(violations).toHaveLength(1)
  expect(violations[0]!.severity).toBe("error")
  expect(violations[0]!.measuredMm).toBeCloseTo(-4, 5)
  expect(violations[0]!.message).toContain("outside")
})
