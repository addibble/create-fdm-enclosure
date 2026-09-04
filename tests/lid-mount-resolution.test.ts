import { expect, test } from "bun:test"
import { createFdmEnclosure } from "../lib"

const board = { width: 40, height: 24, thickness: 1.6 }

const lidMount = (
  lidColumn?: "printed" | "spacer" | "none",
  head: "countersunk" | "socket_cap" = "countersunk",
) =>
  createFdmEnclosure({
    board,
    mounts: [
      {
        id: "EN1.H1",
        // The same PCB hole a board mount would use. A lid screw costs no floor
        // area: it reuses a hole the board already has, in space the board has
        // already cleared -- which is why there is no free-standing corner
        // column and no rule growing the box in XY to make room for one.
        fastens: "lid",
        anchor: { x: -15, y: -8 },
        thread: "M3",
        fastening: "heat_set_insert",
        head,
        lidColumn,
      },
    ],
  })

test("a lid screw reaches from the lid's outer face down to the same floor boss", () => {
  const enclosure = lidMount()
  const [mount] = enclosure.mounts

  // The boss is identical to a board mount's: floor to the underside of the
  // board. What differs is how far the screw reaches past it.
  expect(mount!.bossBottomZ).toBeCloseTo(enclosure.dimensions.floorThickness)
  expect(mount!.bossTopZ).toBeCloseTo(enclosure.frame.boardBottomZ)
  // The head seat is the lid's outer face LESS whatever recess is cut for the
  // head. This mount is countersunk by default, so the cone sinks the seat by
  // the head's own height -- which is the point of a countersink, and the part
  // has to be placed there or it renders proud of the hole made for it.
  // Sunk by the head's REAL height above the datum -- the cone from its actual
  // edge down to the shank -- not by ISO's k, which measures to a theoretical
  // corner 0.59mm further up and would bury the head that much too deep.
  const coneHeightMm = (mount!.headSpec.headDiameterMm - 3) / 2 // 90 degrees: 1mm down per 1mm in
  expect(mount!.headSeatZ).toBeCloseTo(
    enclosure.frame.totalHeight - coneHeightMm,
  )
  // A cap head takes no recess by default, so its seat IS the outer face.
  expect(lidMount(undefined, "socket_cap").mounts[0]!.headSeatZ).toBeCloseTo(
    enclosure.frame.totalHeight,
  )

  // Spans lid plate + headroom + board: 15.6 total - 6.0 board bottom = 9.6,
  // less the 1.65 buried countersunk head, plus 3.0 of insert thread = 10.95
  // under the head. Countersunk length is measured overall, so 10.95 + 1.65 =
  // 12.6 -> the next stocked M3, which is 14.
  //
  // 14 rather than 16 matters: 16 would penetrate 6.4mm into a boss with only
  // 5.2mm of bore before the floor keep-back, and is refused. The window here is
  // 12.6 to 14.8, and finding it needed 14mm to be in the catalogue at all --
  // the first draft of the length series skipped from 12 to 16 and made this
  // perfectly ordinary stack unbuildable.
  expect(mount!.screwLength.designatedLengthMm).toBe(14)
  // A 4mm standoff over a 2mm floor leaves 4.7mm of bore once the melt relief
  // is kept back, so the 5.7mm standard insert does not fit and the short one is
  // selected.
  expect(mount!.insert?.series).toBe("short")

  // One screw, one insert -- not two of each. The lid and the board are held by
  // the same fastener.
  expect(enclosure.hardware.map((piece) => piece.role)).toEqual([
    "screw",
    "insert",
  ])
})

test("the board-to-lid column is printed on the lid, and defaults to being there", () => {
  const withColumn = lidMount()
  const withoutColumn = lidMount("none")

  expect(withColumn.mounts[0]!.lidColumn).toEqual({
    bottomZ: withColumn.frame.boardTopZ,
    topZ: withColumn.frame.totalHeight - withColumn.dimensions.lidThickness,
    diameterMm: withColumn.mounts[0]!.bossDiameterMm,
  })
  expect(withoutColumn.mounts[0]!.lidColumn).toBeUndefined()

  // The column changes what is clamped, not how long the screw is: it fills a
  // span the screw already had to cross either way.
  expect(withColumn.mounts[0]!.screwLength.designatedLengthMm).toBe(
    withoutColumn.mounts[0]!.screwLength.designatedLengthMm,
  )
})

