import { expect, test } from "bun:test"
import { DEFAULT_FDM_DESIGN_RULES, resolveFdmEnclosureProblem } from "../lib"

test("resolution decides every default, fallback, and placement up front", () => {
  const resolved = resolveFdmEnclosureProblem({
    board: { width: 40, height: 24, thickness: 1.6 },
    apertures: [
      // No body and no offset: the fallback datum is resolved here, once.
      {
        shape: "pill",
        face: "y_pos",
        width: 9,
        height: 3.6,
        margin: 0.5,
        center: { x: 0, y: 0 },
      },
      {
        shape: "circle",
        face: "x_neg",
        radius: 3,
        center: { y: -2, x: 0 },
        componentBody: { aboveBoardHeight: 10 },
      },
    ],
  })

  expect(resolved.construction).toBe("fdm_box")
  expect(resolved.rules).toEqual(DEFAULT_FDM_DESIGN_RULES)
  expect(resolved.dimensions).toMatchObject({
    width: 46,
    height: 30,
    wallThickness: 2,
    floorThickness: 2,
    lidThickness: 2,
    standoffHeight: 4,
    topHeadroom: 6,
    lidLipDepth: 4,
  })
  expect(resolved.frame.boardTopZ).toBeCloseTo(7.6)

  // Placements carry decided values, so no geometry stage re-derives them.
  expect(resolved.apertures[0]).toMatchObject({
    face: "y_pos",
    width: 10,
    height: 4.6,
  })
  expect(resolved.apertures[0]!.center.z).toBeCloseTo(7.6 + 2.3)
  expect(resolved.apertures[1]).toMatchObject({
    face: "x_neg",
    width: 6,
    height: 6,
  })
  expect(resolved.apertures[1]!.center.z).toBeCloseTo(7.6 + 5)
  // The tangent coordinate survives; the normal coordinate is pinned to the face.
  expect(resolved.apertures[1]!.center.y).toBeCloseTo(-2)
  expect(resolved.apertures[1]!.center.x).toBeCloseTo(-(46 / 2 - 1))
})

test("design rules are injectable without touching geometry code", () => {
  const resolved = resolveFdmEnclosureProblem({
    board: { width: 40, height: 24, thickness: 1.6 },
    fdmRules: { standoffHeight: 1, topHeadroom: 10, slidingFitClearance: 0.6 },
  })

  expect(resolved.rules.slidingFitClearance).toBe(0.6)
  expect(resolved.dimensions.standoffHeight).toBe(1)
  expect(resolved.dimensions.topHeadroom).toBe(10)
  // Untouched rules keep their defaults.
  expect(resolved.rules.booleanTolerance).toBe(
    DEFAULT_FDM_DESIGN_RULES.booleanTolerance,
  )
  // An explicitly authored dimension still wins over the rule fallback.
  expect(
    resolveFdmEnclosureProblem({
      board: { width: 40, height: 24, thickness: 1.6 },
      fdmRules: { standoffHeight: 1 },
      standoffHeight: 7,
    }).dimensions.standoffHeight,
  ).toBe(7)
})
