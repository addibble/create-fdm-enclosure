// NOTE: deliberately not re-exported from `lib/index.ts`. The published bundle
// is built from that entry point only, so keeping this module out of it lets
// `circuit-json-to-gltf` stay a devDependency instead of leaking a renderer
// into the solver package's runtime dependencies.
import { convertCircuitJsonToGltf } from "circuit-json-to-gltf"
import { type CreateFdmEnclosureInput, createFdmEnclosure } from "../index"

export interface EnclosurePreviewGlb {
  data: ArrayBuffer
  mimeType: string
  byteLength: number
}

/**
 * Render a raw enclosure JSCAD plan to a GLB through the SAME pipeline the
 * production runtime uses: core emits a `cad_fdm_enclosure.model_jscad`, then
 * `circuit-json-to-gltf` converts it. Using this everywhere keeps the Cosmos
 * debugger's <model-viewer> and the standalone solver snapshots in the exact
 * same coordinate frame as the runtime 3D viewer, instead of the 180deg-rotated
 * `jscad-to-gltf` frame (see rfc/rfcs/2026-07-22-coordinate-frame-consolidation.md).
 *
 * The conversion is circuit (x, y, z) -> glTF (-x, z, y). Despite the negated
 * X it is a proper rotation, not a mirror: its determinant is +1 (a 180deg turn
 * about the (0, 1, 1) axis), so nothing is rendered inside out. The practical
 * consequence is that with the front (+Y) toward the camera, the enclosure's
 * own right wall (+X) appears on the viewer's left - the same way a person
 * facing you has their right hand on your left. That is why a 3D view and the
 * top-down 2D visualization disagree about which side of the frame a given
 * wall shows up on; both are correct, they are just different viewpoints.
 */
export const renderEnclosureJscadGlb = async (
  jscadPlan: unknown,
): Promise<ArrayBuffer> => {
  const circuitJson = [
    {
      type: "source_assembly_device",
      source_assembly_device_id: "assembly_preview",
      name: "enclosure-preview",
    },
    {
      type: "source_board",
      source_board_id: "board_preview",
    },
    {
      type: "source_fdm_enclosure",
      source_fdm_enclosure_id: "enclosure_preview",
      source_assembly_device_id: "assembly_preview",
      source_board_id: "board_preview",
      wall_thickness: 2,
    },
    {
      type: "cad_fdm_enclosure",
      cad_fdm_enclosure_id: "cad_enclosure_preview",
      source_fdm_enclosure_id: "enclosure_preview",
      name: "ENCLOSURE",
      position: { x: 0, y: 0, z: 0 },
      // No rotation: convertCircuitJsonToGltf maps circuit (x, y, z) to glTF
      // (-x, z, y), so the front face (circuit +Y) already lands at glTF +Z,
      // which is where <model-viewer> puts its default camera. This used to
      // rotate 180deg because front was circuit -Y; once front moved to +Y that
      // rotation started presenting the back. Presentation only - it does not
      // affect the production board+connectors render, where the enclosure and
      // connectors share one frame.
      rotation: { x: 0, y: 0, z: 0 },
      model_jscad: jscadPlan,
      model_unit_to_mm_scale_factor: 1,
    },
  ]

  return (await convertCircuitJsonToGltf(circuitJson as any, {
    format: "glb",
    includeModels: true,
    boardTextureResolution: 0,
  })) as ArrayBuffer
}

/**
 * Build the GLB shown by the FDM enclosure Cosmos debugger's <model-viewer>,
 * using the production `circuit-json-to-gltf` frame so the debug preview matches
 * the runtime 3D viewer exactly. Kept DOM-free so it can be exercised headlessly
 * in tests.
 */
export const createEnclosurePreviewGlb = async (
  input: CreateFdmEnclosureInput,
): Promise<EnclosurePreviewGlb> => {
  const output = createFdmEnclosure(input)
  const data = await renderEnclosureJscadGlb(output.jscadPlan)
  return { data, mimeType: "model/gltf-binary", byteLength: data.byteLength }
}
