import * as jscad from "@jscad/modeling"
import type { Geom3, Geometry } from "@jscad/modeling/src/geometries/types"
import { getAssemblyHardwareModel } from "@tscircuit/jscad-assembly-hardware"
import { convertCircuitJsonToGltf } from "circuit-json-to-gltf"
import {
  executeJscadOperations,
  type JscadImplementation,
  type JscadOperation,
} from "jscad-planner"
import { mkdir, writeFile } from "node:fs/promises"
import { basename, dirname, join } from "node:path"
import { renderGLTFToPNGFromGLB } from "poppygl"
import {
  createFdmEnclosure,
  type CreateFdmEnclosureInput,
  type CreateFdmEnclosureOutput,
} from "../../lib"
import { captionPng } from "./caption-png"

export const mountTestBoard = { width: 40, height: 24, thickness: 1.6 }
export const mountTestLidMount = {
  id: "EN1.H1",
  fastens: "lid",
  anchor: { x: 0, y: 0 },
  thread: "m3",
  fastening: "heat_set_insert",
  head: "socketcap",
  pcbHoleDiameter: 3.2,
} as const

export const geometryTolerance = 1e-4

/** Execute the existing interpreter; all measurements are of real Z-up mm solids. */
export const executeMountTestSolid = (plan: JscadOperation): Geom3 => {
  // The upstream interface declares rotations as number[], whereas modeling
  // requires tuples. Bridge that external declaration mismatch once, and guard
  // the executed result rather than asserting that every plan yields a solid.
  const solid: unknown = executeJscadOperations(
    jscad as unknown as JscadImplementation<Geometry>,
    plan,
  )
  if (!jscad.geometries.geom3.isA(solid)) {
    throw new Error("Mount fixture plan did not execute to a Geom3")
  }
  return solid
}

export const mountTestBounds = (plan: JscadOperation) =>
  jscad.measurements.measureBoundingBox(executeMountTestSolid(plan))

export const mountTestVolume = (plan: JscadOperation) =>
  Math.abs(jscad.measurements.measureVolume(executeMountTestSolid(plan)))

export const mountTestIntersection = (
  ...shapes: JscadOperation[]
): JscadOperation => ({ type: "intersect", shapes })

/** Points and sizes are enclosure-local, right-handed, Z-up millimetres. */
export const mountTestBox = (
  size: [number, number, number],
  center: [number, number, number],
): JscadOperation => ({
  type: "translate",
  vector: center,
  shape: { type: "cuboid", size },
})

export const mountTestPart = (
  output: CreateFdmEnclosureOutput,
  id: "base" | "lid",
) => {
  const part = output.parts.find((part) => part.id === id)
  if (!part) throw new Error(`Solver did not emit ${id}`)
  return part.jscadPlan
}

export const mountTestHardware = (
  output: CreateFdmEnclosureOutput,
  role: "screw" | "insert" | "spacer",
): JscadOperation => {
  const pieces = output.hardware.filter((piece) => piece.role === role)
  const piece = pieces[0]
  if (pieces.length !== 1 || !piece?.hardwareString) {
    throw new Error(`Fixture requires exactly one modelled ${role}`)
  }
  return {
    type: "translate",
    vector: [piece.position.x, piece.position.y, piece.position.z],
    shape: getAssemblyHardwareModel(piece.hardwareString),
  }
}

export type MountTestBody = {
  name: string
  plan: JscadOperation
  color: [number, number, number, number]
}

export const mountTestColors = {
  base: [0.72, 0.67, 0.58, 1],
  lid: [0.25, 0.55, 0.85, 1],
  board: [0.12, 0.5, 0.24, 1],
  screw: [0.24, 0.27, 0.31, 1],
  insert: [0.82, 0.61, 0.17, 1],
  spacer: [0.7, 0.75, 0.82, 1],
  component: [0.6, 0.3, 0.72, 1],
} satisfies Record<string, MountTestBody["color"]>

export const createMountTestFixture = (input: CreateFdmEnclosureInput) => {
  const output = createFdmEnclosure(input)
  const board: JscadOperation = {
    type: "subtract",
    shapes: [
      mountTestBox(
        [input.board.width, input.board.height, input.board.thickness],
        [0, 0, (output.frame.boardBottomZ + output.frame.boardTopZ) / 2],
      ),
      ...output.mounts.map((mount): JscadOperation => {
        const diameter = mount.mount.pcbHoleDiameter
        if (diameter === undefined) {
          throw new Error(
            "Mount geometry fixtures must declare their PCB drill",
          )
        }
        return {
          type: "translate",
          vector: [mount.center.x, mount.center.y, output.frame.boardBottomZ],
          shape: {
            type: "cylinder",
            radius: diameter / 2,
            height: input.board.thickness * 4,
            resolution: 32,
          },
        }
      }),
    ],
  }
  const base = mountTestPart(output, "base")
  const lid = mountTestPart(output, "lid")
  const bodies: MountTestBody[] = [
    { name: "base", plan: base, color: mountTestColors.base },
    { name: "lid", plan: lid, color: mountTestColors.lid },
    { name: "board", plan: board, color: mountTestColors.board },
    ...output.hardware.map((piece) => ({
      name: piece.id,
      plan: mountTestHardware(output, piece.role),
      color: mountTestColors[piece.role],
    })),
  ]
  return { output, base, lid, board, bodies }
}

