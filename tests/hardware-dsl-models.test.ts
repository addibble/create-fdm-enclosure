import { expect, test } from "bun:test"
import { createFdmEnclosure, getHardwareModel } from "../lib"

const board = { width: 40, height: 24, thickness: 1.6 }

/**
 * The point of the hardware DSL is that a *purchased* part gets geometry the
 * same way an enclosure part does -- generated from its specification -- rather
 * than fetched from a vendor. That makes it available offline, in a worker, in a
 * saved build, and without a licence.
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
        thread: "M3",
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
    ["screw", "screw_m3_l16mm_countersunk"],
    ["insert", "insert_m3_l3mm_heatset"],
    // Cut to the gap. Note the string says 7.5mm and not 7.500000000000002: the
    // gap arrives from `totalHeight - lidThickness - boardTopZ` with the usual
    // floating-point noise, and an identity string cannot carry that or two
    // spacers of the same real length become different parts. `formatMm` is what
    // rounds it, and the `mm` it writes is what footprinter strings carry too.
    ["spacer", "spacer_od6mm_id3.2mm_l7.5mm"],
  ])

  for (const piece of enclosure.hardware) {
    expect(getHardwareModel(piece.hardwareString)).toBeTruthy()
  }
})

test("a cut spacer carries its length in both its geometry and its BOM line", () => {
  const enclosure = createFdmEnclosure({
    board,
    topHeadroom: 7.5,
    mounts: [-15, 15].map((x) => ({
      id: `EN1.H${x < 0 ? 1 : 2}`,
      fastens: "lid" as const,
      anchor: { x, y: -8 },
      thread: "M3" as const,
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

test("a countersunk screw is drawn at the length it was ordered, head included", () => {
  // ISO 7046 measures overall, so an M3x14 countersunk screw is 14mm from the
  // top of its head -- not 14mm of shank under it. The model applies the same
  // rule the length resolver does, so the drawn part matches the ordered one.
  const countersunk = getHardwareModel("screw_m3_l14_countersunk")
  const socketCap = getHardwareModel("screw_m3_l14_socketcap")

  const lowestZ = (plan: unknown): number => {
    const node = plan as {
      type: string
      shapes?: unknown[]
      shape?: unknown
      vector?: number[]
      height?: number
      radius?: number
    }
    if (node.type === "translate") {
      const inner = node.shape as { height?: number }
      return (node.vector?.[2] ?? 0) - (inner?.height ?? 0) / 2
    }
    const children = [
      ...(node.shapes ?? []),
      ...(node.shape ? [node.shape] : []),
    ]
    return Math.min(...children.map(lowestZ))
  }

  // 14 overall - 1.86 of buried head = 12.14 of shank below the seat.
  // The head height is ISO 10642's `k`, measured to the theoretical sharp
  // corner; changing standard changes this number, which is why the invariant
  // worth holding is the one below -- the part is the length it was ordered.
  expect(lowestZ(countersunk)).toBeCloseTo(-12.14)
  // A cap head sits proud, so all 14mm is below the seat.
  expect(lowestZ(socketCap)).toBeCloseTo(-14)
})

test("an unknown family or thread is refused, not silently drawn", () => {
  expect(() => getHardwareModel("grommet_m3_l8")).toThrow(
    "is not a hardware family. Known families: screw, insert, spacer",
  )
  expect(() => getHardwareModel("screw_m9_l8_socketcap")).toThrow(
    'unknown thread "m9"',
  )
  expect(() => getHardwareModel("screw__m3")).toThrow()
})

test("a hand-written dimension may use any length unit", () => {
  // Read back with `parseAndConvertSiUnit`, so the unit the formatter wrote is
  // understood -- and so a unit it did not write still is. A `parseFloat` here
  // would read "0.25in" as 0.25mm and quietly draw a screw a fortieth of its
  // length, which is the exact defect the workspace guide uses as its example.
  expect(getHardwareModel("spacer_od6mm_id3.2mm_l0.6cm")).toEqual(
    getHardwareModel("spacer_od6mm_id3.2mm_l6mm"),
  )
  expect(getHardwareModel("spacer_od0.25in_id3.2mm_l6mm")).toEqual(
    getHardwareModel("spacer_od6.35mm_id3.2mm_l6mm"),
  )
})

test("an insert is drawn at its catalogue diameter, not a formula on the thread", () => {
  // An M4 heat-set insert installs into 5.6mm. Deriving the outside diameter as
  // `nominal + 1` would draw it at 5.0 -- 0.6mm undersize, and disagreeing with
  // the bore the enclosure cut for it.
  const radii = (plan: unknown): number[] => {
    const node = plan as {
      type: string
      shapes?: unknown[]
      shape?: unknown
      radius?: number
    }
    if (node.type === "cylinder") return [node.radius!]
    return [
      ...(node.shapes ?? []).flatMap(radii),
      ...(node.shape ? radii(node.shape) : []),
    ]
  }
  expect(radii(getHardwareModel("insert_m4_l8.1mm_heatset"))[0]).toBeCloseTo(
    2.8,
  )

  // The method token is read, not ignored: a press-fit M3 is a different part
  // with a different bore from a heat-set one.
  expect(radii(getHardwareModel("insert_m3_l4mm_pressfit"))[0]).toBeCloseTo(1.9)
  expect(radii(getHardwareModel("insert_m3_l5.7mm_heatset"))[0]).toBeCloseTo(
    2.0,
  )

  expect(() => getHardwareModel("insert_m3_l5.7mm")).toThrow(
    "an insert string needs a method",
  )
  expect(() => getHardwareModel("insert_m3_l99mm_heatset")).toThrow(
    "no M3 heat set insert of 99mm in the catalogue",
  )
})
