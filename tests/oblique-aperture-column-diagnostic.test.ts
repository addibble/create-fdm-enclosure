import { expect, test } from "bun:test"
import type { JscadOperation } from "jscad-planner"
import { createFdmEnclosure } from "../lib"
import {
  createMountTestFixture,
  mountTestBoard,
  mountTestBox,
  mountTestColors,
  mountTestIntersection,
  mountTestLidMount,
  mountTestPart,
  mountTestVolume,
  writeMountTestDiagnostic,
} from "./fixtures/mount-geometry-fixture"

test("DRC reports the column removed by the actual 30-degree aperture cutter", async () => {
  const input = {
    board: mountTestBoard,
    mounts: [{ ...mountTestLidMount, anchor: { x: 3, y: -9 } }],
  }
  const fixture = createMountTestFixture({
    ...input,
    apertures: [
      {
        shape: "rect",
        face: "x_pos",
        center: { x: 18, y: 0 },
        width: 2,
        height: 4,
        depth: 20,
        apertureAxisDirection: { x: Math.cos(Math.PI / 6), y: 0.5, z: 0 },
      },
    ],
  })
  const uncutLid = mountTestPart(createFdmEnclosure(input), "lid")
  const blankLid = mountTestPart(
    createFdmEnclosure({ board: mountTestBoard }),
    "lid",
  )
  // Difference of emitted solids isolates the column, excluding the shell/lip.
  const column: JscadOperation = {
    type: "subtract",
    shapes: [uncutLid, blankLid],
  }
  const cutter = fixture.output.apertures[0]!.jscadPlan
  const removed = mountTestIntersection(column, cutter)
  const removedColumnVolume = mountTestVolume(removed)
  const boreAir: JscadOperation = {
    type: "subtract",
    shapes: [mountTestBox([4, 4, 0.3], [3, -9, 8.5]), uncutLid],
  }
  const cutterInsideBoreVolume = mountTestVolume(
    mountTestIntersection(boreAir, cutter),
  )
  const survivingColumn: JscadOperation = {
    type: "subtract",
    shapes: [column, cutter],
  }
  const violations = fixture.output.designRuleViolations.filter(
    (violation) => violation.rule === "insert_not_encircled",
  )

  await writeMountTestDiagnostic({
    testPath: import.meta.path,
    bodies: [
      {
        name: "surviving-column",
        plan: survivingColumn,
        color: mountTestColors.lid,
      },
      { name: "aperture-tool", plan: cutter, color: [0.65, 0.85, 0.85, 1] },
    ],
    clip: mountTestBox([12, 12, 0.3], [5, -7, 8.5]),
    highlight: removed,
    focus: [5, -7, 8.5],
    span: 15,
    view: "plan",
    caption: [
      "XY section at Z=8.5mm, blue = actual surviving lid column",
      "Pale cyan = ACTUAL rotated cutter, red = removed column",
      "The cutter follows its rotated axis, not the wall normal.",
      "A cut into this column must produce an encirclement diagnostic.",
    ],
    measurements: {
      removedColumnVolume,
      cutterInsideBoreVolume,
      violations,
      allViolations: fixture.output.designRuleViolations,
    },
  })

  expect(removedColumnVolume).toBeGreaterThan(1)
  expect(cutterInsideBoreVolume).toBeGreaterThan(0)
  expect(violations).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        mountId: mountTestLidMount.id,
        severity: "error",
        apertureIndex: 0,
        face: "x_pos",
      }),
    ]),
  )
})
