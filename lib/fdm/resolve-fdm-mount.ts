import { formatMm } from "format-si-unit"
import type {
  EnclosureMountInput,
  ResolvedEnclosureDimensions,
} from "../enclosure"
import type { EnclosureAssemblyFrame } from "../assembly"
import {
  getBomGroupKey,
  getHeadRecess,
  getHeadSeatDepthMm,
  getInsertDesignation,
  getInsertDisplayValue,
  getRequiredEngagementMm,
  getScrewDesignation,
  getScrewDisplayValue,
  getInsertHardwareString,
  getScrewHardwareString,
  getScrewHeadSpec,
  getSpacerDesignation,
  getSpacerHardwareString,
  getSpacerDisplayValue,
  getThreadSpec,
  resolveScrewLength,
  selectInsert,
  selectSpacer,
  type InsertSpec,
  type SelectedSpacer,
} from "../hardware"
import type { FdmDesignRules } from "./design-rules"
import {
  getMountBoreDiameterMm,
  getMountBossDiameterMm,
} from "./get-mount-boss-diameter"
import type { HardwareOccurrence, ResolvedFdmMount } from "./types"

/**
 * Decide everything about one screw boss: its cylinder, its bore, its screw, and
 * the hardware the assembly consumes because of it.
 *
 * The two mounts differ only in what the boss reaches and what the screw passes
 * through on its way in, so they are one function with two stacks rather than
 * two builders:
 *
 * | | PCB mount | Lid mount |
 * | --- | --- | --- |
 * | boss spans | floor top to board underside | floor top to lid underside |
 * | screw passes through | the board's own hole | the lid plate |
 * | head bears on | the PCB -- not ours to machine | the lid -- ours to recess |
 */
