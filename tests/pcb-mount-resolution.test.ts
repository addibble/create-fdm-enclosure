import { expect, test } from "bun:test"
import { createFdmEnclosure } from "../lib"

const board = { width: 40, height: 24, thickness: 1.6 }

test("a PCB mount resolves a boss, an insert that fits, and the hardware it consumes", () => {
  const enclosure = createFdmEnclosure({
    board,
    mounts: [
      {
        id: "EN1.H1",
        fastens: "board",
        anchor: { x: -15, y: -8 },
        thread: "m3",
        fastening: "heat_set_insert",
        head: "socketcap",
        // 3.2mm is the close-fit hole practically every layout drills for an M3.
        pcbHoleDiameter: 3.2,
      },
    ],
  })

  const [mount] = enclosure.mounts
  expect(mount!.center).toEqual({ x: -15, y: -8 })
  // Bore 4.0 plus the 1.6mm printed wall each side.
  expect(mount!.bossDiameterMm).toBeCloseTo(7.2)
  expect(mount!.boreDiameterMm).toBe(4)

  // The boss spans the standoff gap: floor top to board underside, 4mm by
  // default. With a 2mm floor and 0.8mm of it kept back, that leaves 5.2mm of
  // bore -- so the 5.7mm standard insert does NOT fit and the 3mm short series
  // is selected instead. Hardcoding the short insert is what the reference
  // implementation did after hitting this, which then made every deeper
  // enclosure weaker than it needed to be.
  expect(mount!.insert?.series).toBe("short")
  expect(mount!.boreDepthMm).toBeCloseTo(3.5)

  // Head bears on the PCB, which the enclosure does not machine.
  expect(mount!.headRecess).toBe("none")

  // 1.6mm board clamped + 3mm of insert thread = 4.6mm, rounded up to a stocked 5.
  expect(mount!.screwLength.designatedLengthMm).toBe(5)

  expect(
    enclosure.hardware.map((piece) => [piece.role, piece.designation]),
  ).toEqual([
    ["screw", "ISO 4762 M3x5"],
    ["insert", "heat-set-insert M3x3 short"],
  ])
})

test("a taller standoff takes the longer insert series", () => {
  const enclosure = createFdmEnclosure({
    board,
    standoffHeight: 8,
    mounts: [
      {
        id: "EN1.H1",
        fastens: "board",
        anchor: { x: -15, y: -8 },
        thread: "m3",
        fastening: "heat_set_insert",
        head: "socketcap",
      },
    ],
  })

  expect(enclosure.mounts[0]!.insert?.series).toBe("standard")
  expect(enclosure.mounts[0]!.insert?.lengthMm).toBe(5.7)
  // 1.6 clamped + 5.7 engaged = 7.3 -> stocked 8.
  expect(enclosure.mounts[0]!.screwLength.designatedLengthMm).toBe(8)
})

test("a PCB hole too small for the screw shank is a design error", () => {
  expect(() =>
    createFdmEnclosure({
      board,
      mounts: [
        {
          id: "EN1.H1",
          fastens: "board",
          anchor: { x: -15, y: -8 },
          thread: "m3",
          fastening: "heat_set_insert",
          head: "socketcap",
          // A 2.2mm hole is an M2 clearance -- a plausible mistake, and one that
          // produces a perfectly renderable enclosure the screw cannot enter.
          pcbHoleDiameter: 2.2,
        },
      ],
    }),
  ).toThrow(
    "EN1.H1: the PCB hole is 2.2mm, which will not pass an M3 screw -- it needs at least 3.2mm",
  )
})

test("hardware carries the element that generated it, generically", () => {
  const enclosure = createFdmEnclosure({
    board,
    mounts: [
      {
        id: "EN1.H1",
        fastens: "board",
        anchor: { x: -15, y: -8 },
        thread: "m3",
        fastening: "heat_set_insert",
        head: "socketcap",
        // A pair of strings, not a `pcbHoleId`: the enclosure generates bosses
        // from holes, but the same field has to carry the pin header behind a
        // jumper wire without the contract changing shape.
        generatedBy: { elementType: "pcb_hole", elementId: "pcb_hole_0" },
      },
      {
        id: "EN1.corner",
        fastens: "lid",
        anchor: { x: 15, y: 8 },
        thread: "m3",
        fastening: "heat_set_insert",
        head: "countersunk",
      },
    ],
  })

  const byMount = (id: string) =>
    enclosure.hardware.filter((piece) => piece.mountId === id)

  for (const piece of byMount("EN1.H1")) {
    expect(piece.generatedBy).toEqual({
      elementType: "pcb_hole",
      elementId: "pcb_hole_0",
    })
  }
  // Absent rather than pointing at the enclosure: a lid screw is caused by the
  // enclosure, which is already the assembly that consumes it.
  for (const piece of byMount("EN1.corner")) {
    expect(piece.generatedBy).toBeUndefined()
  }
})
