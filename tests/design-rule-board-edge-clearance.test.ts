import { expect, test } from "bun:test"
import { createFdmEnclosure } from "../lib"

const board = { width: 40, height: 24, thickness: 1.6 }

const mountAt = (x: number, y: number) =>
  createFdmEnclosure({
    board,
    mounts: [
      {
        id: "EN1.H1",
        fastens: "board",
        anchor: { x, y },
        thread: "M3",
        fastening: "heat_set_insert",
        head: "socket_cap",
      },
    ],
  }).designRuleViolations.filter(
    (violation) => violation.rule === "board_edge_clearance",
  )

/**
 * A boss holds the board up by its top face, so a boss reaching past the board
 * edge leaves the board bearing on part of a ring: tightening the screw tips it
 * instead of clamping it flat.
 */
test("a mount too near the board edge is reported, and one well inboard is not", () => {
  // 3.6mm boss radius, 2mm from the Y edge: 1.6mm of it hangs off the board.
  const nearEdge = mountAt(0, board.height / 2 - 2)
  expect(nearEdge.length).toBeGreaterThan(0)
  expect(nearEdge[0]!.mountId).toBe("EN1.H1")
  expect(nearEdge[0]!.severity).toBe("warning")
  expect(nearEdge[0]!.measuredMm).toBeCloseTo(-1.6, 5)
  expect(nearEdge[0]!.message).toContain("past the board edge")

  expect(mountAt(0, 0)).toEqual([])
})
