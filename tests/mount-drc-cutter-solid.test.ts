import { expect, test } from "bun:test"
import {
  checkInsertEncirclement,
  createFdmEnclosure,
  resolveFdmEnclosureProblem,
} from "../lib"
import {
  mountTestBoard,
  mountTestLidMount,
} from "./fixtures/mount-geometry-fixture"
import { createFdmMatrix } from "../lib/fdm/placement-matrix"
import { mat4 } from "gl-matrix"

test("mount DRC uses the placed cutter solid rather than rebuilding it from placement metadata", () => {
  const input = {
    board: mountTestBoard,
    mounts: [{ ...mountTestLidMount, anchor: { x: 15, y: 0 } }],
    apertures: [
      {
        shape: "rect" as const,
        face: "x_pos" as const,
        center: { x: 15, y: 0 },
        width: 2,
        height: 2,
        depth: 5,
      },
    ],
  }
  const resolved = resolveFdmEnclosureProblem(input)
  const output = createFdmEnclosure(input)
  const matrix = createFdmMatrix()
  mat4.fromTranslation(matrix, [0, 100, 0])
  const run = (translation: typeof matrix) =>
    checkInsertEncirclement({
      mounts: resolved.mounts,
      placements: resolved.apertures,
      rules: resolved.rules,
      apertures: [
        {
          ...output.apertures[0]!,
          jscadPlan: {
            type: "transform",
            matrix: translation,
            shape: output.apertures[0]!.jscadPlan,
          },
        },
      ],
    })
  expect(run(matrix)).toEqual([])
  expect(
    run(createFdmMatrix()).some(({ severity }) => severity === "error"),
  ).toBe(true)
})
