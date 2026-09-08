import { formatMm } from "format-si-unit"
import type { EnclosureMountInput } from "../enclosure"
import { getHeadRecess, getHeadRecessDepthMm, getThreadSpec } from "../hardware"
import type { FdmDesignRules } from "./design-rules"
import { resolveThreadedFastener } from "@tscircuit/jscad-assembly-hardware"
import { parseEnclosureMountHead } from "./parse-enclosure-mount-head"
import { assertEnclosureMountThread } from "./assert-enclosure-mount-thread"

/**
 * How thick the lid must be to carry its screw heads.
 *
 * A recess removes material from the plate it is cut into, and what remains is
 * all that is left holding the screw down. An M3 countersink is 1.65mm deep, so
 * in the default 2mm printed lid it leaves 0.35mm -- three or four layers, which
 * will crack the first time the screw is torqued. A recess deeper than the plate
 * does not even leave that: it opens a hole and the head falls through.
 *
 * This is applied the way every other inferred dimension in this package is: it
 * *grows* a lid thickness the author did not state, and *validates* one they
 * did. Growing silently past an explicit `lidThickness` would override the very
 * number they set.
 */
export const getLidMountMinimumThicknessMm = ({
  mounts,
  rules,
}: {
  mounts: EnclosureMountInput[]
  rules: FdmDesignRules
}): { value: number; because: string } | undefined => {
  let minimum: { value: number; because: string } | undefined
  for (const mount of mounts) {
    assertEnclosureMountThread(mount)
    if (mount.fastens !== "lid") continue
    const head = parseEnclosureMountHead(mount)
    const headRecess = getHeadRecess({
      head,
      authoredHeadRecess: mount.headRecess,
      hasMachinableSeat: true,
      label: mount.id,
    })
    if (headRecess === "none") continue
    const recessDepthMm = getHeadRecessDepthMm({
      fastener: resolveThreadedFastener({
        fn: mount.fastening === "self_tapping" ? "screw" : "bolt",
        thread: mount.thread,
        head,
        length: getThreadSpec(mount.thread).availableLengthsMm.at(-1)!,
      }),
      headRecess,
      clearanceDiameterMm: getThreadSpec(mount.thread).clearanceHoleMm,
    })
    const value = recessDepthMm + rules.minMaterialUnderHeadRecessMm
    if (minimum && minimum.value >= value) continue
    minimum = {
      value,
      because: `to leave ${formatMm(
        rules.minMaterialUnderHeadRecessMm,
      )} of lid under the ${formatMm(recessDepthMm)} ${headRecess} for ${mount.id}'s ${mount.thread} head`,
    }
  }
  return minimum
}
