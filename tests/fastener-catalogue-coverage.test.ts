import { expect, test } from "bun:test"
import {
  getBomGroupKey,
  getScrewHeadSpec,
  getThreadSpec,
} from "../lib/hardware"

test("an unstocked thread/head combination is reported, not substituted", () => {
  // Button heads are a commodity from M3 up. Below that the catalogue has no
  // entry, and the whole point of a vendor-backed catalogue is that this is an
  // error rather than a quiet fallback to a neighbouring head style -- which
  // would change both the recess geometry and the BOM line while still
  // rendering a perfectly plausible enclosure.
  expect(() => getScrewHeadSpec("M2.5", "button")).toThrow(
    "No stocked M2.5 screw with a button head",
  )
  expect(() => getScrewHeadSpec("M2.5", "button")).toThrow(
    "Available head styles for M2.5: socket_cap, countersunk, pan",
  )

  expect(getScrewHeadSpec("M3", "button").headDiameterMm).toBe(5.7)
})

test("an unknown thread is an error rather than the nearest size", () => {
  expect(() => getThreadSpec("M3.5" as never)).toThrow(
    "M3.5 is not in the fastener catalogue. Available threads: M2, M2.5, M3, M4, M5",
  )
})

test("BOM lines are keyed by specification, never by part number", () => {
  // A designation names the part; a part number says where to buy one. Keying on
  // the latter would make the shape of the BOM depend on a lookup -- the same
  // design resolved on a day one vendor is out of stock would split one line of
  // eight into two of four -- so a part number is not part of the key and there
  // is no fallback to one.
  expect(getBomGroupKey("ISO 4762 M3x8")).toBe("spec:ISO 4762 M3x8")

  // A part with no standard is named by its manufacturer's designation, which
  // correctly does not group with a competitor's lookalike.
  expect(getBomGroupKey("Gore PMF100548")).toBe("spec:Gore PMF100548")
})
