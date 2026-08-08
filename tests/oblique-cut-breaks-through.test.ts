import { expect, test } from "bun:test"
import * as jscadModeling from "@jscad/modeling"
import { executeJscadOperations } from "jscad-planner"
import { createFdmEnclosure } from "../lib"

/** A from-left part meeting its selected wall after a board-Z rotation. */
const enclosureWith = (rotation: number) => {
  const axisRadians = ((180 + rotation) * Math.PI) / 180
  return createFdmEnclosure({
    board: { width: 52, height: 36, thickness: 1.6 },
    apertures: [
      {
        shape: "circle" as const,
        face: "x_neg" as const,
        radius: 3.25,
        center: { x: -19, y: 6 },
        rotation,
        apertureAxisDirection: {
          x: Math.cos(axisRadians),
          y: Math.sin(axisRadians),
          z: 0,
        },
        depth: 6,
      },
    ],
  })
}

const baseGeom = (rotation: number) => {
  const part = enclosureWith(rotation).parts.find((p) => p.id === "base")!
  return executeJscadOperations(
    jscadModeling as any,
    part.jscadPlan as any,
  ) as any
}

/**
 * A tool that leans crosses the wall along a longer path and no longer meets
 * the outer surface flat: its trailing corner falls short of it. Relying on the
 * slack in `booleanTolerance` leaves a sliver of wall across part of the
 * opening -- a hole that looks right in section and is not open.
 */
test.each([0, -30, 30, -44, -45, 45])(
  "the opening is fully open through the wall at %s degrees",
  (rotation) => {
    const geom = baseGeom(rotation)
    const [mn] = jscadModeling.measurements.measureBoundingBox(geom)

    // A thin slab spanning the whole wall thickness at the opening's height.
    // Anything left inside the opening shows up as material here.
    const slab = jscadModeling.primitives.cuboid({
      size: [4, 0.4, 0.4],
      center: [mn[0] + 2, 6, 11],
    })
    const remaining = jscadModeling.measurements.measureVolume(
      jscadModeling.booleans.intersect(geom, slab) as any,
    )

    // Some wall remains beside the hole at a lean, which is expected; what must
    // not happen is the hole being blocked along its own axis. Compared against
    // the same probe with no aperture at all.
    expect(remaining).toBeLessThan(0.64 * 0.5)
  },
)

/**
 * `depth` is measured along the part's mating axis, so it means the same thing
 * whatever the angle: the relief behind the wall is what the part needs, not
 * what its rotation implies. Only the outboard end grows.
 */
test("leaning does not deepen the relief behind the wall", () => {
  const square = baseGeom(0)
  const leaning = baseGeom(-30)

  // A probe well inboard of the wall, on the aperture axis, at the depth the
  // authored 6mm relief reaches. Both must have cleared it; neither should have
  // cleared appreciably more than the other.
  const probe = (geom: any, x: number) =>
    jscadModeling.measurements.measureVolume(
      jscadModeling.booleans.intersect(
        geom,
        jscadModeling.primitives.cuboid({
          size: [0.4, 0.4, 0.4],
          center: [x, 6, 11],
        }),
      ) as any,
    )

  const [mn] = jscadModeling.measurements.measureBoundingBox(square)
  // Just inboard of where a 6mm relief ends: still solid in both.
  expect(probe(square, mn[0] + 9)).toBeCloseTo(probe(leaning, mn[0] + 9), 2)
})
