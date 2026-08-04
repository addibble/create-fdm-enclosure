import { expect, test } from "bun:test"
import {
  prefabBoardCircuitJson,
  prefabBoardInput,
} from "../fixtures/prefab-board-scene"
import { createFdmEnclosure } from "../lib"
import { renderEnclosureJscadGlb } from "../lib/preview/create-enclosure-preview-glb"

test("creates the prefab-board enclosure without mounting hardware", async () => {
  const output = createFdmEnclosure(prefabBoardInput)

  expect(output.parts.map((part) => part.id)).toEqual(["base", "lid"])
  expect(output.apertures).toHaveLength(7)
  expect(
    output.apertures.map(({ aperture }) => ({
      face: aperture.face,
      center: aperture.center,
    })),
  ).toEqual([
    { face: "y_pos", center: { x: -18, y: 0 } },
    { face: "x_pos", center: { y: -12, x: 0 } },
    { face: "y_neg", center: { x: -18, y: 0 } },
    { face: "y_neg", center: { x: 15, y: 0 } },
    { face: "x_pos", center: { y: 10, x: 0 } },
    { face: "y_pos", center: { x: 10, y: 0 } },
    { face: "x_neg", center: { y: -12, x: 0 } },
  ])
  expect(
    new Set(output.apertures.map(({ aperture }) => aperture.face)),
  ).toEqual(new Set(["y_pos", "x_pos", "y_neg", "x_neg"]))
  expect(output.frame.boardBottomZ).toBe(6)
  expect(
    output.apertures[6]?.aperture.componentBody?.aboveBoardHeight,
  ).toBeCloseTo(13)
  expect(output.dimensions).toMatchObject({
    width: 80.6,
    height: 60.6,
    depth: 29.4,
  })

  const glb = await renderEnclosureJscadGlb(output.jscadPlan)
  expect(glb.byteLength).toBeGreaterThan(1_000)
  expect(
    prefabBoardCircuitJson.filter(
      (element) =>
        element.type === "cad_component" &&
        "model_obj_url" in element &&
        element.model_obj_url,
    ),
  ).toHaveLength(7)
})
