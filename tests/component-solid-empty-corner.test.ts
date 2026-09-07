import { expect, test } from "bun:test"
import { createFdmEnclosure, type FdmBoardComponent } from "../lib"
import {
  executeMountTestSolid,
  mountTestBox,
} from "./fixtures/mount-geometry-fixture"
import * as jscad from "@jscad/modeling"

test("an exact L-shaped body does not collide through its empty bounding corner", () => {
  const component: FdmBoardComponent = {
    id: "L1",
    center: { x: 0, y: 0 },
    boardSide: "bottom",
    body: { size: { x: 14, y: 14, z: 1 }, aboveBoardHeight: 1 },
    solid: {
      type: "jscad",
      jscadPlan: {
        type: "union",
        shapes: [
          mountTestBox([2, 14, 1], [-6, 0, -1.3]),
          mountTestBox([14, 2, 1], [0, -6, -1.3]),
        ],
      },
    },
  }
  const input = {
    board: { width: 40, height: 24, thickness: 1.6 },
    mounts: [
      {
        id: "H1",
        fastens: "board" as const,
        thread: "m3" as const,
        fastening: "heat_set_insert" as const,
        head: "socketcap" as const,
        anchor: { x: 3, y: 3 },
      },
    ],
  }
  const native = createFdmEnclosure({ ...input, components: [component] })
  expect(
    native.designRuleViolations.filter(
      ({ componentId }) => componentId === "L1",
    ),
  ).toEqual([])
  const conservative = createFdmEnclosure({
    ...input,
    components: [{ ...component, solid: undefined }],
  })
  expect(
    conservative.designRuleViolations.find(
      ({ componentId }) => componentId === "L1",
    )?.message,
  ).toContain("conservative box")
  const collision = createFdmEnclosure({
    ...input,
    mounts: [{ ...input.mounts[0]!, anchor: { x: -5, y: 0 } }],
    components: [component],
  })
  expect(
    collision.designRuleViolations.some(
      ({ componentId, severity }) =>
        componentId === "L1" && severity === "error",
    ),
  ).toBe(true)

  const plan =
    component.solid!.type === "jscad" ? component.solid!.jscadPlan : undefined
  if (!plan) throw new Error("Fixture requires a JSCAD body")
  const positions: number[] = []
  for (const polygon of jscad.geometries.geom3.toPolygons(
    executeMountTestSolid(plan),
  )) {
    for (let i = 1; i < polygon.vertices.length - 1; i++) {
      positions.push(
        ...polygon.vertices[0]!,
        ...polygon.vertices[i]!,
        ...polygon.vertices[i + 1]!,
      )
    }
  }
  const mesh = createFdmEnclosure({
    ...input,
    components: [{ ...component, solid: { type: "triangle_mesh", positions } }],
  })
  expect(
    mesh.designRuleViolations.filter(({ componentId }) => componentId === "L1"),
  ).toEqual([])
  const meshCollision = createFdmEnclosure({
    ...input,
    mounts: [{ ...input.mounts[0]!, anchor: { x: -5, y: 0 } }],
    components: [{ ...component, solid: { type: "triangle_mesh", positions } }],
  })
  expect(
    meshCollision.designRuleViolations.some(
      ({ componentId, severity }) =>
        componentId === "L1" && severity === "error",
    ),
  ).toBe(true)
})
