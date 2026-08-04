import { expect, test } from "bun:test"
import { createApertureCutoutPlan } from "../lib"

/**
 * Placements arrive fully resolved: `center` is already projected onto the face
 * plane and width/height are already margin-inflated, so the geometry stage only
 * orients the cutting prism and translates it.
 *
 * Every tool is authored in the face-local frame and turned onto its face by a
 * single `rotate`, so the plan for a side aperture is always the same three
 * nodes: translate -> rotate -> shape. `aperture-face-axis-mapping.test.ts`
 * covers where those local axes actually land in the world.
 */
test("an aperture owns its shape and orientation on every face", () => {
  const pill = createApertureCutoutPlan({
    faceThickness: 2,
    booleanTolerance: 0.5,
    placement: {
      face: "y_pos",
      center: { x: 4, y: -14, z: 6 },
      width: 10,
      height: 4.6,
      inwardProjection: 0,
      rotation: 0,
      aperture: {
        shape: "pill",
        face: "y_pos",
        width: 9,
        height: 3.6,
        margin: 0.5,
        center: { x: 4, y: 0 },
        componentBody: { aboveBoardHeight: 4 },
      },
    },
  })
  const circle = createApertureCutoutPlan({
    faceThickness: 2,
    booleanTolerance: 0.5,
    placement: {
      face: "x_pos",
      center: { x: 22, y: -3, z: 7 },
      width: 5,
      height: 5,
      inwardProjection: 0,
      rotation: 0,
      aperture: {
        shape: "circle",
        face: "x_pos",
        radius: 2.5,
        center: { x: 0, y: -3 },
        componentBody: { aboveBoardHeight: 6 },
      },
    },
  })

  // The union is built flat in the local frame and rotated as one piece, rather
  // than each of the pill's three parts being oriented on its own.
  expect(pill.jscadPlan).toMatchObject({
    type: "translate",
    vector: [4, -14, 6],
    shape: {
      type: "rotate",
      angles: [Math.PI / 2, 0, 0],
      shape: { type: "union" },
    },
  })
  expect(circle.jscadPlan).toMatchObject({
    type: "translate",
    vector: [22, -3, 7],
    shape: {
      type: "rotate",
      angles: [Math.PI / 2, 0, Math.PI / 2],
      shape: { type: "cylinder", radius: 2.5, height: 3 },
    },
  })
})

test("a horizontal face cuts straight down Z with no rotation", () => {
  // A lid aperture pierces only the lid top plate, so its own thickness sets the
  // cut depth -- not the side wall thickness.
  const lidHole = createApertureCutoutPlan({
    faceThickness: 2,
    booleanTolerance: 0.5,
    placement: {
      face: "z_pos",
      center: { x: 7, y: -3, z: 21 },
      width: 6.6,
      height: 6.6,
      inwardProjection: 0,
      rotation: 0,
      aperture: {
        shape: "circle",
        face: "z_pos",
        radius: 3.3,
        center: { x: 7, y: -3 },
      },
    },
  })

  expect(lidHole.cutDepth).toBeCloseTo(3)
  expect(lidHole.jscadPlan).toMatchObject({
    type: "translate",
    vector: [7, -3, 21],
    // No `rotate` wrapper: the prism is authored along +Z already.
    shape: { type: "cylinder", radius: 3.3, height: 3 },
  })

  const floorHole = createApertureCutoutPlan({
    faceThickness: 2,
    booleanTolerance: 0.5,
    placement: {
      face: "z_neg",
      center: { x: -5, y: 2, z: 1 },
      width: 4,
      height: 3,
      inwardProjection: 0,
      rotation: 0,
      aperture: {
        shape: "rect",
        face: "z_neg",
        width: 4,
        height: 3,
        center: { x: -5, y: 2 },
      },
    },
  })

  // Rect on a horizontal face: extents land in X and Y, depth in Z.
  expect(floorHole.jscadPlan).toMatchObject({
    type: "translate",
    vector: [-5, 2, 1],
    shape: { type: "cuboid", size: [4, 3, 3] },
  })
})
