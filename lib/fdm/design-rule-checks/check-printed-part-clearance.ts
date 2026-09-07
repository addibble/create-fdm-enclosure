import * as jscad from "@jscad/modeling"
import { executeFdmSolid, fdmSolidsIntersect } from "../execute-solid"
import type {
  FdmDesignRuleViolation,
  FdmEnclosurePart,
  ResolvedFdmMount,
} from "../types"

export const checkPrintedPartClearance = ({
  parts,
  mounts,
}: {
  parts: FdmEnclosurePart[]
  mounts: ResolvedFdmMount[]
}): FdmDesignRuleViolation[] => {
  const base = parts.find(({ id }) => id === "base")
  const lid = parts.find(({ id }) => id === "lid")
  if (!base || !lid)
    throw new Error(
      "Finished FDM base and lid plans are required for assembly DRC",
    )
  const baseSolid = executeFdmSolid(base.jscadPlan)
  const lidSolid = executeFdmSolid(lid.jscadPlan)
  if (!fdmSolidsIntersect(baseSolid, lidSolid)) return []
  const intersection = jscad.booleans.intersect(baseSolid, lidSolid)
  const violations: FdmDesignRuleViolation[] = []
  for (const mount of mounts) {
    const column = mount.lidColumn
    if (!column || column.topZ <= column.bottomZ) continue
    const envelope = jscad.primitives.cylinder({
      radius: column.diameterMm / 2,
      height: column.topZ - column.bottomZ,
      center: [
        mount.center.x,
        mount.center.y,
        (column.topZ + column.bottomZ) / 2,
      ],
      segments: 32,
    })
    if (!fdmSolidsIntersect(intersection, envelope)) continue
    violations.push({
      rule: "printed_part_clearance",
      severity: "error",
      mountId: mount.mount.id,
      measuredMm: 0,
      limitMm: 0,
      message: `The printed lid column of mount "${mount.mount.id}" intersects the finished base. The lid cannot seat; move the mount or enlarge the cavity.`,
    })
  }
  if (violations.length === 0) {
    violations.push({
      rule: "printed_part_clearance",
      severity: "error",
      measuredMm: 0,
      limitMm: 0,
      message:
        "The finished printed lid and base intersect. The enclosure cannot close.",
    })
  }
  return violations
}
