import { expect, test } from "bun:test"
import * as jscad from "@jscad/modeling"
import type { JscadOperation } from "jscad-planner"
import { createApertureCutoutPlan } from "../lib"
import { executeApertureTestSolid as executeSolid } from "./fixtures/execute-aperture-solid"

test("a matrix tool preserves local roll then face basis then world incidence", () => {
  const cutout = createApertureCutoutPlan({
    faceThickness: 2,
    booleanTolerance: 0.1,
    placement: {
      aperture: {
        shape: "rect",
        face: "x_neg",
        width: 9,
        height: 4,
        center: { x: -20, y: 5 },
      },
      face: "x_neg",
      center: { x: -20, y: 5, z: 8 },
      width: 9,
      height: 4,
      rotation: 23,
      incidenceDegrees: 30,
      inwardProjection: 6,
    },
  })
  // The pre-matrix public operation sequence is the compatibility reference.
  // This offset lies on the oblique axis, not the unrotated wall normal.
  const legacy: JscadOperation = {
    type: "translate",
    vector: [-17.401923788646684, 6.5, 8],
    shape: {
      type: "rotate",
      angles: [0, 0, Math.PI / 6],
      shape: {
        type: "rotate",
        angles: [Math.PI / 2, 0, Math.PI / 2],
        shape: {
          type: "rotate",
          angles: [0, 0, (23 * Math.PI) / 180],
          shape: { type: "cuboid", size: [9, 4, cutout.cutDepth] },
        },
      },
    },
  }
  const actual = executeSolid(JSON.parse(JSON.stringify(cutout.jscadPlan)))
  const expected = executeSolid(legacy)
  for (const [first, second] of [
    [actual, expected],
    [expected, actual],
  ] as const) {
    expect(
      Math.abs(
        jscad.measurements.measureVolume(
          jscad.booleans.subtract(first, second),
        ),
      ),
    ).toBeLessThan(1e-6)
  }

  const wrongOrder = executeSolid({
    type: "translate",
    vector: legacy.vector,
    shape: {
      type: "rotate",
      angles: [Math.PI / 2, 0, Math.PI / 2],
      shape: {
        type: "rotate",
        angles: [0, 0, (53 * Math.PI) / 180],
        shape: { type: "cuboid", size: [9, 4, cutout.cutDepth] },
      },
    },
  })
  expect(
    Math.abs(
      jscad.measurements.measureVolume(
        jscad.booleans.subtract(actual, wrongOrder),
      ),
    ),
  ).toBeGreaterThan(1)
})
