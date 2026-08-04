import { expect, test } from "bun:test"
import { getApertureHeightDatum } from "../lib/apertures/get-aperture-height-datum"

/**
 * Where a side-face opening sits before any authored offset. The part decides:
 * an opening is centred on the body it serves.
 */
test("an opening centres on the part's body above the board", () => {
  expect(
    getApertureHeightDatum({
      shape: "rect",
      face: "y_pos",
      width: 9,
      height: 3.6,
      margin: 0.5,
      center: { x: 0, y: 0 },
      componentBody: { aboveBoardHeight: 11 },
    }),
  ).toBeCloseTo(5.5)
})

/**
 * Without measured bounds there is nothing to centre on, so it falls back to
 * half the opening's own margin-inflated height -- which rests the opening's
 * lower edge on the mounting surface.
 */
test("without measured bounds it rests the lower edge on the board", () => {
  expect(
    getApertureHeightDatum({
      shape: "pill",
      face: "y_pos",
      width: 9,
      height: 3.6,
      margin: 0.5,
      center: { x: 0, y: 0 },
    }),
  ).toBeCloseTo(2.3)

  expect(
    getApertureHeightDatum({
      shape: "circle",
      face: "x_neg",
      radius: 2,
      margin: 0.25,
      center: { y: 0, x: 0 },
    }),
  ).toBeCloseTo(2.25)
})

/**
 * `size.z` is deliberately NOT a fallback: it spans the pins and any
 * through-board shell, so centring on it would sit the opening too high.
 */
test("an unmeasured body does not centre on size.z", () => {
  expect(
    getApertureHeightDatum({
      shape: "rect",
      face: "y_neg",
      width: 6,
      height: 12,
      center: { x: 0, y: 0 },
      componentBody: { size: { x: 4, y: 4, z: 40 } },
    }),
  ).toBeCloseTo(6)
})
