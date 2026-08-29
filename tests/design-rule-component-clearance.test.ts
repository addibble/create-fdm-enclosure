import { expect, test } from "bun:test"
import { createFdmEnclosure } from "../lib"

/**
 * A floor boss stands in the space under the board, which is where a
 * bottom-side part is. A part on the *top* is on the far side of the board and
 * out of its reach -- which is the distinction that makes this check worth
 * having rather than a plan-view overlap test.
 */
test("a boss is reported against the part it runs through, and not against one on the far side", () => {
  const anchor = { x: -12, y: -6 }

  const enclosure = createFdmEnclosure({
    board: { width: 40, height: 24, thickness: 1.6 },
    mounts: [
      {
        id: "EN1.H1",
        fastens: "board",
        anchor,
        thread: "M3",
        fastening: "heat_set_insert",
        head: "socket_cap",
      },
    ],
    components: [
      {
        id: "U1",
        // Directly over the boss, but on the other face of the board.
        center: anchor,
        boardSide: "top",
        body: { size: { x: 6, y: 6 }, aboveBoardHeight: 3 },
      },
      {
        id: "C1",
        // Directly over the boss and on the same side of the board as it.
        center: anchor,
        boardSide: "bottom",
        body: { size: { x: 6, y: 6 }, aboveBoardHeight: 3 },
      },
    ],
  })

  const violations = enclosure.designRuleViolations.filter(
    (violation) => violation.rule === "component_clearance",
  )
  expect(violations).toHaveLength(1)
  expect(violations[0]!.componentId).toBe("C1")
  expect(violations[0]!.mountId).toBe("EN1.H1")
  expect(violations[0]!.severity).toBe("error")
  expect(violations[0]!.measuredMm).toBeLessThanOrEqual(0)
})
