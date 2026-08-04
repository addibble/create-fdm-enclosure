import { expect, test } from "bun:test"
import { resolveFdmEnclosureProblem } from "../lib"

const boardThickness = 1.6
const base = {
  board: { width: 40, height: 24, thickness: boardThickness },
  floorThickness: 2,
  standoffHeight: 7,
}
// floor 2 + standoff 7 => board bottom 9, board top 10.6
const BOARD_BOTTOM_Z = 9
const BOARD_TOP_Z = BOARD_BOTTOM_Z + boardThickness

const aperture = (overrides: Record<string, unknown>): any => ({
  shape: "rect",
  face: "y_pos",
  width: 6,
  height: 3,
  center: { x: 0, y: 0 },
  ...overrides,
})

/**
 * Both the datum and `heightDimensionOffset` run outward from the part's own
 * mounting surface, so the same authored numbers are correct on either side of
 * the board. That is the point: they describe the part, not its placement.
 *
 * A 10mm body centres the opening 5mm out; the offset moves it from there.
 */
const body = { componentBody: { aboveBoardHeight: 6 } }

test("the datum is the mounting surface, and offsets run outward from it", () => {
  const resolved = resolveFdmEnclosureProblem({
    ...base,
    apertures: [
      aperture({ ...body }),
      aperture({ ...body, heightDimensionOffset: 1.5 }),
      aperture({ ...body, heightDimensionOffset: -1.5 }),
      aperture({ ...body, boardSide: "bottom" }),
      aperture({ ...body, boardSide: "bottom", heightDimensionOffset: 1.5 }),
    ],
  })
  const z = resolved.apertures.map((a) => a.center.z)

  // Top-mounted: up from the board top, centred on the body.
  expect(z[0]).toBeCloseTo(BOARD_TOP_Z + 3)
  expect(z[1]).toBeCloseTo(BOARD_TOP_Z + 3 + 1.5)
  // Signed: a negative offset pulls the opening back toward the board.
  expect(z[2]).toBeCloseTo(BOARD_TOP_Z + 3 - 1.5)

  // Bottom-mounted: down from the board bottom, same authored numbers.
  expect(z[3]).toBeCloseTo(BOARD_BOTTOM_Z - 3)
  expect(z[4]).toBeCloseTo(BOARD_BOTTOM_Z - 3 - 1.5)
})

test("boardSide defaults to top", () => {
  const resolved = resolveFdmEnclosureProblem({
    ...base,
    apertures: [aperture({ ...body, heightDimensionOffset: 1 })],
  })
  expect(resolved.apertures[0]!.center.z).toBeCloseTo(BOARD_TOP_Z + 3 + 1)
})

/**
 * A cable jacket fatter than the connector needs the opening to reach past the
 * board, which means a negative offset. The only real limit is the floor.
 */
test("a negative extent pulls the opening below its mounting surface", () => {
  const resolved = resolveFdmEnclosureProblem({
    ...base,
    apertures: [aperture({ heightDimensionOffset: -3, height: 4 })],
  })
  const { center, height } = resolved.apertures[0]!

  expect(center.z).toBeCloseTo(BOARD_TOP_Z + 2 - 3)
  // Reaches below the board bottom, which is the whole point.
  expect(center.z - height / 2).toBeLessThan(BOARD_BOTTOM_Z)
  // ...but still clears the floor.
  expect(center.z - height / 2).toBeGreaterThan(2)
})

test("a negative extent that reaches the floor is still rejected", () => {
  expect(() =>
    resolveFdmEnclosureProblem({
      ...base,
      apertures: [aperture({ heightDimensionOffset: -9, height: 4 })],
    }),
  ).toThrow("intersects the enclosure floor")
})
