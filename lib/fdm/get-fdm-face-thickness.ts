import type { EnclosureFace } from "../enclosure"
import type { ResolvedFdmEnclosureDimensions } from "./types"

/**
 * Which wall of the split shell a given face is made of. A side face is a
 * printed side wall; `top` is the lid top plate and `bottom` is the base floor,
 * so an aperture through either only has to clear that plate.
 */
export const getFdmFaceThickness = (
  face: EnclosureFace,
  dimensions: ResolvedFdmEnclosureDimensions,
): number => {
  if (face === "z_pos") return dimensions.lidThickness
  if (face === "z_neg") return dimensions.floorThickness
  return dimensions.wallThickness
}
