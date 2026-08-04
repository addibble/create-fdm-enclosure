import { expect, test } from "bun:test"
import { renderGLTFToPNGFromGLB } from "poppygl"
import { usbCPillInput } from "../fixtures/inputs"
import { createEnclosurePreviewGlb } from "../lib/preview/create-enclosure-preview-glb"

const GLTF_MAGIC = 0x46546c67 // "glTF"

// Aggregate the POSITION accessor bounds (glTF stores per-accessor min/max) to
// recover the model's axis-aligned bounding box without decoding the binary.
const readGlbPositionBounds = (glb: ArrayBuffer) => {
  const dv = new DataView(glb)
  expect(dv.getUint32(0, true)).toBe(GLTF_MAGIC)
  const jsonLength = dv.getUint32(12, true)
  const json = JSON.parse(
    new TextDecoder().decode(new Uint8Array(glb, 20, jsonLength)),
  )
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  for (const mesh of json.meshes ?? [])
    for (const primitive of mesh.primitives ?? []) {
      const accessor = json.accessors?.[primitive.attributes?.POSITION]
      if (!accessor?.min || !accessor?.max) continue
      for (let i = 0; i < 3; i++) {
        min[i] = Math.min(min[i]!, accessor.min[i])
        max[i] = Math.max(max[i]!, accessor.max[i])
      }
    }
  return {
    min,
    max,
    size: [max[0]! - min[0]!, max[1]! - min[1]!, max[2]! - min[2]!],
  }
}

test("FDM enclosure debugger preview GLB is valid, Y-up, and shows the cutout", async () => {
  const glb = await createEnclosurePreviewGlb(usbCPillInput)

  // Valid binary glTF the <model-viewer> can load.
  expect(glb.mimeType).toBe("model/gltf-binary")
  expect(glb.byteLength).toBeGreaterThan(1_000)
  expect(glb.data.byteLength).toBe(glb.byteLength)

  // usbCPillInput resolves to a 46 x 30 footprint, 15.6 tall enclosure. The
  // <model-viewer> is Y-up, so the vertical (Y) extent must be the 15.6 depth
  // with the floor at Y~=0 - this is what confirms the debugger renders the
  // box standing upright rather than lying on its side.
  const { min, size } = readGlbPositionBounds(glb.data)
  expect(size[0]).toBeCloseTo(46, 0) // width along X
  expect(size[1]).toBeCloseTo(18.2, 1) // height (depth) along Y = up
  expect(size[2]).toBeCloseTo(30, 0) // height along Z
  expect(min[1]).toBeCloseTo(0, 1) // floor sits at the bottom
  // The vertical axis is the shortest, i.e. the box is upright, not tipped.
  expect(size[1]).toBeLessThan(size[0]!)
  expect(size[1]).toBeLessThan(size[2]!)

  // Visual regression of the actual model the debugger displays. The front face
  // (circuit +Y) maps to glTF +Z, which is <model-viewer>'s default camera, so
  // the snapshot camera views from +Z. This guards the front-facing invariant:
  // if the front face stops landing at +Z, this camera sees a blank wall.
  // A blank wall here is a failure, not a new baseline.
  expect(
    renderGLTFToPNGFromGLB(glb.data, {
      backgroundColor: "#ffffff",
      grid: false,
      camPos: [45, 40, 75],
      lookAt: [0, 6, 0],
    } as any),
  ).toMatchPngSnapshot(import.meta.path, {
    name: "fdm-enclosure-debugger-preview",
    caption: [
      "Debugger preview, default model-viewer camera",
      "Must show the pill cutout: front (+Y) faces the camera",
      "A blank wall means the front face no longer lands at gltf +Z",
    ],
  })
})
