import { resolveThreadedFastener } from "@tscircuit/jscad-assembly-hardware"
import type { EnclosureMountInput } from "../enclosure"
import {
  getHeadSeatDepthMm,
  getInsertOptions,
  getScrewHeadSpec,
  getThreadSpec,
  resolveScrewLength,
  type HeadRecess,
  type InsertSpec,
} from "../hardware"
import type { FdmDesignRules } from "./design-rules"
import { getMountBossDiameterMm } from "./get-mount-boss-diameter"
import { resolveFdmInstallationPolicy } from "./resolve-installation-policy"

/**
 * Enumerate complete insert/fastener pairs before applying the catalogue's
 * longest-insert preference. No candidate is emitted before both parts fit.
 */
export const selectFdmMountHardware = ({
  mount,
  rules,
  headRecess,
  clampedThicknessMm,
  availableBoreDepthMm,
  bossHeightMm,
}: {
  mount: EnclosureMountInput
  rules: FdmDesignRules
  headRecess: HeadRecess
  clampedThicknessMm: number
  availableBoreDepthMm: number
  bossHeightMm: number
}) => {
  const thread = getThreadSpec(mount.thread)
  const headSpec = getScrewHeadSpec(mount.thread, mount.head)
  const fn = mount.fastening === "self_tapping" ? "screw" : "bolt"
  const reference = resolveThreadedFastener({
    fn,
    thread: mount.thread,
    head: mount.head,
    length: thread.availableLengthsMm.at(-1)!,
  })
  const headSeatDepthMm = getHeadSeatDepthMm({
    fastener: reference,
    headRecess,
  })
  const unthreadedSpanMm = clampedThicknessMm - headSeatDepthMm
  const candidates: Array<InsertSpec | undefined> =
    mount.fastening === "self_tapping"
      ? [undefined]
      : getInsertOptions(mount.thread, mount.fastening)
  const failures: string[] = []
  for (const insert of candidates) {
    const installation = resolveFdmInstallationPolicy({ mount, insert, rules })
    const {
      requiredEngagementMm,
      insertBottomClearanceMm,
      screwBottomClearanceMm,
    } = installation
    const label = insert
      ? `${insert.series} ${insert.lengthMm}mm insert`
      : "self-tapping boss"
    const bossDiameterMm = getMountBossDiameterMm({
      mount,
      rules,
      boreDiameterMm: installation.boreDiameterMm,
    })
    if (
      installation.boreEntryChamfer.outerDiameterMm >= bossDiameterMm ||
      installation.boreEntryChamfer.depthMm >= bossHeightMm
    ) {
      failures.push(
        `${label}: bossDiameter/boreEntryChamfer does not preserve the required boss wall and depth`,
      )
      continue
    }
    if (insert && requiredEngagementMm > insert.threadedLengthMm + 1e-9) {
      failures.push(
        `${label} cannot supply ${requiredEngagementMm}mm thread engagement`,
      )
      continue
    }
    const insertDepthMm = insert ? insert.lengthMm + insertBottomClearanceMm : 0
    if (insertDepthMm > availableBoreDepthMm + 1e-9) {
      failures.push(
        `${label} plus bottom clearance needs ${insertDepthMm}mm, but the floor reserve leaves ${availableBoreDepthMm}mm`,
      )
      continue
    }
    // A self-tapping screw's first full thread starts below its entry chamfer.
    const engagementDepthMm =
      requiredEngagementMm +
      (insert ? 0 : installation.boreEntryChamfer.depthMm)
    const minShaftMm = unthreadedSpanMm + engagementDepthMm
    const maxShaftMm =
      unthreadedSpanMm + availableBoreDepthMm - screwBottomClearanceMm
    const lengths =
      mount.length === undefined
        ? [...thread.availableLengthsMm].sort((a, b) => a - b)
        : [mount.length]
    const fastener = lengths
      .map((length) =>
        resolveThreadedFastener({
          fn,
          thread: mount.thread,
          head: mount.head,
          length,
        }),
      )
      .find(
        ({ shaft }) =>
          shaft.lengthMm + 1e-9 >= minShaftMm &&
          shaft.lengthMm <= maxShaftMm + 1e-9,
      )
    if (!fastener) {
      failures.push(
        `${label} needs ${minShaftMm.toFixed(2)}-${maxShaftMm.toFixed(2)}mm under the head to engage without bottoming out${mount.length === undefined ? ", but no stocked length fits" : `; authored length ${mount.length}mm does not fit`}`,
      )
      continue
    }
    const screwLength = resolveScrewLength({
      thread: mount.thread,
      head: mount.head,
      headSpec,
      headRecess,
      clampedThicknessMm,
      engagementMm: engagementDepthMm,
      maxUnderHeadLengthMm: maxShaftMm,
      authoredLengthMm: fastener.designatedLengthMm,
      label: mount.id,
    })
    const screwPenetrationMm = fastener.shaft.lengthMm - unthreadedSpanMm
    const boreDepthMm = Math.max(
      insertDepthMm,
      screwPenetrationMm + screwBottomClearanceMm,
    )
    if (installation.boreEntryChamfer.depthMm >= boreDepthMm) {
      failures.push(
        `${label}: boreEntryChamfer exceeds the available bore depth`,
      )
      continue
    }
    return {
      insert,
      installation,
      fastener,
      screwLength,
      bossDiameterMm,
      boreDepthMm,
      headSeatDepthMm,
    }
  }
  throw new Error(
    `${mount.id}: no feasible insert/fastener pair: ${failures.join("; ")}`,
  )
}
