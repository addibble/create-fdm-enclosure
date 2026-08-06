import type { EnclosureAssemblyFrame } from "../assembly"
import {
  type EnclosureComponentBody,
  type EnclosureFace,
  getComponentBodyFaceExtent,
  isHorizontalFace,
} from "../enclosure"

/**
 * How deep to cut for an aperture whose depth was not authored, in the datum
 * the face measures depth in.
 *
 * `getComponentBodyFaceExtent` answers a different question -- how far the part
 * reaches along the face normal, measured from the board it is mounted on -- and
 * the two datums only coincide on a side face, where the wall and the part both
 * start at roughly the board plane. On a horizontal face they do not coincide at
 * all: a depth is measured from the plate's OUTER surface, while the part's
 * reach is measured from the board surface, which sits a whole cavity away.
 *
 * Using the reach raw is what cut the floor. A 15mm pushbutton on a 19.35mm box
 * produced a 15mm cut measured down from the lid's outer face, ending at
 * z = 4.35 -- past the cavity and 0.15mm into a floor plate spanning 0..2,
 * leaving a circular pocket in the bottom of the box. The part never went near
 * the floor; only the number did.
 *
 * Stated as a span in one frame, the cut runs from the plane the part is
 * mounted on up to whichever is higher, the top of the part or the outer face
 * of the plate:
 *
 *     from  mountZ
 *     to    max(mountZ + aboveBoardHeight, plateOuterZ)
 *
 * Both ends matter. The upper `max` is why a part far shorter than the cavity
 * still gets a hole clean through the plate. The lower end is why a part far
 * taller than the box does not reach the plate at the other end: below the
 * mounting plane the part cannot be, so no material there can foul it.
 *
 * Only the part of that span inside the shell can remove anything, and the
 * shell stops at `plateOuterZ`, so the depth the face needs is always
 * `|plateOuterZ - mountZ|` -- the `max` never adds depth, it only guarantees the
 * cut reaches the outside. Which is exactly why the raw reach was wrong: taken
 * as a depth it measured the part's overhang *downwards from the lid*, when the
 * overhang is above the lid entirely.
 *
 * This is not the depth capping that was removed. That truncated what an author
 * had explicitly asked for, silently cutting a shallower hole than requested;
 * an authored depth still renders exactly as drawn, on every face, and can still
 * be used to reach the far shell deliberately. This only decides what to derive
 * when nothing was authored.
 */
export const getDerivedApertureDepth = ({
  face,
  boardSide = "top",
  componentBody,
  frame,
}: {
  face: EnclosureFace
  boardSide?: "top" | "bottom"
  componentBody: EnclosureComponentBody | undefined
  frame: EnclosureAssemblyFrame
}): number | undefined => {
  const extent = getComponentBodyFaceExtent({ body: componentBody, face })
  if (extent === undefined) return undefined
  if (!isHorizontalFace(face)) return extent

  // The face of the board the part stands on: its body runs away from this
  // plane, and never crosses to the other side of it.
  const mountZ = boardSide === "bottom" ? frame.boardBottomZ : frame.boardTopZ

  // The outer face of the plate being pierced -- z_pos is measured down from
  // the lid's outer surface, z_neg up from the floor's outer surface at z = 0.
  // `max(partTop, plateOuter)` collapses to the plate for any part, since
  // nothing above the plate is material to cut.
  const plateOuterZ = face === "z_pos" ? frame.totalHeight : 0
  return Math.abs(plateOuterZ - mountZ)
}
