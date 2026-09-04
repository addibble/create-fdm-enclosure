import { formatMm } from "format-si-unit"
import { getThreadSpec } from "./select-fastener"
import type { FastenerThread, HeadRecess, ScrewHeadSpec } from "./types"

/**
 * How far a screw must engage its thread to hold.
 *
 * A property of the fastening method, not of the screw:
 *
 * - an insert supplies its own thread, so full engagement is the insert's
 *   threaded length -- and also the upper bound, since a screw longer than that
 *   bottoms out on the insert's blind end and stops clamping;
 * - a machine thread formed in a thermoplastic boss needs roughly two nominal
 *   diameters, the usual figure for plastics, because the material is far weaker
 *   than the screw and the joint fails by stripping the boss.
 */
export const getRequiredEngagementMm = (params: {
  thread: FastenerThread
  insertThreadedLengthMm?: number
}): number =>
  params.insertThreadedLengthMm ??
  2 * getThreadSpec(params.thread).nominalDiameterMm

/**
 * How far below the surface it bears on the head sits.
 *
 * Zero for a head left proud. A counterbore or a countersink buries the head, so
 * the screw enters the material that much lower and needs that much less length
 * under the head.
 */
export const getHeadSeatDepthMm = ({
  headSpec,
  headRecess,
  nominalDiameterMm,
}: {
  headSpec: ScrewHeadSpec
  headRecess: HeadRecess
  /** Needed to derive a countersunk head's real height; see below. */
  nominalDiameterMm: number
}): number => {
  if (headRecess === "none") return 0
  // A counterbore swallows the whole head, so its own height is the depth.
  if (headRecess === "counterbore") return headSpec.headHeightMm
  // A countersunk head is NOT `k` tall. `k` is measured to the theoretical
  // sharp corner, which does not exist in steel -- the real head is truncated
  // at `dk actual`, and its cone runs from there down to the shank. At M3 that
  // is 1.27mm against a published k of 1.86mm.
  //
  // This must equal what the geometry package draws above its datum, because
  // that is what the number is FOR: it places the part. Same formula, same
  // angle, so the two cannot drift.
  const halfAngleRad =
    (((headSpec.countersinkAngleDegrees ?? 90) / 2) * Math.PI) / 180
  return (
    (headSpec.headDiameterMm - nominalDiameterMm) / 2 / Math.tan(halfAngleRad)
  )
}

export interface ScrewLengthResolution {
  /**
   * The length that names the screw, and the one a BOM line carries.
   *
   * Not always the length under the head: a countersunk screw's designated
   * length is measured **overall**, including the buried head (ISO 7046), while
   * a cap, pan or button head screw's is measured under the head (ISO 4762 and
   * friends). Ignoring that difference makes every countersunk screw one head
   * height too short -- which for an M3 is 1.65 mm and, at 4 mm of engagement,
   * silently halves the joint.
   */
  designatedLengthMm: number
  /** Shank below the head. What the geometry actually consumes. */
  underHeadLengthMm: number
  /** Minimum under-head length before rounding, for diagnostics. */
  requiredUnderHeadLengthMm: number
  /** Thread engaged after rounding. Never less than required. */
  engagementMm: number
}

/**
 * Derive a screw length from the stack, then round it up to a length a vendor
 * actually stocks -- and prove the rounded length is still legal.
 *
 * Rounding is the step that can break the joint, so the upper bound is checked
 * *after* it rather than before:
 *
 * - the derived length is the minimum that reaches full engagement;
 * - the next stocked length up may then bottom out in an insert, or break
 *   through the outside of a self-tapped boss.
 *
 * When it does, no stocked screw fits this stack at all, and that is reported
 * with both bounds rather than emitting a screw that quietly does not hold.
 * There is deliberately no "try the next shorter one" fallback: the lengths are
 * sorted, so the shortest length that engages is the *only* candidate that could
 * also be short enough, and anything below it is by definition too short. A
 * fallback there would be unreachable code that reads like a safety net.
 */