test("the enclosure does not grow to accommodate a lid mount", () => {
  // 40 + 2 walls + 1 clearance each side. A lid screw through a board hole adds
  // nothing, which is the whole reason for preferring it to a corner column.
  expect(lidMount().dimensions.width).toBeCloseTo(46)
  expect(lidMount().dimensions.height).toBeCloseTo(30)
})

test("a counterbore too deep for the lid grows it, and says so when it cannot", () => {
  // An M3 countersink is a 90-degree cone from the head's 5.6mm sharp diameter
  // down to the 3.4mm clearance hole: 1.1mm deep, which the default 2mm lid
  // carries with room to spare.
  expect(lidMount().dimensions.lidThickness).toBe(2)

  // A counterbore is the head's full height -- 3mm for an M3 cap head -- so
  // cutting one into a 2mm lid would open a hole the head falls through.
  const counterbored = createFdmEnclosure({
    board,
    mounts: [
      {
        id: "EN1.H1",
        fastens: "lid",
        anchor: { x: -15, y: -8 },
        thread: "M3",
        fastening: "heat_set_insert",
        head: "socket_cap",
        headRecess: "counterbore",
      },
    ],
  })
  expect(counterbored.dimensions.lidThickness).toBeCloseTo(3.8)
})

test("lidColumn on a board mount is rejected rather than ignored", () => {
  expect(() =>
    createFdmEnclosure({
      board,
      mounts: [
        {
          id: "EN1.H1",
          fastens: "board",
          anchor: { x: -15, y: -8 },
          thread: "M3",
          fastening: "heat_set_insert",
          head: "socket_cap",
          lidColumn: "printed",
        },
      ],
    }),
  ).toThrow(
    "EN1.H1: lidColumn only applies to a mount that fastens the lid, and this one fastens the board",
  )
})

test("a spacer whose length matches a stocked piece is bought as one", () => {
  // The board-to-lid gap IS the headroom, and the default headroom is 6mm --
  // which is a stocked nylon spacer length, so no cutting is needed.
  const [spacer] = lidMount("spacer").hardware.filter(
    (piece) => piece.role === "spacer",
  )

  expect(spacer!.designation).toBe("spacer nylon 6mm x 3.2mm x 6mm")
  // No printed column: the bought tube does that job instead.
  expect(lidMount("spacer").mounts[0]!.lidColumn).toBeUndefined()
})

test("cut spacers of one length are one line with a count, not a length of stock", () => {
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
  expect(spacers).toHaveLength(2)

  // Cut to the gap, so the enclosure keeps the headroom it needs rather than
  // rounding its geometry to a vendor's inventory -- and the designation names
  // the cut length, so pieces of one length group into one line with a count.
  // Sixteen 8.2mm pieces and twelve 9.1mm pieces are two lines, not one length.
  // How many 300mm rods that takes, with kerf and trim, is the assembler's.
  for (const spacer of spacers) {
    expect(spacer.designation).toBe("spacer-stock nylon 6mm x 3.2mm cut 7.5mm")
  }
  expect(new Set(spacers.map((s) => s.bomGroupKey))).toEqual(
    new Set(["spec:spacer-stock nylon 6mm x 3.2mm cut 7.5mm"]),
  )
})

test("a gap no spacer can fill is refused with the reason", () => {
  expect(() =>
    createFdmEnclosure({
      board,
      topHeadroom: 1,
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
    }),
  ).toThrow(
    'EN1.H1: the gap between the board and the lid is 1mm, which is too short to fill with a spacer -- raise topHeadroom or use lidColumn="printed"',
  )
})

test("a countersunk head on a board mount is refused, not silently flattened", () => {
  // The head bears on the PCB, which the enclosure does not machine, so the cone
  // would bear on its rim. This used to resolve to headRecess "none" and render
  // a perfectly plausible enclosure with a screw that cannot clamp.
  const boardMount = (over: Record<string, unknown>) =>
    createFdmEnclosure({
      board,
      mounts: [
        {
          id: "EN1.H1",
          fastens: "board",
          anchor: { x: -15, y: -8 },
          thread: "M3",
          fastening: "heat_set_insert",
          head: "socket_cap",
          ...over,
        } as never,
      ],
    })

  expect(() => boardMount({ head: "countersunk" })).toThrow(
    "EN1.H1: a countersunk head cannot seat on a board mount",
  )
  expect(() => boardMount({ headRecess: "counterbore" })).toThrow(
    'EN1.H1: headRecess="counterbore" has nothing to cut on a board mount',
  )
  // The legal combination still resolves.
  expect(boardMount({}).mounts[0]!.headRecess).toBe("none")
})
