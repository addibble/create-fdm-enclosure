import type { HeadRecess, ScrewHeadSpec } from "./types"

/**
 * How deep the recess is cut into the part the head bears on.
 *
 * Two different numbers for two different shapes, and it matters that both the
 * geometry and the "is there enough material left" rule read this one function:
 * when they each had their own idea of the depth, one of them was always wrong.
 *
 * - **counterbore**: a cylinder the head drops into, so the depth is the head's
 *   own height -- an M3 cap head is 3mm, which is why a counterbore is never the
 *   default in a 2mm printed lid.
 * - **countersink**: a 90-degree cone, cut from the head's sharp diameter down
 *   to where it meets the clearance hole. A 90-degree cone descends 1mm per 1mm
 *   of radius, so that depth is `(headDiameter - clearanceDiameter) / 2` -- and
 *   it is *shallower* than the head is tall, because the lower part of the head
 *   sits inside the clearance hole rather than in the cone. Cutting the cone to
 *   the head's height instead would sink the head below flush and remove twice
 *   the material.
 */
export const getHeadRecessDepthMm = ({
  headSpec,
  headRecess,
  clearanceDiameterMm,
}: {
  headSpec: ScrewHeadSpec
  headRecess: HeadRecess
  clearanceDiameterMm: number
}): number => {
  switch (headRecess) {
    case "none":
      return 0
    case "counterbore":
      return headSpec.headHeightMm
    case "countersink":
      return Math.max(0, (headSpec.headDiameterMm - clearanceDiameterMm) / 2)
  }
}
