import { expect, test } from "bun:test"
import { createFdmEnclosure } from "../lib"
import {
  createMountTestFixture,
  geometryTolerance,
  mountTestBoard,
  mountTestBounds,
  mountTestBox,
  mountTestHardware,
  mountTestIntersection,
  mountTestLidMount,
  mountTestVolume,
  writeMountTestDiagnostic,
} from "./fixtures/mount-geometry-fixture"

test("a countersunk bolt clears the executed blind-bore floor", async () => {
  const mount = { ...mountTestLidMount, head: "countersunk" as const }
  const input = { board: mountTestBoard, mounts: [mount] }
  const fixture = createMountTestFixture(input)
  const screw = mountTestHardware(fixture.output, "screw")
  const intersection = mountTestIntersection(screw, fixture.base)
  const collisionVolume = mountTestVolume(intersection)
  const tipZ = mountTestBounds(screw)[0][2]
  // A narrow axial probe meets only the remaining floor, not the bore wall.
  const floorProbe = mountTestIntersection(
    fixture.base,
    mountTestBox([0.1, 0.1, 6], [0, 0, 3]),
  )
  const boreFloorZ = mountTestBounds(floorProbe)[1][2]

  await writeMountTestDiagnostic({
    testPath: import.meta.path,
    bodies: fixture.bodies,
    clip: mountTestBox([12, 1, 20], [0, -0.5, 10]),
    highlight: intersection,
    focus: [0, 0, 8],
    span: 20,
    caption: [
      "Countersunk M3 bolt: axial XZ section through actual stack",
      "Red = bolt/base intersection. Correct assembly has no red.",
      `Tip Z=${tipZ.toFixed(2)}, bore floor Z=${boreFloorZ.toFixed(2)} mm`,
    ],
    measurements: { tipZ, boreFloorZ, collisionVolume },
  })

  expect(collisionVolume).toBeLessThan(geometryTolerance)
  expect(tipZ + geometryTolerance).toBeGreaterThanOrEqual(boreFloorZ)
  expect(() =>
    createFdmEnclosure({
      ...input,
      mounts: [{ ...mount, length: 15.3 }],
    }),
  ).toThrow(/floor|bottom/i)
})
