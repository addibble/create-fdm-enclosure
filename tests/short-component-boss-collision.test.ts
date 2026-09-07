import { expect, test } from "bun:test"
import {
  createMountTestFixture,
  mountTestBoard,
  mountTestBox,
  mountTestColors,
  mountTestIntersection,
  mountTestLidMount,
  mountTestVolume,
  writeMountTestDiagnostic,
} from "./fixtures/mount-geometry-fixture"

test("physical component collisions are errors even below the clearance threshold", async () => {
  const results = []
  for (const height of [0.4, 0.5, 0.6]) {
    const fixture = createMountTestFixture({
      board: mountTestBoard,
      mounts: [{ ...mountTestLidMount, fastens: "board" }],
      components: [
        {
          id: "C1",
          center: { x: 3.5, y: 0 },
          boardSide: "bottom",
          body: { size: { x: 1, y: 1 }, aboveBoardHeight: height },
        },
      ],
    })
    const component = mountTestBox(
      [1, 1, height],
      [3.5, 0, fixture.output.frame.boardBottomZ - height / 2],
    )
    const intersection = mountTestIntersection(fixture.base, component)
    const collisionVolume = mountTestVolume(intersection)
    const violations = fixture.output.designRuleViolations.filter(
      (violation) =>
        violation.rule === "component_clearance" &&
        violation.componentId === "C1" &&
        violation.mountId === mountTestLidMount.id,
    )
    results.push({ height, collisionVolume, violations })
    await writeMountTestDiagnostic({
      testPath: import.meta.path,
      suffix: `-${height.toFixed(1).replace(".", "p")}mm`,
      bodies: [
        ...fixture.bodies,
        { name: "C1", plan: component, color: mountTestColors.component },
      ],
      clip: mountTestBox([9, 0.5, 4], [2, -0.25, 6]),
      highlight: intersection,
      focus: [2, 0, 6],
      span: 8,
      caption: [
        `Bottom C1 height ${height.toFixed(1)}mm, purple = authored body`,
        "XZ section: red = ACTUAL component/boss intersection",
        "Any positive collision blocks PCB seating, even below 0.5mm.",
      ],
      measurements: { height, collisionVolume, violations },
    })
  }

  for (const { collisionVolume } of results) {
    expect(collisionVolume).toBeGreaterThan(0.1)
  }
  expect(
    results.map(({ height, violations }) => ({
      height,
      collisionReported: violations.some(
        (violation) =>
          violation.severity === "error" && violation.measuredMm < 0,
      ),
    })),
  ).toEqual([
    { height: 0.4, collisionReported: true },
    { height: 0.5, collisionReported: true },
    { height: 0.6, collisionReported: true },
  ])
})
