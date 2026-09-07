import { expect, test } from "bun:test"
import {
  createMountTestFixture,
  mountTestBoard,
  mountTestBox,
  mountTestIntersection,
  mountTestLidMount,
  mountTestVolume,
  writeMountTestDiagnostic,
} from "./fixtures/mount-geometry-fixture"

test("a printed lid column colliding with the base wall is an assembly error", async () => {
  const fixture = createMountTestFixture({
    board: mountTestBoard,
    mounts: [{ ...mountTestLidMount, anchor: { x: 18, y: 0 } }],
  })
  const intersection = mountTestIntersection(fixture.lid, fixture.base)
  const collisionVolume = mountTestVolume(intersection)
  const errors = fixture.output.designRuleViolations.filter(
    (violation) =>
      violation.severity === "error" &&
      violation.mountId === mountTestLidMount.id,
  )

  await writeMountTestDiagnostic({
    testPath: import.meta.path,
    bodies: fixture.bodies,
    clip: mountTestBox([14, 1, 22], [18, -0.5, 11]),
    highlight: intersection,
    focus: [18, 0, 9],
    span: 22,
    caption: [
      "XZ section: blue lid column at X=18, tan base wall at X=21",
      "Red = intersection of the two FINISHED printed parts",
      "Partial PCB support warning is not an assembly-blocking error.",
    ],
    measurements: {
      collisionVolume,
      violations: fixture.output.designRuleViolations,
    },
  })

  expect(collisionVolume).toBeGreaterThan(1)
  expect(errors.length).toBeGreaterThan(0)
})
