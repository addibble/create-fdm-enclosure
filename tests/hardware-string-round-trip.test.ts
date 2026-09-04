import { getAssemblyHardwareModel } from "@tscircuit/jscad-assembly-hardware"
import { parseModelString } from "@tscircuit/modelprinter"
import { expect, test } from "bun:test"
import { createFdmEnclosure } from "../lib"

/**
 * Every hardware string this solver emits must parse as a modelprinter model
 * and build as a solid.
 *
 * The string is documented as "the mechanical twin of a `footprinter_string`",
 * which is a claim about a *contract*: whoever lowers it into CAD does so with
 * `modelprinter`'s grammar and `jscad-assembly-hardware`'s dimensions. This
 * package spent that claim without ever checking it, and it was false --
 * inserts went out as `insert_m3_l5.7mm_heatset`, which names no modelprinter
 * family at all, so the piece the RFC exists to make visible ("see the bolt
 * reach its insert") was silently not drawn.
 *
 * Asserting against the real parser and the real builder, rather than a regex,
 * is the point: a hand-written expectation drifts when the grammar moves, and a
 * string that merely looks right is exactly what shipped.
 */
test("every emitted hardware string parses and builds", () => {
  const enclosure = createFdmEnclosure({
    board: { width: 40, height: 24, thickness: 1.6 },
    topHeadroom: 7.5,
    mounts: [
      {
        id: "EN1.H1",
        fastens: "lid",
        anchor: { x: -15, y: -8 },
        thread: "m3",
        fastening: "heat_set_insert",
        head: "countersunk",
        lidColumn: "spacer",
      },
      {
        id: "EN1.H2",
        fastens: "board",
        anchor: { x: 15, y: -8 },
        thread: "m3",
        fastening: "heat_set_insert",
        head: "socketcap",
        // 3.2mm is the close-fit hole practically every layout drills for an M3.
        pcbHoleDiameter: 3.2,
      },
    ],
  })

  const strings = enclosure.hardware.map((piece) => piece.hardwareString)
  expect(strings.every((s) => s !== null)).toBe(true)

  for (const hardwareString of strings) {
    if (hardwareString === null) continue
    expect(() => parseModelString(hardwareString)).not.toThrow()
    expect(getAssemblyHardwareModel(hardwareString)).toBeTruthy()
  }

  // A bolt and a screw are the same solid but not the same family: what they
  // thread into is the mount's property, and the renderer colours them
  // differently so a section view tells them apart.
  const byRole = new Map(
    enclosure.hardware.map((piece) => [piece.id, piece.hardwareString]),
  )
  expect(byRole.get("EN1.H1.screw")).toStartWith("bolt_m3_")
  expect(byRole.get("EN1.H2.screw")).toStartWith("bolt_m3_")
  expect(byRole.get("EN1.H1.insert")).toStartWith("heatsetinsert_m3_")
})
