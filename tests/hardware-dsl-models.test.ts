import { expect, test } from "bun:test"
import { createFdmEnclosure } from "../lib"

const board = { width: 40, height: 24, thickness: 1.6 }

/**
 * The point of the hardware DSL is that a *purchased* part gets geometry the
 * same way an enclosure part does -- generated from its specification -- rather
 * than fetched from a vendor. That makes it available offline, in a worker, in a
 * saved build, and without a licence.
 *
 * That the strings actually expand is held by
 * `hardware-string-round-trip.test.ts`, against the real parser and builder.
 * This one pins what they say.
 */
test("every purchased piece carries a string that expands to a solid", () => {
  const enclosure = createFdmEnclosure({
    board,
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
    ],
  })

  expect(
    enclosure.hardware.map((piece) => [piece.role, piece.hardwareString]),
  ).toEqual([
    // 7.5mm of headroom makes the clamped stack 11.1mm; with a short insert's
    // 3mm of thread that needs 14.1mm overall, so the stocked 16 is ordered.
    // A bolt, not a screw: it threads into the insert below it, and the family
    // follows from the mount's fastening method rather than from the piece.
    ["screw", "bolt_m3_l16mm_countersunk"],
    // The method leads the family name, because in modelprinter's vocabulary
    // the family IS the method.
    ["insert", "heatsetinsert_m3_l3mm"],
    // Cut to the gap. Note the string says 7.5mm and not 7.500000000000002: the
    // gap arrives from `totalHeight - lidThickness - boardTopZ` with the usual
    // floating-point noise, and an identity string cannot carry that or two
    // spacers of the same real length become different parts. `formatMm` is what
    // rounds it, and the `mm` it writes is what footprinter strings carry too.
    ["spacer", "spacer_od6mm_id3.2mm_l7.5mm"],
  ])
})

test("a cut spacer carries its length in both its geometry and its BOM line", () => {
  const enclosure = createFdmEnclosure({
    board,
    topHeadroom: 7.5,
    mounts: [-15, 15].map((x) => ({
      id: `EN1.H${x < 0 ? 1 : 2}`,
      fastens: "lid" as const,
      anchor: { x, y: -8 },
      thread: "m3" as const,
      fastening: "heat_set_insert" as const,
      head: "countersunk" as const,
      lidColumn: "spacer" as const,
    })),
  })
  const spacers = enclosure.hardware.filter((piece) => piece.role === "spacer")

  // Both strings carry the cut length -- the model because it must be that long,
  // the designation because pieces of one length are one BOM line with a count.
  for (const spacer of spacers) {
    expect(spacer.hardwareString).toBe("spacer_od6mm_id3.2mm_l7.5mm")
    expect(spacer.designation).toBe("spacer-stock nylon 6mm x 3.2mm cut 7.5mm")
  }
  expect(new Set(spacers.map((s) => s.bomGroupKey)).size).toBe(1)
})
