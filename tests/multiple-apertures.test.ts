import { expect, test } from "bun:test"
import { renderGLTFToPNGFromGLB } from "poppygl"
import { multipleAperturesInput } from "../fixtures/inputs"
import { CreateFdmEnclosureSolver } from "../lib"
import { renderEnclosureJscadGlb } from "../lib/preview/create-enclosure-preview-glb"

test("creates rect, circle, and pill cutouts on all four walls", async () => {
  const solver = new CreateFdmEnclosureSolver(multipleAperturesInput)
  solver.solve()

  expect(solver.solved).toBe(true)
  const output = solver.getOutput()
  expect(output.apertures).toHaveLength(4)
  expect(output.apertures.map(({ aperture }) => aperture.shape)).toEqual([
    "rect",
    "circle",
    "pill",
    "rect",
  ])
  expect(solver.visualize()).toMatchGraphicsSvg(import.meta.path)

  const glb = await renderEnclosureJscadGlb(output.jscadPlan)
  expect(
    renderGLTFToPNGFromGLB(
      glb as ArrayBuffer,
      {
        backgroundColor: "#ffffff",
        grid: false,
        camPos: [70, 55, 70],
        lookAt: [0, 5, 0],
      } as any,
    ),
  ).toMatchPngSnapshot(import.meta.path, {
    caption: [
      "Four walls cut: y_pos rect, x_pos circle, y_neg pill, x_neg rect",
      "Must show exactly 2 rect cutouts, one per visible wall:",
      "y_pos (+Y) and x_neg (-X). +Y faces the camera, so the box's",
      "own +X wall is on OUR left and hidden here, the same way a",
      "person facing you has their right hand on your left.",
      "A circle or pill in view means the model is turned wrong.",
    ],
  })
})
