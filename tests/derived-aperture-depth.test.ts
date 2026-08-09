import { expect, test } from "bun:test"
import { DEFAULT_FDM_DESIGN_RULES } from "../lib/fdm/design-rules"
import { getDerivedApertureDepth } from "../lib/fdm/get-derived-aperture-depth"
import { resolveFdmEnclosureDimensions } from "../lib/fdm/resolve-fdm-enclosure-dimensions"
import { resolveFdmEnclosureFrame } from "../lib/fdm/resolve-fdm-enclosure-frame"

const board = { width: 60, height: 40, thickness: 1.6 }
const frame = resolveFdmEnclosureFrame({
  board,
  dimensions: resolveFdmEnclosureDimensions({
    input: { board, apertures: [] },
    rules: DEFAULT_FDM_DESIGN_RULES,
  }),
})

/** A 15mm pushbutton plunger: most of it lives outside the box. */
const tallButton = { aboveBoardHeight: 15, size: { x: 9.5, y: 6.05, z: 15 } }

/**
 * The cutting primitive already spans the plate. Its inward projection starts
 * at the plate's inner surface, while `aboveBoardHeight` is measured from the
 * board -- a cavity away. Taking either the reach raw or measuring from the
 * outer surface puts the end of the cut too deep.
 */
test("a lid aperture is derived in the lid's own datum, not the board's", () => {
  const depth = getDerivedApertureDepth({
    face: "z_pos",
    boardSide: "top",
    componentBody: tallButton,
    frame,
  })

  expect(depth).toBeCloseTo(frame.seamZ - frame.boardTopZ)
  // Which is emphatically not the part's reach above the board.
  expect(depth).toBeLessThan(15)
})

test("a floor aperture is derived from the floor's inner surface", () => {
  expect(
    getDerivedApertureDepth({
      face: "z_neg",
      boardSide: "bottom",
      componentBody: tallButton,
      frame,
    }),
  ).toBeCloseTo(frame.boardBottomZ - frame.floorTopZ)
})

/**
 * The cut is the span from the mounting plane to whichever is higher, the top
 * of the part or the outer face of the plate. Both ends are load-bearing, so
 * both are pinned across parts that are far shorter and far taller than the
 * cavity:
 *
 * - the upper end (the `max`) is why a 1mm part still gets a hole clean through
 *   the plate, rather than a cut 1mm deep in a 2mm lid;
 * - the lower end is why a 400mm part does not reach the plate at the far end.
 */
test.each([1, 15, 400])(
  "a derived horizontal cut pierces the lid and stops at the board for a %smm part",
  (aboveBoardHeight) => {
    const dimensions = resolveFdmEnclosureDimensions({
      input: { board, apertures: [] },
      rules: DEFAULT_FDM_DESIGN_RULES,
    })
    const depth = getDerivedApertureDepth({
      face: "z_pos",
      boardSide: "top",
      componentBody: { aboveBoardHeight },
      frame,
    })!

    // The complete tool still reaches from the outer surface to the board;
    // plate thickness and inward projection supply distinct parts of that span.
    expect(depth + dimensions.lidThickness).toBeCloseTo(
      frame.totalHeight - frame.boardTopZ,
    )
    // And no further than the plane the part stands on: plate thickness is
    // already supplied by the cutting primitive itself.
    expect(frame.seamZ - depth).toBeCloseTo(frame.boardTopZ)
  },
)

/**
 * Side faces are unchanged: there the part's reach and the wall's inboard
 * direction share a datum, so the envelope is already in the right frame.
 */
test("a side aperture still uses the part's own extent", () => {
  expect(
    getDerivedApertureDepth({
      face: "y_pos",
      componentBody: { size: { x: 9.5, y: 6.05, z: 15 }, rotation: 0 },
      frame,
    }),
  ).toBeCloseTo(6.05)
})

test("no measured body leaves the depth underived", () => {
  expect(
    getDerivedApertureDepth({
      face: "z_pos",
      componentBody: { footprint: { width: 6, height: 6 } },
      frame,
    }),
  ).toBeUndefined()
})
