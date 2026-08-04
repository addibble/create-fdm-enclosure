import { GenericSolverDebugger } from "@tscircuit/solver-utils/react"
import "@google/model-viewer"
import { useEffect, useMemo, useState } from "react"
import {
  type CreateFdmEnclosureInput,
  type CreateFdmEnclosureOutput,
  CreateFdmEnclosureSolver,
  createFdmEnclosure,
} from "../lib"
import { createEnclosurePreviewGlb } from "../lib/preview/create-enclosure-preview-glb"

export const FdmEnclosureSolverDebugger = ({
  input,
}: {
  input: CreateFdmEnclosureInput
}): React.JSX.Element => {
  const solver = useMemo(() => new CreateFdmEnclosureSolver(input), [input])
  const [glbUrl, setGlbUrl] = useState<string>()
  const [output, setOutput] = useState<CreateFdmEnclosureOutput>()
  const [error, setError] = useState<string>()

  useEffect(() => {
    let disposed = false
    let nextUrl: string | undefined

    const createPreview = async (): Promise<void> => {
      try {
        const nextOutput = createFdmEnclosure(input)
        const glb = await createEnclosurePreviewGlb(input)
        if (disposed) return
        nextUrl = URL.createObjectURL(
          new Blob([glb.data], { type: glb.mimeType }),
        )
        setOutput(nextOutput)
        setGlbUrl(nextUrl)
      } catch (caughtError) {
        if (!disposed) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : String(caughtError),
          )
        }
      }
    }

    void createPreview()
    return () => {
      disposed = true
      if (nextUrl) URL.revokeObjectURL(nextUrl)
    }
  }, [input])

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 3fr) minmax(360px, 2fr)",
        minHeight: "100vh",
        background: "white",
        color: "#0f172a",
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
      }}
    >
      <section style={{ minWidth: 0, borderRight: "1px solid #e2e8f0" }}>
        <GenericSolverDebugger solver={solver} animationSpeed={250} />
      </section>
      <aside style={{ padding: 20 }}>
        <h2 style={{ margin: "0 0 12px", fontSize: 18 }}>Generated GLB</h2>
        <div
          style={{
            height: 460,
            overflow: "hidden",
            border: "1px solid #cbd5e1",
            borderRadius: 8,
            background: "#f8fafc",
          }}
        >
          {glbUrl ? (
            <model-viewer
              src={glbUrl}
              alt="Generated two-part FDM enclosure"
              auto-rotate
              camera-controls
              camera-orbit="45deg 65deg auto"
              shadow-intensity="1"
              exposure="1"
              style={{ width: "100%", height: "100%", background: "white" }}
            />
          ) : (
            <div style={{ padding: 20, color: error ? "#b91c1c" : "#64748b" }}>
              {error ?? "Generating GLB…"}
            </div>
          )}
        </div>
        {glbUrl && (
          <a
            href={glbUrl}
            download="fdm-enclosure.glb"
            style={{
              display: "inline-block",
              marginTop: 12,
              padding: "8px 12px",
              borderRadius: 6,
              background: "#2563eb",
              color: "white",
              textDecoration: "none",
            }}
          >
            Download GLB
          </a>
        )}
        {output && (
          <pre
            style={{
              marginTop: 16,
              padding: 12,
              overflow: "auto",
              borderRadius: 6,
              background: "#f1f5f9",
              fontSize: 12,
            }}
          >
            {JSON.stringify(output.dimensions, null, 2)}
          </pre>
        )}
      </aside>
    </div>
  )
}
