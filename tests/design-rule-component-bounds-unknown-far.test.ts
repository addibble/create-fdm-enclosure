import { expect, test } from "bun:test"
import { createFdmEnclosure } from "../lib"

/**
 * The missing height is only worth reporting where it changes the answer. A
 * part nowhere near a mounting feature is clear of it whatever its height, so
 * warning there would make the whole rule noise.
 */
test("a part clear of every mount in plan is not reported for missing bounds", () => {
  const enclosure = createFdmEnclosure({
    board: { width: 40, height: 24, thickness: 1.6 },
    mounts: [
      {
        id: "EN1.H1",
        fastens: "board",
        anchor: { x: -12, y: -6 },
        thread: "M3",
        fastening: "heat_set_insert",
        head: "socket_cap",
      },
    ],
    components: [
      {
        id: "C1",
        center: { x: 12, y: 6 },
        boardSide: "bottom",
        body: { size: { x: 6, y: 6 } },
      },
    ],
  })

  expect(enclosure.designRuleViolations).toEqual([])
})
