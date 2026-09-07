import { expect, test } from "bun:test"
import { createFdmEnclosure, type CreateFdmEnclosureOutput } from "../lib"
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

test("insert selection finds the feasible short insert and stocked 5mm screw", async () => {
  const input = {
    board: mountTestBoard,
    standoffHeight: 5,
    mounts: [{ ...mountTestLidMount, fastens: "board" as const }],
  }
  const outcomes: Array<{
    authoredLength: number | undefined
    output?: CreateFdmEnclosureOutput
    rejection?: string
  }> = []
  for (const authoredLength of [undefined, 5]) {
    try {
      outcomes.push({
        authoredLength,
        output: createFdmEnclosure({
          ...input,
          mounts: [{ ...input.mounts[0]!, length: authoredLength }],
        }),
      })
    } catch (error) {
      const knownRejection =
        authoredLength === undefined
          ? /^EN1\.H1: no stocked M3 screw fits this stack/
          : /^EN1\.H1: an authored M3x5 screw engages only/
      if (!(error instanceof Error) || !knownRejection.test(error.message)) {
        throw error
      }
      outcomes.push({ authoredLength, rejection: error.message })
    }
  }

  // A stricter floor reserve excludes the standard insert without moving the
  // PCB, head seat, or enclosure. This is genuine solver output for the same
  // physical stack, not a fabricated "successful" output for the rejected one.
  const counterpart = createMountTestFixture({
    ...input,
    fdmRules: { minFloorUnderBoreMm: 1 },
  })
  const screw = mountTestHardware(counterpart.output, "screw")
  const intersection = mountTestIntersection(screw, counterpart.base)
  const collisionVolume = mountTestVolume(intersection)
  const tipZ = mountTestBounds(screw)[0][2]
  const selected = counterpart.output.mounts[0]!

  await writeMountTestDiagnostic({
    testPath: import.meta.path,
    suffix: "-feasible-counterpart",
    bodies: counterpart.bodies,
    clip: mountTestBox([12, 1, 14], [0, -0.5, 7]),
    highlight: intersection,
    focus: [0, 0, 6],
    span: 15,
    caption: [
      "KNOWN FEASIBLE COUNTERPART - NOT THE REJECTED OUTPUT",
      "Same 5mm standoff, stronger 1mm floor reserve selects SHORT",
      "Actual solver output: 3mm insert + stocked M3x5 bolt",
      "Default reserve and authored 5mm must find this feasible pair.",
    ],
    measurements: {
      rejections: outcomes.map(({ authoredLength, rejection }) => ({
        authoredLength: authoredLength ?? "automatic",
        rejection,
      })),
      counterpart: {
        insert: selected.insert,
        screw: selected.screwLength,
        tipZ,
        collisionVolume,
      },
    },
  })

  expect(selected.insert?.series).toBe("short")
  expect(selected.insert?.lengthMm).toBe(3)
  expect(selected.screwLength.designatedLengthMm).toBe(5)
  expect(collisionVolume).toBeLessThan(geometryTolerance)
  expect(selected.bossTopZ - tipZ).toBeGreaterThanOrEqual(3)
  expect(outcomes.map((outcome) => outcome.rejection)).toEqual([
    undefined,
    undefined,
  ])
  for (const outcome of outcomes) {
    expect(outcome.output?.mounts[0]?.insert?.series).toBe("short")
    expect(outcome.output?.mounts[0]?.screwLength.designatedLengthMm).toBe(5)
  }
})
