import { expect, test } from "bun:test"
import {
  createMountTestFixture,
  mountTestBoard,
  mountTestBox,
  mountTestHardware,
  mountTestIntersection,
  mountTestLidMount,
  mountTestVolume,
  writeMountTestDiagnostic,
} from "./fixtures/mount-geometry-fixture"

test("the public solver rejects a cylindrical socket cap in a conical countersink", async () => {
  let fixture: ReturnType<typeof createMountTestFixture> | undefined
  let rejection: Error | undefined
  try {
    fixture = createMountTestFixture({
      board: mountTestBoard,
      mounts: [{ ...mountTestLidMount, headRecess: "countersink" }],
    })
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !/socketcap/.test(error.message) ||
      !/countersink/.test(error.message)
    ) {
      throw error
    }
    rejection = error
  }

  if (fixture) {
    const screw = mountTestHardware(fixture.output, "screw")
    const intersection = mountTestIntersection(fixture.lid, screw)
    const collisionVolume = mountTestVolume(intersection)
    const topZ = fixture.output.frame.totalHeight
    await writeMountTestDiagnostic({
      testPath: import.meta.path,
      bodies: fixture.bodies,
      clip: mountTestBox([10, 1, 9], [0, -0.5, topZ - 1]),
      highlight: intersection,
      focus: [0, 0, topZ - 1],
      span: 10,
      caption: [
        "Accepted socketcap + countersink: actual XZ head section",
        "Red = cylindrical cap intersecting conical lid seat",
        "This incompatible pair must be rejected by the solver.",
      ],
      measurements: {
        collisionVolume,
        violations: fixture.output.designRuleViolations,
      },
    })
  }

  expect(rejection).toBeInstanceOf(Error)
})
