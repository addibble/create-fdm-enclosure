import react from "@vitejs/plugin-react"
import { fileURLToPath } from "node:url"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "node:buffer": "buffer",
      // circuit-json-to-gltf statically imports the native @resvg/resvg-js for
      // board-texture rendering, which cannot bundle for the browser. The
      // enclosure <model-viewer> preview renders no textures
      // (boardTextureResolution: 0), so stub it to keep the browser build working.
      "@resvg/resvg-js": fileURLToPath(
        new URL("./site/resvg-js-browser-stub.ts", import.meta.url),
      ),
    },
  },
})
