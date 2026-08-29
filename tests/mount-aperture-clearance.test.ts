import { expect, test } from "bun:test"
import { createFdmEnclosure } from "../lib"

/**
 * A floor boss stands between the inside floor and the underside of the board,
 * while a side-wall opening is placed against the body of the part it serves,
 * which is above the board. Directly above one another in plan, they never
 * share a Z band -- so an aperture sitting right on top of a mount in XY is not
 * by itself a collision, and reporting one would train people to ignore these.
 */
test("a side aperture directly above a floor boss does not collide with it", () => {
  const anchor = { x: -15, y: -8 }

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
    apertures: [
      {
        shape: "rect",
        face: "x_neg",
        center: anchor,
        width: 8,
        height: 6,
        depth: 6,
      },
    ],
  })

  const [mount] = enclosure.mounts
  expect(mount!.bossTopZ).toBeLessThan(7.6)
  expect(enclosure.designRuleViolations).toEqual([])
})
