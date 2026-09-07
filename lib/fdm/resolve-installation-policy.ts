import type { EnclosureMountInput } from "../enclosure"
import { getThreadSpec, type InsertSpec } from "../hardware"
import { assertNonNegative, assertPositive } from "../validation/assert-number"
import type { FdmDesignRules } from "./design-rules"

export interface FdmInstallationPolicy {
  boreDiameterMm: number
  requiredEngagementMm: number
  screwBottomClearanceMm: number
  insertBottomClearanceMm: number
  boreEntryChamfer: { outerDiameterMm: number; depthMm: number }
}

export type FdmInsertSpec = InsertSpec

/** Process policy is resolved here, never in props or geometry emission. */
export const resolveFdmInstallationPolicy = ({
  mount,
  insert,
  rules,
}: {
  mount: EnclosureMountInput
  insert?: FdmInsertSpec
  rules: FdmDesignRules
}): FdmInstallationPolicy => {
  const thread = getThreadSpec(mount.thread)
  for (const key of [
    "threadEngagement",
    "pilotDiameter",
    "length",
    "bossDiameter",
  ] as const) {
    if (mount[key] !== undefined)
      assertPositive(mount[key], `${mount.id}.${key}`)
  }
  for (const key of ["bottomClearance", "insertBottomClearance"] as const) {
    if (mount[key] !== undefined)
      assertNonNegative(mount[key], `${mount.id}.${key}`)
  }
  if (
    insert &&
    (mount.pilotDiameter !== undefined || mount.boreEntryChamfer !== undefined)
  ) {
    throw new Error(
      `${mount.id}: pilotDiameter and boreEntryChamfer are self-tapping screw overrides; use insertBoreEntryChamfer for an insert`,
    )
  }
  if (
    !insert &&
    (mount.insertBottomClearance !== undefined ||
      mount.insertBoreEntryChamfer !== undefined)
  ) {
    throw new Error(
      `${mount.id}: insert installation overrides require an insert`,
    )
  }
  const boreDiameterMm =
    insert?.installHoleDiameterMm ??
    mount.pilotDiameter ??
    rules.selfTapPilotDiametersMm[mount.thread]
  assertPositive(boreDiameterMm, `${mount.id}.boreDiameter`)
  if (!insert && boreDiameterMm >= thread.nominalDiameterMm) {
    throw new Error(
      `${mount.id}: pilotDiameter must be smaller than the ${thread.nominalDiameterMm}mm thread or there is no material to form it in`,
    )
  }
  const recommendations = insert?.installationRecommendations
  const ratio =
    (insert ? mount.insertBoreEntryChamfer : mount.boreEntryChamfer) ??
    recommendations?.boreEntryChamferRatio ??
    rules.boreEntryChamferDiameterRatio
  assertPositive(ratio, `${mount.id}.boreEntryChamfer`)
  if (ratio < 1) {
    throw new Error(
      `${mount.id}: boreEntryChamfer is a bore-relative ratio and must be at least 1`,
    )
  }
  const requiredEngagementMm =
    mount.threadEngagement ??
    insert?.threadedLengthMm ??
    rules.selfTapEngagementDiameterRatio * thread.nominalDiameterMm
  const screwBottomClearanceMm =
    mount.bottomClearance ?? (insert ? 0 : rules.selfTapPilotReliefMm)
  const insertBottomClearanceMm = insert
    ? (mount.insertBottomClearance ??
      recommendations?.bottomClearanceMm ??
      rules.insertMeltReliefMm)
    : 0
  assertPositive(requiredEngagementMm, `${mount.id}.threadEngagement`)
  assertNonNegative(screwBottomClearanceMm, `${mount.id}.bottomClearance`)
  assertNonNegative(
    insertBottomClearanceMm,
    `${mount.id}.insertBottomClearance`,
  )
  return {
    boreDiameterMm,
    requiredEngagementMm,
    screwBottomClearanceMm,
    insertBottomClearanceMm,
    boreEntryChamfer: {
      outerDiameterMm: boreDiameterMm * ratio,
      depthMm: (boreDiameterMm * (ratio - 1)) / 2,
    },
  }
}
