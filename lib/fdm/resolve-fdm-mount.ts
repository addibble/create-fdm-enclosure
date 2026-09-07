import { mat4 } from "gl-matrix"
import {
  resolveHeatsetInsert,
  resolveSpacer,
} from "@tscircuit/jscad-assembly-hardware"
import type {
  EnclosureMountInput,
  ResolvedEnclosureDimensions,
} from "../enclosure"
import type { EnclosureAssemblyFrame } from "../assembly"
import {
  formatThreadDesignation,
  getBomGroupKey,
  getHeadRecess,
  getInsertDesignation,
  getInsertDisplayValue,
  getScrewDesignation,
  getScrewDisplayValue,
  getInsertHardwareString,
  getThreadedFastenerHardwareString,
  getScrewHeadSpec,
  getSpacerDesignation,
  getSpacerHardwareString,
  getSpacerDisplayValue,
  getThreadSpec,
  selectSpacer,
  type SelectedSpacer,
} from "../hardware"
import { assertPositive, assertNonNegative } from "../validation/assert-number"
import type { FdmDesignRules } from "./design-rules"
import { selectFdmMountHardware } from "./select-mount-hardware"
import { createFdmMatrix, getFdmHardwarePlacement } from "./placement-matrix"
import type { HardwareOccurrence, ResolvedFdmMount } from "./types"

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
  const threadSpec = getThreadSpec(mount.thread)
  const headSpec = getScrewHeadSpec(mount.thread, mount.head)
  const center = { x: mount.anchor.x, y: mount.anchor.y }
  const fastensLid = mount.fastens === "lid"
  const headRecess = getHeadRecess({
    head: mount.head,
    authoredHeadRecess: mount.headRecess,
    hasMachinableSeat: fastensLid,
    label: mount.id,
  })
  if (!fastensLid && mount.lidColumn !== undefined) {
    throw new Error(
      `${mount.id}: lidColumn only applies to a mount that fastens the lid, and this one fastens the board`,
    )
  }
  const bossTopZ = frame.boardBottomZ
  const bossHeightMm = bossTopZ - frame.floorTopZ
  if (bossHeightMm <= 0)
    throw new Error(`${mount.id}: there is no room for a boss above the floor`)
  assertNonNegative(rules.minFloorUnderBoreMm, "fdmRules.minFloorUnderBoreMm")
  const availableBoreDepthMm =
    bossHeightMm + dimensions.floorThickness - rules.minFloorUnderBoreMm
  if (mount.pcbHoleDiameter !== undefined) {
    assertPositive(mount.pcbHoleDiameter, `${mount.id}.pcbHoleDiameter`)
    if (mount.pcbHoleDiameter + 1e-9 < threadSpec.closeClearanceHoleMm) {
      throw new Error(
        `${mount.id}: the PCB hole is ${mount.pcbHoleDiameter}mm, which will not pass an ${formatThreadDesignation(mount.thread)} screw -- it needs at least ${threadSpec.closeClearanceHoleMm}mm`,
      )
    }
  }
  const clampedThicknessMm = fastensLid
    ? frame.totalHeight - frame.boardBottomZ
    : boardThicknessMm
  const selected = selectFdmMountHardware({
    mount,
    rules,
    headRecess,
    clampedThicknessMm,
    availableBoreDepthMm,
    bossHeightMm,
  })
  const {
    insert,
    installation,
    fastener,
    screwLength,
    bossDiameterMm,
    boreDepthMm,
  } = selected
  const boreDiameterMm = installation.boreDiameterMm
  const targetAt = (z: number) => {
    const target = createFdmMatrix()
    mat4.fromTranslation(target, [center.x, center.y, z])
    return target
  }
  const bearingSurfaceZ = fastensLid ? frame.totalHeight : frame.boardTopZ
  const screwDatum =
    headRecess === "none" ? fastener.datums.underHead : fastener.datums.headTop
  if (!screwDatum)
    throw new Error(`${mount.id}: the physical head has no flat bearing datum`)
  const screwPlacement = getFdmHardwarePlacement(
    targetAt(bearingSurfaceZ),
    screwDatum,
  )
  const headSeatZ = screwPlacement.position.z
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
      hardwareString: getThreadedFastenerHardwareString({
        thread: mount.thread,
        designatedLengthMm: screwLength.designatedLengthMm,
        head: mount.head,
        fastening: mount.fastening,
      }),
      displayValue: getScrewDisplayValue({
        thread: mount.thread,
        head: mount.head,
        designatedLengthMm: screwLength.designatedLengthMm,
      }),
      manufacturerPartNumber: mount.manufacturerPartNumber,
      supplierPartNumbers: mount.supplierPartNumbers,
      bomGroupKey: getBomGroupKey(screwDesignation),
      generatedBy: mount.generatedBy,
      ...screwPlacement,
    },
  ]
  if (insert) {
    const designation = getInsertDesignation(mount.thread, insert)
    const partFromDatum =
      insert.method === "heat_set_insert"
        ? resolveHeatsetInsert({
            fn: "heatsetinsert",
            thread: mount.thread,
            length: insert.lengthMm,
          }).datums.upperFace
        : // Press-fit inserts have no model; their occurrence still names the installed top plane.
          createFdmMatrix()
    hardware.push({
      id: `${mount.id}.insert`,
      role: "insert",
      mountId: mount.id,
      designation,
      hardwareString: getInsertHardwareString({
        thread: mount.thread,
        lengthMm: insert.lengthMm,
        method: insert.method,
      }),
      displayValue: getInsertDisplayValue(mount.thread, insert),
      bomGroupKey: getBomGroupKey(designation),
      generatedBy: mount.generatedBy,
      ...getFdmHardwarePlacement(targetAt(bossTopZ), partFromDatum),
    })
  }
  const lidUndersideZ = frame.totalHeight - dimensions.lidThickness
  const boardToLidGapMm = lidUndersideZ - frame.boardTopZ
  let spacer: SelectedSpacer | undefined
  if (fastensLid && mount.lidColumn === "spacer") {
    spacer = selectSpacer({
      thread: mount.thread,
      gapMm: boardToLidGapMm,
      minimumBoreDiameterMm: threadSpec.closeClearanceHoleMm,
      label: mount.id,
    })
    const designation = getSpacerDesignation(spacer)
    const physicalSpacer = resolveSpacer({
      fn: "spacer",
      outerDiameter: spacer.spec.outerDiameterMm,
      innerDiameter: spacer.spec.innerDiameterMm,
      length: spacer.lengthMm,
    })
    hardware.push({
      id: `${mount.id}.spacer`,
      role: "spacer",
      mountId: mount.id,
      designation,
      hardwareString: getSpacerHardwareString({
        outerDiameterMm: spacer.spec.outerDiameterMm,
        innerDiameterMm: spacer.spec.innerDiameterMm,
        lengthMm: spacer.lengthMm,
      }),
      displayValue: getSpacerDisplayValue(spacer),
      bomGroupKey: getBomGroupKey(designation),
      generatedBy: mount.generatedBy,
      ...getFdmHardwarePlacement(
        targetAt(lidUndersideZ),
        physicalSpacer.datums.upperFace,
      ),
    })
  }
  return {
    mount,
    center,
    spacer,
    lidColumn:
      fastensLid &&
      (mount.lidColumn ?? "printed") === "printed" &&
      boardToLidGapMm > 0
        ? {
            bottomZ: frame.boardTopZ,
            topZ: lidUndersideZ,
            diameterMm: bossDiameterMm,
          }
        : undefined,
    bossDiameterMm,
    boreDiameterMm,
    boreDepthMm,
    bossBottomZ: frame.floorTopZ,
    bossTopZ,
    insert,
    installation,
    fastener,
    headRecess,
    headSpec,
    screwClearanceDiameterMm: threadSpec.clearanceHoleMm,
    screwLength,
    headSeatZ,
    hardware,
  }
}
