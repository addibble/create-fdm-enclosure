import { expect, test } from "bun:test"
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

test("a purchased spacer occupies the board-to-lid gap, not the laminate", async () => {
  const fixture = createMountTestFixture({
    board: mountTestBoard,
    mounts: [{ ...mountTestLidMount, lidColumn: "spacer" }],
  })
  const spacer = mountTestHardware(fixture.output, "spacer")
  const [minimum, maximum] = mountTestBounds(spacer)
  const intersection = mountTestIntersection(spacer, fixture.board)
  const collisionVolume = mountTestVolume(intersection)
  const { frame, dimensions } = fixture.output
  const lidUndersideZ = frame.totalHeight - dimensions.lidThickness

  await writeMountTestDiagnostic({
    testPath: import.meta.path,
    bodies: fixture.bodies,
    clip: mountTestBox([12, 1, 22], [0, -0.5, 11]),
    highlight: intersection,
    focus: [0, 0, 9],
    span: 22,
    caption: [
      "Purchased 6mm spacer: axial XZ section, PCB is green",
      "Red = spacer/PCB intersection. Spacer belongs ABOVE PCB.",
      `Actual Z=${minimum[2].toFixed(1)}..${maximum[2].toFixed(1)} mm`,
      `Required Z=${frame.boardTopZ.toFixed(1)}..${lidUndersideZ.toFixed(1)} mm`,
    ],
    measurements: {
      actualBottomZ: minimum[2],
      actualTopZ: maximum[2],
      boardTopZ: frame.boardTopZ,
      lidUndersideZ,
      collisionVolume,
    },
  })

  expect(collisionVolume).toBeLessThan(geometryTolerance)
  expect(minimum[2]).toBeCloseTo(frame.boardTopZ, 4)
  expect(maximum[2]).toBeCloseTo(lidUndersideZ, 4)
})
