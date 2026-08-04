// Browser stub for @resvg/resvg-js.
//
// circuit-json-to-gltf statically imports the native @resvg/resvg-js binding
// for PCB board-texture rendering. The FDM enclosure preview renders no board
// textures (boardTextureResolution: 0), so Resvg is never actually invoked in
// the browser - this stub only exists so the module graph can bundle under Vite
// for the Cosmos <model-viewer> preview. Any real use throws loudly.
export class Resvg {
  constructor() {
    throw new Error(
      "@resvg/resvg-js is stubbed in the browser build; render board textures in Node.",
    )
  }
}

export default { Resvg }
