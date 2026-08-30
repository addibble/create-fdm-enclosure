import { expect, test } from "bun:test"
import { getScrewHeadSpec, resolveScrewLength } from "../lib/hardware"

/**
 * A stack that needs 8.7mm of screw: 2mm lid + 1.2mm gap + 5.5mm engagement.
 * The nearest stocked M3 lengths either side are 8 and 10, so every case below
 * is decided by the rounding rules rather than by arithmetic that happens to
 * land on a stocked size.
 */
const stack = {
  thread: "M3",
  clampedThicknessMm: 3.2,
  engagementMm: 5.5,
  label: "EN1.corner",
} as const

test("a derived length is rounded up to a stocked length, not to a round number", () => {
  const resolved = resolveScrewLength({
    ...stack,
    headSpec: getScrewHeadSpec("M3", "socket_cap"),
    headRecess: "none",
    maxUnderHeadLengthMm: 12,
  })

  expect(resolved.requiredUnderHeadLengthMm).toBeCloseTo(8.7)
  expect(resolved.designatedLengthMm).toBe(10)
  // Rounding up buys extra engagement; it never buys less than was required.
  expect(resolved.engagementMm).toBeCloseTo(6.8)
})

test("a counterbore buries the head, so the screw needs less length under it", () => {
  const resolved = resolveScrewLength({
    ...stack,
    headSpec: getScrewHeadSpec("M3", "socket_cap"),
    headRecess: "counterbore",
    maxUnderHeadLengthMm: 12,
  })

  // 3.2 clamped - 3.0 head buried + 5.5 engagement = 5.7 -> stocked 6.
  expect(resolved.requiredUnderHeadLengthMm).toBeCloseTo(5.7)
  expect(resolved.designatedLengthMm).toBe(6)
  expect(resolved.underHeadLengthMm).toBe(6)
})

test("a countersunk screw's designated length includes its head", () => {
  const countersunk = resolveScrewLength({
    ...stack,
    headSpec: getScrewHeadSpec("M3", "countersunk"),
    headRecess: "countersink",
    maxUnderHeadLengthMm: 12,
  })
  const socketCap = resolveScrewLength({
    ...stack,
    headSpec: getScrewHeadSpec("M3", "socket_cap"),
    headRecess: "counterbore",
    maxUnderHeadLengthMm: 12,
  })

  // ISO 7046 measures a countersunk screw overall; ISO 4762 and friends measure
  // under the head. Both heads here are buried, so both consume the same stack
  // -- but the number that *names* the countersunk screw is one head height
  // larger, and treating them alike orders every countersunk screw 1.65mm short.
  expect(
    countersunk.designatedLengthMm - countersunk.underHeadLengthMm,
  ).toBeCloseTo(getScrewHeadSpec("M3", "countersunk").headHeightMm)
  expect(socketCap.designatedLengthMm - socketCap.underHeadLengthMm).toBe(0)

  // 3.2 clamped - 1.86 of ISO 10642 head buried + 5.5 engagement = 6.84 needed
  // under the head; the stocked 10mm screw then leaves 10 - 1.86 = 8.14 of it.
  expect(countersunk.requiredUnderHeadLengthMm).toBeCloseTo(6.84)
  expect(countersunk.designatedLengthMm).toBe(10)
  expect(countersunk.underHeadLengthMm).toBeCloseTo(8.14)
})

test("rounding up stops at the length that would bottom out", () => {
  const shallow = { ...stack, engagementMm: 4 }

  // 3.2 clamped + 4 engagement = 7.2, so 8 is the stocked length taken...
  expect(
    resolveScrewLength({
      ...shallow,
      headSpec: getScrewHeadSpec("M3", "socket_cap"),
      headRecess: "none",
      maxUnderHeadLengthMm: 8.5,
    }).designatedLengthMm,
  ).toBe(8)

  // ...and the same stack in a boss 1mm shallower has no answer at all, because
  // the bound is checked after rounding, which is the step that broke it.
  expect(() =>
    resolveScrewLength({
      ...shallow,
      headSpec: getScrewHeadSpec("M3", "socket_cap"),
      headRecess: "none",
      maxUnderHeadLengthMm: 7.5,
    }),
  ).toThrow("no stocked M3 screw fits this stack")
})

test("a stack no stocked screw fits is reported with both bounds", () => {
  expect(() =>
    resolveScrewLength({
      ...stack,
      headSpec: getScrewHeadSpec("M3", "socket_cap"),
      headRecess: "none",
      // Needs 8.7 to engage; bottoms out past 8.2. Nothing stocked is in between.
      maxUnderHeadLengthMm: 8.2,
    }),
  ).toThrow(
    "EN1.corner: no stocked M3 screw fits this stack -- it needs at least 8.7mm to engage and at most 8.2mm before it bottoms out, and the stocked lengths either side are 8mm and 10mm",
  )
})

test("an authored length is still held to the engagement rule", () => {
  expect(() =>
    resolveScrewLength({
      ...stack,
      headSpec: getScrewHeadSpec("M3", "socket_cap"),
      headRecess: "none",
      maxUnderHeadLengthMm: 12,
      authoredLengthMm: 6,
    }),
  ).toThrow(
    "EN1.corner: an authored M3x6 screw engages only 2.8mm of thread, but this stack needs 5.5mm",
  )
})

test("a vendor's own length series overrides the built-in one", () => {
  // "Which lengths exist" is a fact about a supplier. A vendor stocking only
  // even lengths must round to one of those, not to the catalogue's 9mm-free
  // default series -- which is the seam a hardware engine plugs into.
  const resolved = resolveScrewLength({
    ...stack,
    headSpec: getScrewHeadSpec("M3", "socket_cap"),
    headRecess: "none",
    maxUnderHeadLengthMm: 20,
    availableLengthsMm: [6, 12, 18],
  })

  // Needs 8.7; the built-in series would have given 10, this vendor gives 12.
  expect(resolved.designatedLengthMm).toBe(12)
})
