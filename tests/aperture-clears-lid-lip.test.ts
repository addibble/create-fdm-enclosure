import { expect, test } from "bun:test"
import * as jscadModeling from "@jscad/modeling"
import * as geom3 from "@jscad/modeling/src/geometries/geom3"
import { executeJscadOperations } from "jscad-planner"
import { createFdmEnclosure, resolveFdmEnclosureProblem } from "../lib"

/**
 * Cutting only through the face an aperture enters leaves everything behind it
 * intact -- and the split shell puts material there. The lid lip hangs just
 * inboard of the base side walls, so a connector deep enough to reach it used to
 * be obstructed by a feature the opening never touched.
 *
 * The cut is therefore projected inboard, and every aperture is subtracted from
 * every part, so a cut entering a base wall still removes the lid's lip.
 */

// A tall aperture whose top reaches into the lip band, on a shallow box so the
// lip and the opening overlap in Z.
const input = {
  board: { width: 40, height: 24, thickness: 1.6 },
  // Depth is pinned so the with/without-aperture comparison below comes from the
  // cut alone: an inferred depth would also grow to fit the aperture, changing
  // the lid and lip along with it.
  depth: 14.6,
  topHeadroom: 4,
  lidLipDepth: 4,
  apertures: [
    {
      shape: "rect" as const,
      face: "y_pos" as const,
      width: 10,
      height: 6,
      center: { x: 0, y: 0 },
      componentBody: { aboveBoardHeight: 4 },
    },
  ],
}

const geometryOf = (plan: unknown) =>
  executeJscadOperations(jscadModeling as any, plan as any) as any

/** Signed volume of a plan, via the divergence theorem over its triangles. */
const volumeOf = (plan: unknown) => {
  let total = 0
  for (const polygon of geom3.toPolygons(geometryOf(plan))) {
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

test("the cut is projected inboard past the face it enters", () => {
  const resolved = resolveFdmEnclosureProblem(input)
  const placement = resolved.apertures[0]!

  // 0.15 sliding-fit half-gap + 1.4 lip wall + 0.5 tolerance = 2.05mm.
  expect(placement.inwardProjection).toBeCloseTo(2.05)

  const cut = createFdmEnclosure(input).apertures[0]!
  // wall 2 + 2x0.5 tolerance + 2.05 projection
  expect(cut.cutDepth).toBeCloseTo(5.05)
})

test("depth deepens the projection for a deep part", () => {
  const deep = resolveFdmEnclosureProblem({
    ...input,
    apertures: [{ ...input.apertures[0]!, depth: 12 }],
  })
  expect(deep.apertures[0]!.inwardProjection).toBeCloseTo(12)

  // A part shallower than the shell's own inboard features still clears them.
  const shallow = resolveFdmEnclosureProblem({
    ...input,
    apertures: [{ ...input.apertures[0]!, depth: 0.2 }],
  })
  expect(shallow.apertures[0]!.inwardProjection).toBeCloseTo(2.05)
})

/**
 * A horizontal face is authored the same way as any other: the depth given is
 * the depth cut. Inboard is a *short* direction there -- the lid has the floor
 * only a couple of centimetres below -- so a deep enough opening does reach the
 * far shell, and is meant to. That consequence is the author's to avoid (by
 * giving a shallower depth, or letting the depth be inferred so the box grows),
 * not something the geometry silently corrects by cutting a shallower hole than
 * was asked for.
 */
test.each([
  // The lid's lip is a feature the opening must get past to be a hole at all,
  // so the z_pos face takes the greater of the depth and the lip.
  ["z_pos", 15],
  ["z_neg", 15],
] as const)("a %s aperture is cut to its authored depth", (face, expected) => {
  const vertical = {
    ...input,
    apertures: [
      {
        shape: "rect" as const,
        face,
        width: 6,
        height: 6,
        center: { x: 0, y: 0 },
        depth: 15,
      },
    ],
  }
  const resolved = resolveFdmEnclosureProblem(vertical)
  expect(resolved.apertures[0]!.inwardProjection).toBeCloseTo(expected)

  // 15mm of travel into a 14.6mm box: the tool passes clean through the far
  // shell rather than stopping inside it.
  const cut = createFdmEnclosure(vertical).apertures[0]!
  const originZ = (cut.jscadPlan as any).vector[2]
  const [low, high] = [
    originZ - cut.cutDepth / 2,
    originZ + cut.cutDepth / 2,
  ] as const
  const { floorThickness, depth, lidThickness } = resolved.dimensions
  if (face === "z_pos") {
    expect(low).toBeLessThan(floorThickness)
  } else {
    expect(high).toBeGreaterThan(depth - lidThickness)
  }
})

test("a lid aperture is projected past the lip even with no depth given", () => {
  const resolved = resolveFdmEnclosureProblem({
    ...input,
    apertures: [
      {
        shape: "rect" as const,
        face: "z_pos" as const,
        width: 6,
        height: 6,
        center: { x: 0, y: 0 },
      },
    ],
  })
  // Nothing authored, so the lip alone sets the reach.
  expect(resolved.apertures[0]!.inwardProjection).toBeCloseTo(4)
})

test("a base-wall aperture still removes material from the lid's lip", () => {
  const lidOf = (apertures: unknown[]) =>
    createFdmEnclosure({ ...input, apertures: apertures as any }).parts.find(
      (p) => p.id === "lid",
    )!.jscadPlan

  const withoutAperture = volumeOf(lidOf([]))
  const withAperture = volumeOf(lidOf(input.apertures))

  // The lip belongs to the LID, and this aperture enters a wall of the BASE.
  // Routing the cut only to the part whose face it enters would leave the lid
  // untouched -- and the lip would sit in the connector's way.
  expect(withAperture).toBeLessThan(withoutAperture)
  // Sanity: the base loses material too.
  const baseVolume = (apertures: unknown[]) =>
    volumeOf(
      createFdmEnclosure({ ...input, apertures: apertures as any }).parts.find(
        (p) => p.id === "base",
      )!.jscadPlan,
    )
  expect(baseVolume(input.apertures)).toBeLessThan(baseVolume([]))
})
