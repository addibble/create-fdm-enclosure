import * as jscad from "@jscad/modeling"
import type {
  ResolvedEnclosureAperture,
  ResolvedEnclosureAperturePlacement,
} from "../../enclosure/types"
import type { FdmDesignRules } from "../design-rules"
import { executeFdmSolid, fdmSolidsIntersect } from "../execute-solid"
import { getFdmSolidAxisDistanceMm } from "../solid-axis-distance"
import type { FdmDesignRuleViolation, ResolvedFdmMount } from "../types"

/** The actual composition cutter, not an independently reconstructed envelope. */
export const checkInsertEncirclement = ({
  mounts,
  placements,
  apertures,
  rules,
}: {
  mounts: ResolvedFdmMount[]
  placements: ResolvedEnclosureAperturePlacement[]
  apertures: ResolvedEnclosureAperture[]
  rules: FdmDesignRules
}): FdmDesignRuleViolation[] => {
  if (apertures.length !== placements.length) {
    throw new Error(
      "FDM aperture solids must correspond one-to-one with their placements",
    )
  }
  const cutters = apertures.map(({ jscadPlan }) => executeFdmSolid(jscadPlan))
  const violations: FdmDesignRuleViolation[] = []
  for (const mount of mounts) {
    const columns = [
      {
        label: "screw boss",
        bottomZ: mount.bossBottomZ,
        topZ: mount.bossTopZ,
        radiusMm: mount.bossDiameterMm / 2,
        boreRadiusMm: mount.boreDiameterMm / 2,
      },
      ...(mount.lidColumn
        ? [
            {
              label: "lid column",
              ...mount.lidColumn,
              radiusMm: mount.lidColumn.diameterMm / 2,
              boreRadiusMm: mount.screwClearanceDiameterMm / 2,
            },
          ]
        : []),
    ]
    for (const column of columns) {
      if (column.topZ <= column.bottomZ) continue
      const envelope = jscad.primitives.cylinder({
        radius: column.radiusMm,
        height: column.topZ - column.bottomZ,
        center: [
          mount.center.x,
          mount.center.y,
          (column.topZ + column.bottomZ) / 2,
        ],
        segments: 32,
      })
      for (const [apertureIndex, cutter] of cutters.entries()) {
        if (!fdmSolidsIntersect(envelope, cutter)) continue
        const cut = jscad.booleans.intersect(envelope, cutter)
        const radialDistanceMm = getFdmSolidAxisDistanceMm(cut, mount.center)
        const remainingWallMm = radialDistanceMm - column.boreRadiusMm
        if (remainingWallMm + 1e-6 >= rules.minInsertWallMm) continue
        const face = placements[apertureIndex]!.face
        violations.push({
          rule: "insert_not_encircled",
          severity: remainingWallMm > 0 ? "warning" : "error",
          measuredMm: remainingWallMm,
          limitMm: rules.minInsertWallMm,
          mountId: mount.mount.id,
          apertureIndex,
          face,
          message:
            remainingWallMm > 0
              ? `The ${face} aperture cuts into the ${column.label} of mount "${mount.mount.id}", leaving ${remainingWallMm.toFixed(2)}mm of wall around its bore where the design rules require ${rules.minInsertWallMm}mm.`
              : `The ${face} aperture cuts into the ${column.label} of mount "${mount.mount.id}", breaking through to its ${2 * column.boreRadiusMm}mm bore. The fastener has no material to hold it.`,
        })
      }
    }
  }
  return violations
}