export const resolveScrewLength = ({
  thread,
  headSpec,
  headRecess,
  clampedThicknessMm,
  engagementMm,
  maxUnderHeadLengthMm,
  authoredLengthMm,
  availableLengthsMm: suppliedLengthsMm,
  label,
}: {
  thread: FastenerThread
  headSpec: ScrewHeadSpec
  headRecess: HeadRecess
  /**
   * Material between the head's bearing surface and the start of the thread it
   * engages -- lid plate, air gap, PCB. Measured from the bearing surface, so
   * the head recess is subtracted separately by `getHeadSeatDepthMm`.
   */
  clampedThicknessMm: number
  engagementMm: number
  /**
   * Longest under-head length that is still legal: the depth available before
   * the screw bottoms out in an insert or breaks through a printed floor.
   */
  maxUnderHeadLengthMm: number
  /** Authored `length`, which pins the designated length but not the rules. */
  authoredLengthMm?: number
  /**
   * Lengths a vendor actually stocks in this thread.
   *
   * Injected rather than read from the catalogue here, so a hardware engine can
   * supply the current series for the supplier being bought from: "which lengths
   * exist" is a fact about a vendor, not about a standard, and the built-in
   * catalogue is only a curated default. Sorted defensively, because the rounding
   * rules depend on the order and an engine's list arrives from outside.
   */
  availableLengthsMm?: number[]
  /** Caller-facing name of the mount, for error messages. */
  label: string
}): ScrewLengthResolution => {
  const availableLengthsMm = [
    ...(suppliedLengthsMm ?? getThreadSpec(thread).availableLengthsMm),
  ].sort((a, b) => a - b)
  if (availableLengthsMm.length === 0) {
    throw new Error(`${label}: no stocked ${thread} lengths were supplied`)
  }
  const headSeatDepthMm = getHeadSeatDepthMm({
    headSpec,
    headRecess,
    nominalDiameterMm: getThreadSpec(thread).nominalDiameterMm,
  })
  const isOverallLength = headSpec.head === "countersunk"
  const headAllowanceMm = isOverallLength ? headSpec.headHeightMm : 0

  const requiredUnderHeadLengthMm =
    clampedThicknessMm - headSeatDepthMm + engagementMm
  const maxDesignatedLengthMm = maxUnderHeadLengthMm + headAllowanceMm
  const minDesignatedLengthMm = requiredUnderHeadLengthMm + headAllowanceMm

  const describe = (designatedLengthMm: number): ScrewLengthResolution => ({
    designatedLengthMm,
    underHeadLengthMm: designatedLengthMm - headAllowanceMm,
    requiredUnderHeadLengthMm,
    engagementMm:
      designatedLengthMm -
      headAllowanceMm -
      (clampedThicknessMm - headSeatDepthMm),
  })

  if (authoredLengthMm !== undefined) {
    if (authoredLengthMm + 1e-9 < minDesignatedLengthMm) {
      throw new Error(
        `${label}: an authored ${thread}x${authoredLengthMm} screw engages only ${formatMm(
          describe(authoredLengthMm).engagementMm,
        )} of thread, but this stack needs ${formatMm(engagementMm)}`,
      )
    }
    if (authoredLengthMm - 1e-9 > maxDesignatedLengthMm) {
      throw new Error(
        `${label}: an authored ${thread}x${authoredLengthMm} screw is ${formatMm(
          authoredLengthMm - maxDesignatedLengthMm,
        )} too long for this stack, so it bottoms out before it clamps`,
      )
    }
    return describe(authoredLengthMm)
  }

  const rounded = availableLengthsMm.find(
    (candidate) => candidate + 1e-9 >= minDesignatedLengthMm,
  )
  if (rounded === undefined) {
    throw new Error(
      `${label}: this stack needs a ${thread} screw at least ${formatMm(
        minDesignatedLengthMm,
      )} long, but the longest stocked ${thread} is ${formatMm(
        availableLengthsMm[availableLengthsMm.length - 1]!,
      )}`,
    )
  }
  if (rounded <= maxDesignatedLengthMm + 1e-9) return describe(rounded)

  // Reported rather than silently shortened. The length below the bound is named
  // only as context for the author -- it is not a candidate, because it is by
  // construction shorter than the engagement this stack needs.
  const belowBound = [...availableLengthsMm]
    .reverse()
    .find((candidate) => candidate <= maxDesignatedLengthMm + 1e-9)
  throw new Error(
    `${label}: no stocked ${thread} screw fits this stack -- it needs at least ${formatMm(
      minDesignatedLengthMm,
    )} to engage and at most ${formatMm(
      maxDesignatedLengthMm,
    )} before it bottoms out, and the stocked lengths either side are ${
      belowBound !== undefined ? formatMm(belowBound) : "none"
    } and ${formatMm(rounded)}`,
  )
}
