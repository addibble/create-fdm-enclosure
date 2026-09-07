import { expect, test } from "bun:test"
import type { JscadOperation } from "jscad-planner"
import { createFdmEnclosure } from "../lib"
import {
  createMountTestFixture,
  mountTestBoard,
  mountTestBounds,
  mountTestBox,
  mountTestColors,
  mountTestIntersection,
  mountTestLidMount,
  mountTestPart,
  mountTestVolume,
  writeMountTestDiagnostic,
} from "./fixtures/mount-geometry-fixture"

test("lid-column DRC measures its clearance bore, not the floor installation bore", async () => {
  const results = []
  for (const fastening of ["self_tapping", "heat_set_insert"] as const) {
    const input = {
      board: mountTestBoard,
      standoffHeight: fastening === "self_tapping" ? 8 : 4,
      mounts: [{ ...mountTestLidMount, anchor: { x: 15, y: 0 }, fastening }],
    }
    const fixture = createMountTestFixture({
      ...input,
      apertures: [
        {
          shape: "rect",
          face: "x_pos",
          center: { x: 15, y: 0 },
          width: 2,
          height: 2,
          depth: fastening === "self_tapping" ? 3.9 : 2.15,
        },
      ],
    })
    const uncutLid = mountTestPart(createFdmEnclosure(input), "lid")
    const cutter = fixture.output.apertures[0]!.jscadPlan
    const sliceZ = fixture.output.frame.boardTopZ + 0.8
    // A thin radial probe measures where the executed lid material starts.
    // It does not read either mount.boreDiameterMm or the clearance diameter.
    const radialMaterial = mountTestIntersection(
      uncutLid,
      mountTestBox([5, 0.002, 0.1], [17.5, 0, sliceZ]),
    )
    const boreEdgeX = mountTestBounds(radialMaterial)[0][0]
    const apertureEdgeX = mountTestBounds(cutter)[0][0]
    const remainingWallMm = apertureEdgeX - boreEdgeX
    const removed = mountTestIntersection(uncutLid, cutter)
    const removedVolume = mountTestVolume(removed)
    const violations = fixture.output.designRuleViolations.filter(
      (violation) => violation.rule === "insert_not_encircled",
    )
    results.push({ fastening, remainingWallMm, removedVolume, violations })

    const missingMaterial: JscadOperation = {
      type: "subtract",
      shapes: [uncutLid, fixture.lid],
    }
    await writeMountTestDiagnostic({
      testPath: import.meta.path,
      suffix: `-${fastening.replaceAll("_", "-")}`,
      bodies: [
        { name: "lid-column", plan: fixture.lid, color: mountTestColors.lid },
      ],
      clip: mountTestBox([9, 9, 0.2], [16, 0, sliceZ]),
      highlight: missingMaterial,
      focus: [16, 0, sliceZ],
      span: 11,
      view: "plan",
      caption: [
        `${fastening}: XY section of the ACTUAL lid bore`,
        "Red = material removed by aperture, blue = surviving lid",
        `Physical radial wall=${remainingWallMm.toFixed(2)}mm`,
        fastening === "self_tapping"
          ? "Negative wall: aperture breaks into bore. Must be ERROR."
          : "1.65mm wall clears 1.6mm minimum. Must NOT warn.",
      ],
      measurements: {
        boreEdgeX,
        apertureEdgeX,
        remainingWallMm,
        removedVolume,
        violations,
      },
    })
  }

  const [selfTap, heatSet] = results
  expect(selfTap!.remainingWallMm).toBeCloseTo(-0.1, 2)
  expect(heatSet!.remainingWallMm).toBeCloseTo(1.65, 2)
  expect(selfTap!.removedVolume).toBeGreaterThan(0)
  expect(heatSet!.removedVolume).toBeGreaterThan(0)
  expect(
    results.map(({ fastening, violations }) => ({
      fastening,
      severities: violations.map((violation) => violation.severity),
    })),
  ).toEqual([
    { fastening: "self_tapping", severities: ["error"] },
    { fastening: "heat_set_insert", severities: [] },
  ])
  expect(selfTap!.violations[0]!.measuredMm).toBeCloseTo(
    selfTap!.remainingWallMm,
    2,
  )
})