export const resolveFdmMount = ({
  mount,
  dimensions,
  frame,
  boardThicknessMm,
  rules,
}: {
  mount: EnclosureMountInput
  dimensions: ResolvedEnclosureDimensions & { lidThickness: number }
  frame: EnclosureAssemblyFrame
  boardThicknessMm: number
  rules: FdmDesignRules
}): ResolvedFdmMount => {
  const label = mount.id
  const threadSpec = getThreadSpec(mount.thread)
  const headSpec = getScrewHeadSpec(mount.thread, mount.head)
  const bossDiameterMm = getMountBossDiameterMm({ mount, rules })
  const boreDiameterMm = getMountBoreDiameterMm(mount)
  // The board is centred in the enclosure, so a board point is already an
  // enclosure point. Stated rather than assumed: if that ever stops being true,
  // this is where the offset belongs.
  const center = { x: mount.anchor.x, y: mount.anchor.y }

  const fastensLid = mount.fastens === "lid"
  // The head bears on the PCB for a board mount, and the enclosure does not
  // machine the board -- so a recess there would be cut into the wrong part. A
  // lid screw's head bears on the lid, which is ours.
  const headRecess = getHeadRecess({
    head: mount.head,
    authoredHeadRecess: mount.headRecess,
    hasMachinableSeat: fastensLid,
    label,
  })
  if (!fastensLid && mount.lidColumn !== undefined) {
    throw new Error(
      `${label}: lidColumn only applies to a mount that fastens the lid, and this one fastens the board`,
    )
  }

  // The boss is the same for both: floor to the underside of the board. What
  // differs is how far the screw reaches past it, not how far the boss does.
  const bossTopZ = frame.boardBottomZ
  const bossHeightMm = bossTopZ - frame.floorTopZ
  if (bossHeightMm <= 0) {
    throw new Error(
      `${label}: there is no room for a boss -- the floor already reaches ${formatMm(
        frame.floorTopZ,
      )} and it would have to stop at ${formatMm(bossTopZ)}`,
    )
  }

  // A bore may continue into the floor, but not through it: what remains below
  // is the only thing keeping the screw from pushing a plug out of the bottom.
  const availableBoreDepthMm =
    bossHeightMm + dimensions.floorThickness - rules.minFloorUnderBoreMm

  let insert: InsertSpec | undefined
  if (mount.fastening !== "self_tapping") {
    insert = selectInsert({
      thread: mount.thread,
      method: mount.fastening,
      availableBoreDepthMm: availableBoreDepthMm - rules.insertMeltReliefMm,
    })
    if (!insert) {
      throw new Error(
        `${label}: a ${mount.thread} ${mount.fastening.replace(/_/g, " ")} does not fit. The boss is ${formatMm(
          bossHeightMm,
        )} tall over a ${formatMm(
          dimensions.floorThickness,
        )} floor, which leaves ${formatMm(
          availableBoreDepthMm - rules.insertMeltReliefMm,
        )} of bore once ${formatMm(
          rules.minFloorUnderBoreMm,
        )} of floor and ${formatMm(rules.insertMeltReliefMm)} of melt relief are kept back`,
      )
    }
  }

  if (
    mount.pcbHoleDiameter !== undefined &&
    mount.pcbHoleDiameter + 1e-9 < threadSpec.closeClearanceHoleMm
  ) {
    throw new Error(
      `${label}: the PCB hole is ${formatMm(
        mount.pcbHoleDiameter,
      )}, which will not pass a ${mount.thread} screw -- it needs at least ${formatMm(
        threadSpec.closeClearanceHoleMm,
      )}`,
    )
  }

  // What the screw spans before it reaches thread, measured from the surface the
  // head bears on -- so a recess is accounted for separately.
  //
  // A lid screw spans the whole stack down to the boss: lid plate, the headroom
  // above the board (filled by a printed column or left as air), and the board
  // itself. It is the same span either way, which is why the column changes the
  // geometry and the clamping but not the screw.
  const clampedThicknessMm = fastensLid
    ? frame.totalHeight - frame.boardBottomZ
    : boardThicknessMm
  const engagementMm = getRequiredEngagementMm({
    thread: mount.thread,
    insertThreadedLengthMm: insert?.threadedLengthMm,
  })
  const headSeatDepthMm = getHeadSeatDepthMm({
    headSpec,
    headRecess,
    nominalDiameterMm: threadSpec.nominalDiameterMm,
  })
  // The hard limit is the floor, not the insert: an insert is a barrel open at
  // both ends, so a screw may continue past it into the bore below. What it may
  // not do is reach material -- which is what `availableBoreDepthMm` already
  // keeps back.
  const maxUnderHeadLengthMm =
    clampedThicknessMm - headSeatDepthMm + availableBoreDepthMm

  const screwLength = resolveScrewLength({
    thread: mount.thread,
    headSpec,
    headRecess,
    clampedThicknessMm,
    engagementMm,
    maxUnderHeadLengthMm,
    authoredLengthMm: mount.length,
    label,
  })

  // The bore is deepened to the screw that was actually chosen, because rounding
  // up to a stocked length is what decides how far the screw reaches. Deriving
  // it the other way round -- fixing the bore at the insert's length and then
  // requiring the screw to fit it -- rejects every stack whose exact length is
  // not itself a stocked size, which is most of them.
  const screwPenetrationMm =
    screwLength.underHeadLengthMm - (clampedThicknessMm - headSeatDepthMm)
  const boreDepthMm = Math.min(
    Math.max(
      insert
        ? insert.lengthMm + rules.insertMeltReliefMm
        : engagementMm + rules.selfTapPilotReliefMm,
      screwPenetrationMm,
    ),
    availableBoreDepthMm,
  )

  // Where the head's bearing surface sits: on the PCB's top face, or on the
  // lid's outer face -- less the recess, when one is cut.
  //
  // `headSeatDepthMm` is how far a recess sinks the seat below the surface, and
  // it already shortens the screw above. It has to move the part too, or the
  // head is drawn resting on top of a hole it should be sitting inside: the
  // length says recessed and the render says proud. Zero for a board mount,
  // which never has a machinable seat.
  const headSeatZ = fastensLid
    ? frame.totalHeight - headSeatDepthMm
    : frame.boardTopZ

  const screwDesignation = getScrewDesignation({
    thread: mount.thread,
    headSpec,
    designatedLengthMm: screwLength.designatedLengthMm,
  })
  const hardware: HardwareOccurrence[] = [
    {
      id: `${mount.id}.screw`,
      role: "screw",
      mountId: mount.id,
      designation: screwDesignation,
      hardwareString: getScrewHardwareString({
        thread: mount.thread,
        designatedLengthMm: screwLength.designatedLengthMm,
        head: mount.head,
      }),
      displayValue: getScrewDisplayValue({
        thread: mount.thread,
        headSpec,
        designatedLengthMm: screwLength.designatedLengthMm,
      }),
      manufacturerPartNumber: mount.manufacturerPartNumber,
      supplierPartNumbers: mount.supplierPartNumbers,
      bomGroupKey: getBomGroupKey(screwDesignation),
      generatedBy: mount.generatedBy,
      position: { x: center.x, y: center.y, z: headSeatZ },
    },
  ]
  if (insert) {
    const insertDesignation = getInsertDesignation(insert)
    hardware.push({
      id: `${mount.id}.insert`,
      role: "insert",
      mountId: mount.id,
      designation: insertDesignation,
      hardwareString: getInsertHardwareString({
        thread: insert.thread,
        lengthMm: insert.lengthMm,
        method: insert.method,
      }),
      displayValue: getInsertDisplayValue(insert),
      bomGroupKey: getBomGroupKey(insertDesignation),
      generatedBy: mount.generatedBy,
      position: { x: center.x, y: center.y, z: bossTopZ },
    })
  }

  // The gap the board-to-lid column has to fill. It is exactly the headroom: the
  // lid's underside sits one lid thickness below the outside top, and the board's
  // top surface is the headroom below that.
  const boardToLidGapMm =
    frame.totalHeight - dimensions.lidThickness - frame.boardTopZ
  let spacer: SelectedSpacer | undefined
  if (fastensLid && mount.lidColumn === "spacer") {
    spacer = selectSpacer({
      thread: mount.thread,
      gapMm: boardToLidGapMm,
      minimumBoreDiameterMm: threadSpec.closeClearanceHoleMm,
      label,
    })
    const spacerDesignation = getSpacerDesignation(spacer)
    hardware.push({
      id: `${mount.id}.spacer`,
      role: "spacer",
      mountId: mount.id,
      designation: spacerDesignation,
      hardwareString: getSpacerHardwareString({
        outerDiameterMm: spacer.spec.outerDiameterMm,
        innerDiameterMm: spacer.spec.innerDiameterMm,
        lengthMm: spacer.lengthMm,
      }),
      displayValue: getSpacerDisplayValue(spacer),
      bomGroupKey: getBomGroupKey(spacerDesignation),
      generatedBy: mount.generatedBy,
      position: { x: center.x, y: center.y, z: frame.boardTopZ },
    })
  }

  return {
    mount,
    center,
    spacer,
    // Hangs from the lid down to the board's top surface. Only ever printed on
    // the lid: standing it up from the floor would block the board's own
    // installation, since it occupies the hole the board must be lowered over.
    lidColumn:
      fastensLid && (mount.lidColumn ?? "printed") === "printed"
        ? {
            bottomZ: frame.boardTopZ,
            topZ: frame.totalHeight - dimensions.lidThickness,
            diameterMm: bossDiameterMm,
          }
        : undefined,
    bossDiameterMm,
    boreDiameterMm,
    boreDepthMm,
    bossBottomZ: frame.floorTopZ,
    bossTopZ,
    insert,
    headRecess,
    headSpec,
    screwClearanceDiameterMm: threadSpec.clearanceHoleMm,
    screwLength,
    headSeatZ,
    hardware,
  }
}
