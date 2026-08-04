import { expect, test } from "bun:test"
import * as jscadModeling from "@jscad/modeling"
import * as geom3 from "@jscad/modeling/src/geometries/geom3"
import { executeJscadOperations } from "jscad-planner"
import { createFdmEnclosure, resolveFdmEnclosureProblem } from "../lib"

const board = { width: 40, height: 24, thickness: 1.6 }

/** A tall vertical USB-A style opening: 13.2mm high on a 13.2mm body, so its
 * centre lands 6.6mm up. */
const tallAperture = {
  shape: "rect" as const,
  face: "y_pos" as const,
  width: 10,
  height: 13.2,
  center: { x: 0, y: 0 },
  componentBody: { aboveBoardHeight: 13.2 },
  depth: 10,
}
/** floor 2 + standoff 4 + board 1.6 = 7.6, + 6.6 + 13.2/2 */
const APERTURE_TOP = 20.8

const volumeOf = (plan: unknown) => {
  let total = 0
  const geometry = executeJscadOperations(
    jscadModeling as any,
    plan as any,
  ) as any
  for (const polygon of geom3.toPolygons(geometry)) {
    const [a, ...rest] = polygon.vertices
    for (let i = 1; i < rest.length; i++) {
      const b = rest[i - 1]!
      const c = rest[i]!
      total +=
        (a![0] * (b[1] * c[2] - b[2] * c[1]) -
          a![1] * (b[0] * c[2] - b[2] * c[0]) +
          a![2] * (b[0] * c[1] - b[1] * c[0])) /
        6
    }
  }
  return Math.abs(total)
}

/**
 * An inferred depth is the board stack and nothing else, so `topHeadroom` is a
 * real lever.
 *
 * Growing it to contain every opening put the lid underside exactly at the top of
 * the tallest opening -- `tallestApertureTop + margin - lidThickness` -- so a part
 * could never poke through the lid and lowering `topHeadroom` did nothing.
 */
test("apertures do not inflate an inferred depth", () => {
  const resolveWith = (topHeadroom: number) =>
    resolveFdmEnclosureProblem({
      board,
      topHeadroom,
      apertures: [tallAperture],
    })

  // floor 2 + standoff 4 + board 1.6 + topHeadroom + lid 2
  expect(resolveWith(8).dimensions.depth).toBeCloseTo(17.6)
  expect(resolveWith(2).dimensions.depth).toBeCloseTo(11.6)

  // The tall opening tops out at 20.8, well above either box: it overruns rather
  // than forcing the shell taller.
  const shallow = resolveWith(2)
  const placement = shallow.apertures[0]!
  expect(placement.center.z + placement.height / 2).toBeCloseTo(APERTURE_TOP)
  expect(APERTURE_TOP).toBeGreaterThan(shallow.dimensions.depth)

  // And lowering topHeadroom genuinely lowers the lid, which was the whole point.
  expect(resolveWith(2).frame.seamZ).toBeLessThan(resolveWith(8).frame.seamZ)
})

/**
 * An explicit depth is the author saying "this is how tall the box is". The
 * opening may then straddle the base/lid seam, and may even run past the top of
 * the enclosure so a part pokes out of a deliberately short box.
 */
test.each([
  ["crosses the seam", 22, false],
  ["pokes out of the top", 20, true],
  ["pokes well out of the top", 18, true],
] as const)(
  "an explicit depth lets a tall opening %s",
  (_label, depth, expectedOverrun) => {
    const input = { board, depth, topHeadroom: 0, apertures: [tallAperture] }
    const resolved = resolveFdmEnclosureProblem(input)
    const placement = resolved.apertures[0]!
    const openingTop = placement.center.z + placement.height / 2

    expect(openingTop).toBeCloseTo(APERTURE_TOP)
    expect(openingTop).toBeGreaterThan(resolved.frame.seamZ)
    expect(openingTop > depth).toBe(expectedOverrun)

    // Both shells lose material: the base wall below the seam, and the lid's
    // plate edge plus its lip above and behind it.
    const cut = createFdmEnclosure(input)
    const bare = createFdmEnclosure({ ...input, apertures: [] })
    for (const id of ["base", "lid"] as const) {
      const withCut = volumeOf(cut.parts.find((p) => p.id === id)!.jscadPlan)
      const withoutCut = volumeOf(
        bare.parts.find((p) => p.id === id)!.jscadPlan,
      )
      expect(withCut).toBeLessThan(withoutCut)
    }
  },
)

test("an opening that misses the enclosure entirely is still rejected", () => {
  expect(() =>
    resolveFdmEnclosureProblem({
      board,
      depth: 14,
      topHeadroom: 0,
      apertures: [{ ...tallAperture, heightDimensionOffset: 30 - 6.6 }],
    }),
  ).toThrow("sits entirely above the enclosure")
})
