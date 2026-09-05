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
 * - **countersink**: a cone at the head's own included angle, cut from the
 *   head's bearing diameter down to where it meets the clearance hole. It is
 *   *shallower* than the head is tall, because the lower part of the head sits
 *   inside the clearance hole rather than in the cone. Cutting the cone to the
 *   head's height instead would sink the head below flush and remove twice the
 *   material.
 *
 * The angle comes from the head rather than being assumed to be 90, so that the
 * depth and the cone `create-mount-feature-plans` draws are one expression. They
 * were two, and disagreed: the cut's mouth had `headRecessClearanceMm` added to
 * it while this depth did not, which drew a 99.8-degree cone for a 90-degree
 * head. The head then met it only at the sharp rim where the cone runs into the
 * clearance hole -- line contact, in printed plastic, on the joint holding the
 * lid down.
 *
 * `headRecessClearanceMm` is deliberately NOT part of this. It is documented as
 * what it is: diametral clearance for a COUNTERBORE, so a cylindrical head is
 * not a press fit. A cone has no press fit to relieve, and widening it does not
 * add slop -- it moves the head down the taper by half the clearance. Measured:
 * with 0.4mm added, an M3 countersunk head finishes 0.2mm below the surface it
 * is supposed to be flush with.
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
    case "countersink": {
      const halfAngleRad =
        (((headSpec.countersinkAngleDegrees ?? 90) / 2) * Math.PI) / 180
      return Math.max(
        0,
        (headSpec.headDiameterMm - clearanceDiameterMm) /
          2 /
          Math.tan(halfAngleRad),
      )
    }
  }
}
