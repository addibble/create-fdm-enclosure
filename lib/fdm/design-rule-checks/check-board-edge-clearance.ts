import type { EnclosureBoardInput } from "../../enclosure/types"
import type { FdmDesignRuleViolation, ResolvedFdmMount } from "../types"

/**
 * Checks that a mount is far enough inboard for the board to sit on it.
 *
 * Two things have to land on board material, and a mount placed near an edge
 * loses them in this order:
 *
 * - the **boss**, whose top face the board rests on. Once the boss reaches past
 *   the edge, the board bears on only part of the ring, so tightening the screw
 *   tips it rather than clamping it flat.
 * - the **screw head**, which for a board mount bears directly on the laminate
 *   around the hole. Off the edge there is nothing under it to bear on.
 *
 * Both are measured against the board outline rather than the cavity, because
 * this is about the board being supported, not about anything fitting. A boss
 * that runs past the board edge into the wall beside it is fine, and often
 * deliberate -- what is not fine is a board resting on half of one.
 */
export const checkBoardEdgeClearance = ({
  board,
  mounts,
}: {
  board: EnclosureBoardInput
  mounts: ResolvedFdmMount[]
}): FdmDesignRuleViolation[] => {
  const violations: FdmDesignRuleViolation[] = []

  for (const mount of mounts) {
    // The board is centred on the enclosure origin, which is the same frame a
    // mount anchor is authored in.
    const edgeDistanceMm = Math.min(
      board.width / 2 - Math.abs(mount.center.x),
      board.height / 2 - Math.abs(mount.center.y),
    )

    if (edgeDistanceMm <= 0) {
      violations.push({
        rule: "board_edge_clearance",
        // There is no board here to put a hole through, so there is nothing for
        // the screw to pass through or the boss to hold up.
        severity: "error",
        measuredMm: edgeDistanceMm,
        limitMm: 0,
        mountId: mount.mount.id,
        message: `Mount "${mount.mount.id}" is ${Math.abs(edgeDistanceMm).toFixed(2)}mm outside the ${board.width}x${board.height}mm board. A screw boss has to stand under a hole in the board.`,
      })
      continue
    }

    const features: Array<{ label: string; radiusMm: number }> = [
      { label: "screw boss", radiusMm: mount.bossDiameterMm / 2 },
    ]
    if (mount.mount.fastens === "board") {
      features.push({
        label: "screw head",
        radiusMm: mount.headSpec.headDiameterMm / 2,
      })
    }

    for (const feature of features) {
      const overhangMm = feature.radiusMm - edgeDistanceMm
      if (overhangMm <= 0) continue
      violations.push({
        rule: "board_edge_clearance",
        // The board is still held, just not evenly, and how much that matters
        // depends on the board and the load -- so it is the author's call.
        severity: "warning",
        measuredMm: edgeDistanceMm - feature.radiusMm,
        limitMm: 0,
        mountId: mount.mount.id,
        message: `The ${feature.label} of mount "${mount.mount.id}" reaches ${overhangMm.toFixed(2)}mm past the board edge, so the board bears on only part of it. Move the mount at least ${overhangMm.toFixed(2)}mm inboard.`,
      })
    }
  }

  return violations
}
