import { expect, test } from "bun:test"
import {
  createFdmEnclosure,
  DEFAULT_FDM_DESIGN_RULES,
  resolveFdmInstallationPolicy,
  getInsertOptions,
} from "../lib"

test("authored installation constraints survive selection and invalid dimensions are rejected", () => {
  const mount = {
    id: "H1",
    fastens: "board" as const,
    anchor: { x: 0, y: 0 },
    thread: "m3" as const,
    fastening: "self_tapping" as const,
    head: "socketcap" as const,
    threadEngagement: 7,
    pilotDiameter: 2.8,
    bottomClearance: 2,
    boreEntryChamfer: 1.6,
  }
  const input = {
    board: { width: 40, height: 24, thickness: 1.6 },
    standoffHeight: 14,
    mounts: [mount],
  }
  const result = createFdmEnclosure(input).mounts[0]!
  expect(result.installation.requiredEngagementMm).toBe(7)
  expect(result.boreDiameterMm).toBe(2.8)
  expect(result.installation.boreEntryChamfer.outerDiameterMm).toBeCloseTo(4.48)
  const tipZ = result.hardware[0]!.position.z - result.fastener.shaft.lengthMm
  expect(tipZ - (result.bossTopZ - result.boreDepthMm)).toBeCloseTo(2)
  expect(() =>
    createFdmEnclosure({
      ...input,
      mounts: [{ ...mount, bottomClearance: 30 }],
    }),
  ).toThrow(/bottom|floor/)
  for (const override of [
    { pilotDiameter: 3 },
    { threadEngagement: 0 },
    { bottomClearance: -1 },
    { boreEntryChamfer: 0.9 },
  ]) {
    expect(() =>
      createFdmEnclosure({ ...input, mounts: [{ ...mount, ...override }] }),
    ).toThrow()
  }
  const insertMount = {
    ...mount,
    fastening: "heat_set_insert" as const,
    pilotDiameter: undefined,
    threadEngagement: undefined,
    bottomClearance: undefined,
    boreEntryChamfer: undefined,
    insertBottomClearance: 2,
    insertBoreEntryChamfer: 1.3,
  }
  const insert = {
    ...getInsertOptions("m3", "heat_set_insert")[0]!,
    installationRecommendations: {
      bottomClearanceMm: 0.7,
      boreEntryChamferRatio: 1.1,
    },
  }
  const rules = {
    ...DEFAULT_FDM_DESIGN_RULES,
    insertMeltReliefMm: 0.9,
    boreEntryChamferDiameterRatio: 1.4,
  }
  expect(
    resolveFdmInstallationPolicy({ mount: insertMount, insert, rules })
      .insertBottomClearanceMm,
  ).toBe(2)
  const recommended = resolveFdmInstallationPolicy({
    mount: {
      ...insertMount,
      insertBottomClearance: undefined,
      insertBoreEntryChamfer: undefined,
    },
    insert,
    rules,
  })
  expect(recommended.insertBottomClearanceMm).toBe(0.7)
  expect(recommended.boreEntryChamfer.outerDiameterMm).toBeCloseTo(4.4)
  const resolvedInsert = createFdmEnclosure({ ...input, mounts: [insertMount] })
    .mounts[0]!
  expect(resolvedInsert.boreDepthMm).toBeGreaterThanOrEqual(
    resolvedInsert.insert!.lengthMm + 2,
  )
  expect(
    resolvedInsert.installation.boreEntryChamfer.outerDiameterMm,
  ).toBeCloseTo(5.2)
})
