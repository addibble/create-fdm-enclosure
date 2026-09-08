import { expect, test } from "bun:test"
import { createFdmEnclosure } from "../lib"

test("an omitted head resolves exactly like socketcap for board and recessed lid mounts", () => {
  for (const fastens of ["board", "lid"] as const) {
    const input = {
      board: { width: 40, height: 30, thickness: 1.6 },
      standoffHeight: 12,
      mounts: [
        {
          id: "EN1.H1",
          anchor: { x: 0, y: 0 },
          thread: "m3" as const,
          fastening: "self_tapping" as const,
          fastens,
          ...(fastens === "lid" ? { headRecess: "counterbore" as const } : {}),
        },
      ],
    }
    const omitted = createFdmEnclosure(input)
    const explicit = createFdmEnclosure({
      ...input,
      mounts: input.mounts.map((mount) => ({ ...mount, head: "socketcap" })),
    })
    expect(omitted.hardware).toEqual(explicit.hardware)
    expect(omitted.parts).toEqual(explicit.parts)
    expect(input.mounts[0]).not.toHaveProperty("head")
  }
})
