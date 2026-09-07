import type { ResolvedThreadedFastener } from "@tscircuit/jscad-assembly-hardware"
import type { HeadRecess } from "./types"

/** Mating recess dimensions derive from the resolved physical head, not ISO k. */
export const getHeadRecessDepthMm = ({
  fastener,
  headRecess,
  clearanceDiameterMm,
}: {
  fastener: ResolvedThreadedFastener
  headRecess: HeadRecess
  clearanceDiameterMm: number
}): number => {
  if (headRecess === "none") return 0
  if (headRecess === "counterbore") return fastener.head.heightMm
  if (fastener.head.profile !== "conical_frustum") {
    throw new Error("A countersink requires a conical fastener head")
  }
  if (clearanceDiameterMm >= fastener.head.diameterMm) {
    throw new Error("The clearance hole is wider than the fastener head")
  }
  return (
    (fastener.head.heightMm *
      (fastener.head.diameterMm - clearanceDiameterMm)) /
    (fastener.head.diameterMm - fastener.shaft.diameterMm)
  )
}
