import { type EnclosureFace, isHorizontalFace } from "../enclosure"
import type { FdmDesignRules } from "./design-rules"
import type { ResolvedFdmEnclosureDimensions } from "./types"

/**
 * How far inboard of a face an aperture must be cut.
 *
 * Cutting only through the face leaves everything *behind* it intact, and the
 * split shell puts material there: the lid lip hangs just inboard of the base
 * side walls, so a connector deep enough to reach it would be blocked by a
 * feature the opening never touched.
 *
 * The projection is therefore the greater of:
 *   - how deep the opening is (`depth`), so the whole part is clear;
 *   - how far the shell's own inboard features reach.
 *
 * `width` and `height` size the opening in the face itself;
 * `depth` is what reaches into whatever *other* walls lie along the
 * normal. A large lid opening in a corner, for instance, is bounded in X and Y
 * by its width and height, and relieves the two side walls it overlaps down to
 * its depth.
 *
 * An authored depth is rendered as authored, on every face. Nothing is capped
 * to the cavity: a deep enough opening reaches the shell on the far side and
 * takes material out of it, exactly as drawn. That is a real risk on a
 * horizontal face, where the far shell is only millimetres away -- an authored
 * 15mm through the lid will punch through the base floor beneath it.
 *
 * A *derived* depth cannot do that, because it is derived in this face's own
 * datum and stops at the plane the part is mounted on (see
 * `getDerivedApertureDepth`). The distinction is the point: the part's reach
 * above the board is not a depth from the lid, and treating it as one is what
 * put a circular pocket in the floor under a pushbutton.
 *
 * Capping used to blur this, and blurred it inconsistently: the four side faces
 * were never capped, so the same authored number meant "as drawn" on a wall and
 * "as much as fits" on the lid. Silently cutting a shallower hole than asked
 * for is its own defect -- the part fouls the shell and the model gives no sign
 * why. The depth an author writes is still the depth they get, and a box too
 * shallow to contain a part is fixed by making the box deeper (see
 * `resolve-fdm-enclosure-dimensions.ts`, which grows the depth to clear the
 * apertures when `topHeadroom` was not authored) rather than by quietly
 * truncating the cut.
 */
export const getFdmApertureInwardProjection = ({
  face,
  depth = 0,
  dimensions,
  rules,
}: {
  face: EnclosureFace
  depth?: number
  dimensions: ResolvedFdmEnclosureDimensions
  rules: FdmDesignRules
}): number => {
  if (isHorizontalFace(face)) {
    if (face === "z_neg") {
      // Projected up beyond the floor's inner surface. The cutting primitive
      // spans the floor plate separately, and there is no further shell feature
      // to clear beyond the depth itself.
      return depth
    }

    // Projected down beyond the lid's inner surface. The lip hangs below the
    // lid plate, so an opening in the lid must reach past it to be a through hole
    // at all -- cleared whether or not a depth was given.
    return Math.max(depth, dimensions.lidLipDepth)
  }

  // Side faces: clear the lip's thickness where it sits against the wall.
  const lipWallThickness = Math.min(
    dimensions.wallThickness * rules.lipWallThicknessRatio,
    rules.lipWallThicknessMax,
  )
  const lipReach =
    rules.slidingFitClearance / 2 + lipWallThickness + rules.booleanTolerance
  return Math.max(depth, lipReach)
}
