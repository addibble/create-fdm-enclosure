import { expect, test } from "bun:test"
import { createFdmEnclosure } from "../lib"

test("rejects enclosure dimensions that cannot contain the board", () => {
  expect(
    () =>
      createFdmEnclosure({
        board: { width: 40, height: 24, thickness: 1.6 },
        width: 42,
      }),
    // The bound is useless on its own -- an author cannot tell whether to widen
    // the box, thin the wall or cut the clearance -- so the breakdown that
    // produced it is part of the message.
  ).toThrow(
    "width must be at least 46mm to fit the 40mm board inside 2mm walls with 1mm clearance on each side, but is 42mm",
  )
})

test("rejects a non-finite aperture extent above the board", () => {
  expect(() =>
    createFdmEnclosure({
      board: { width: 40, height: 24, thickness: 1.6 },
      apertures: [
        {
          shape: "circle",
          face: "y_pos",
          radius: 2,
          center: { x: 0, y: 0 },
          heightDimensionOffset: Number.NaN,
        },
      ],
    }),
  ).toThrow("heightDimensionOffset must be finite")
})

test("rejects an aperture that intersects the enclosure floor", () => {
  // The board sits standoffHeight above the floor, so an aperture only reaches
  // the floor when it is tall enough to hang below the board. With no measured
  // body the datum rests the opening's lower edge on the board top, so pulling
  // it down by half its own height re-centres it ON the board top: a 24mm-tall
  // opening then spans down to z = -4.4, well under the 2mm floor.
  expect(() =>
    createFdmEnclosure({
      board: { width: 40, height: 24, thickness: 1.6 },
      depth: 40,
      apertures: [
        {
          shape: "rect",
          face: "y_pos",
          width: 6,
          height: 24,
          center: { x: 0, y: 0 },
          heightDimensionOffset: -12,
        },
      ],
    }),
  ).toThrow(
    "intersects the enclosure floor: its lowest edge is at -4.4mm but the floor top is at 2mm",
  )
})
