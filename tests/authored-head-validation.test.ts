import { expect, test } from "bun:test"
import { createFdmEnclosure } from "../lib"

test("the solver rejects unknown head strings and unstocked pairs without substituting a head", () => {
  for (const fastens of ["board", "lid"] as const) {
    for (const [thread, head, message] of [
      ["m3", "future_head", "unknown screw head"],
      ["m3", " SocketCap ", "unknown screw head"],
      ["m3", "", "unknown screw head"],
      ["m2", "buttonhead", "No stocked M2 screw"],
      ["m3", "flathead", "flathead"],
    ] as const) {
      const run = () =>
        createFdmEnclosure({
          board: { width: 40, height: 30, thickness: 1.6 },
          standoffHeight: 12,
          mounts: [
            {
              id: "EN1.H1",
              fastens,
              thread,
              head,
              anchor: { x: 0, y: 0 },
              fastening: "self_tapping",
            },
          ],
        })
      expect(run).toThrow(message)
      expect(run).toThrow("EN1.H1")
    }
  }
})
