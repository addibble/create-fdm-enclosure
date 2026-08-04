import { expect, test } from "bun:test"
import { renderGLTFToPNGFromGLB } from "poppygl"
import { usbCPillInput } from "../fixtures/inputs"
import { CreateFdmEnclosureSolver } from "../lib"
import { renderEnclosureJscadGlb } from "../lib/preview/create-enclosure-preview-glb"

test("infers an enclosure and creates a front USB-C pill cutout", async () => {
  const solver = new CreateFdmEnclosureSolver(usbCPillInput)
  solver.solve()

  expect(solver.solved).toBe(true)
  const output = solver.getOutput()
  // Depth is not the bare stack (15.6). `topHeadroom` was not authored, so the
  // box grew until the lid's lip cleared the port: the opening's top sits at
  // 12.2, the lip hangs 4 below the seam, and the lid is 2 thick.
  expect(output.dimensions).toEqual({
    width: 46,
    height: 30,
    depth: 18.2,
    wallThickness: 2,
    floorThickness: 2,
    lidThickness: 2,
    boardClearance: 1,
    standoffHeight: 4,
    topHeadroom: 6,
    lidLipDepth: 4,
  })
  expect(output.frame).toEqual({
    floorTopZ: 2,
    boardBottomZ: 6,
    boardTopZ: 7.6,
    seamZ: 16.2,
    totalHeight: 18.2,
  })
  expect(output.parts.map((part) => part.id)).toEqual(["base", "lid"])
  expect(output.apertures).toHaveLength(1)
  expect(output.apertures[0]).toMatchObject({
    width: 10,
    height: 4.6,
    // 2mm wall + 2x0.5mm boolean tolerance + 2.05mm projected inboard, so the
    // lid lip behind the wall cannot obstruct the connector.
    cutDepth: 5.05,
  })
  expect(output.jscadPlan).toMatchObject({ type: "union" })
  expect(solver.visualize()).toMatchGraphicsSvg(import.meta.path)

  const glb = await renderEnclosureJscadGlb(output.jscadPlan)
  expect(glb.byteLength).toBeGreaterThan(1_000)
  for (const part of output.parts) {
    const partGlb = await renderEnclosureJscadGlb(part.jscadPlan)
    expect(partGlb.byteLength).toBeGreaterThan(500)
  }
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
      "Inferred enclosure, camera on the front (+Y) / left (-X) corner",
      "Must show one pill cutout on the front (+Y) wall",
    ],
  })
})
