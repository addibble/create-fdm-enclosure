import { getInsertOptions } from "../hardware"
import type { EnclosureMountInput } from "../enclosure"
import type { FdmDesignRules } from "./design-rules"
import { DEFAULT_FDM_DESIGN_RULES } from "./design-rules"
import { assertEnclosureMountThread } from "./assert-enclosure-mount-thread"

/**
 * Diameter of the hole bored into the printed boss.
 *
 * Deliberately independent of how deep the boss is: an insert series varies in
 * length, not in installation diameter, and a self-tap pilot is a property of
 * the thread. That is what lets the box be *sized* around a corner column before
 * the vertical stack -- and therefore the insert length -- has been resolved.
 */
export const getMountBoreDiameterMm = (
  mount: Pick<EnclosureMountInput, "thread" | "fastening" | "pilotDiameter">,
  rules: FdmDesignRules = DEFAULT_FDM_DESIGN_RULES,
): number => {
  assertEnclosureMountThread(mount)
  if (mount.fastening === "self_tapping") {
    return mount.pilotDiameter ?? rules.selfTapPilotDiametersMm[mount.thread]
  }
  const options = getInsertOptions(mount.thread, mount.fastening)
  const diameters = new Set(
    options.map((insert) => insert.installHoleDiameterMm),
  )
  if (diameters.size > 1) {
    // Sizing the box before the insert is selected is only sound while one
    // installation diameter serves the whole series. If a catalogue entry ever
    // breaks that, say so here rather than silently sizing the boss for the
    // wrong bore.
    throw new Error(
      `The ${mount.thread} ${mount.fastening.replace(/_/g, " ")} series has more than one installation diameter (${[
        ...diameters,
      ].join(", ")}mm), so a boss cannot be sized before its insert is chosen`,
    )
  }
  return options[0]!.installHoleDiameterMm
}

/**
 * Outside diameter of the printed boss.
 *
 * The bore plus a printed wall on each side. The wall is a process rule, not a
 * fastener property: it is what stops a heat-set insert from splitting the boss
 * as it is pressed in.
 */
export const getMountBossDiameterMm = ({
  mount,
  rules,
  boreDiameterMm = getMountBoreDiameterMm(mount, rules),
}: {
  mount: Pick<
    EnclosureMountInput,
    "thread" | "fastening" | "bossDiameter" | "pilotDiameter"
  >
  rules: FdmDesignRules
  boreDiameterMm?: number
}): number => {
  const derived = boreDiameterMm + 2 * rules.minInsertWallMm
  if (mount.bossDiameter === undefined) return derived
  if (mount.bossDiameter < boreDiameterMm + 2 * rules.minInsertWallMm) {
    throw new Error(
      `bossDiameter ${mount.bossDiameter}mm leaves less than the ${rules.minInsertWallMm}mm minimum wall around a ${boreDiameterMm}mm bore`,
    )
  }
  return mount.bossDiameter
}