/**
 * Export actual solver plans, clipped by JSCAD before passing through the
 * existing cad_component.model_jscad exporter (lib/preview's convention).
 * Each body remains separate so its material and any red intersection survive.
 *
 * Plans/clip/focus are enclosure-local Z-up mm. Camera coordinates are final
 * glTF Y-up mm: the JSCAD loader maps (x,y,z) to (x,z,y), then the exporter
 * mirrors X. This matches circuit-json-to-gltf's utils/camera-position.ts,
 * getBestCameraPosition (which fits entire PCBs, not these local sections).
 * Off-axis GLB accessor bounds confirm the final map is (-x,z,y).
 * No bounds alignment, compensating placement, or substitute "fixed" model.
 *
 * These deliberately overwritten .actual files are diagnostics, not approved
 * snapshot baselines. Physical assertions, not matching today's PNG, gate tests.
 */
export const writeMountTestDiagnostic = async ({
  testPath,
  suffix = "",
  bodies,
  clip,
  highlight,
  focus,
  span,
  view = "elevation",
  caption,
  measurements,
}: {
  testPath: string
  suffix?: string
  bodies: MountTestBody[]
  clip: JscadOperation
  highlight?: JscadOperation
  focus: [number, number, number]
  span: number
  view?: "elevation" | "plan"
  caption: string[]
  measurements: Record<string, unknown>
}) => {
  const visible = bodies.map(({ name, plan, color }) => ({
    name,
    color,
    plan: mountTestIntersection(
      highlight ? { type: "subtract", shapes: [plan, highlight] } : plan,
      clip,
    ),
  }))
  if (highlight) {
    visible.push({
      name: "intersection-highlight",
      color: [1, 0.05, 0.05, 1],
      plan: mountTestIntersection(highlight, clip),
    })
  }
  const circuitJson: Parameters<typeof convertCircuitJsonToGltf>[0] = []
  for (const { name, color, plan } of visible) {
    // Clipping may legitimately remove an entire body or a zero-volume clash.
    if (mountTestVolume(plan) < geometryTolerance) continue
    circuitJson.push(
      {
        type: "source_component",
        source_component_id: `source_${name}`,
        name,
        ftype: "simple_chip",
      },
      {
        type: "pcb_component",
        pcb_component_id: `pcb_${name}`,
        source_component_id: `source_${name}`,
        center: { x: 0, y: 0 },
        width: 0,
        height: 0,
        layer: "top",
        rotation: 0,
        do_not_place: true,
        obstructs_within_bounds: false,
      },
      {
        type: "cad_component",
        cad_component_id: `cad_${name}`,
        source_component_id: `source_${name}`,
        pcb_component_id: `pcb_${name}`,
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        anchor_alignment: "center",
        model_object_fit: "contain_within_bounds",
        model_origin_position: { x: 0, y: 0, z: 0 },
        model_unit_to_mm_scale_factor: 1,
        model_jscad: { type: "colorize", color, shape: plan },
      },
    )
  }
  if (circuitJson.length === 0) throw new Error("Diagnostic clip is empty")
  const converted = await convertCircuitJsonToGltf(circuitJson, {
    format: "glb",
    includeModels: true,
    boardTextureResolution: 0,
  })
  if (!(converted instanceof ArrayBuffer)) {
    throw new Error("Diagnostic exporter did not return binary glTF")
  }
  const lookAt: [number, number, number] = [-focus[0], focus[2], focus[1]]
  const distance = span * 10
  const png = await renderGLTFToPNGFromGLB(converted, {
    width: 900,
    height: 650,
    supersampling: 2,
    backgroundColor: "#ffffff",
    grid: false,
    fov: 6,
    ambient: 0.65,
    lookAt,
    camPos:
      view === "plan"
        ? [lookAt[0], lookAt[1] + distance, lookAt[2]]
        : [lookAt[0], lookAt[1], lookAt[2] + distance],
    up: view === "plan" ? "z+" : "y+",
  })
  const directory = join(dirname(testPath), "__snapshots__")
  const stem = join(
    directory,
    `${basename(testPath, ".test.ts")}${suffix}.actual`,
  )
  await mkdir(directory, { recursive: true })
  await writeFile(`${stem}.glb`, new Uint8Array(converted))
  await writeFile(
    `${stem}.png`,
    captionPng(png, [
      "ACTUAL SOLVER OUTPUT - DIAGNOSTIC, NOT A BASELINE",
      ...caption,
    ]),
  )
  await writeFile(`${stem}.json`, `${JSON.stringify(measurements, null, 2)}\n`)
  console.log(`${basename(stem)}: ${JSON.stringify(measurements)}`)
}
