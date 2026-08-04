import { getApertureDimensions } from "../apertures/get-aperture-dimensions"
import { getApertureHeightDatum } from "../apertures/get-aperture-height-datum"
import { validateApertureInput } from "../apertures/validate-aperture-input"
import {
  getComponentBodyFaceExtent,
  isHorizontalFace,
  type ResolvedEnclosureAperturePlacement,
} from "../enclosure"
import { assertApertureFitsEnclosure } from "./assert-aperture-fits-enclosure"
import { DEFAULT_FDM_DESIGN_RULES, type FdmDesignRules } from "./design-rules"
import { getFdmApertureInwardProjection } from "./get-fdm-aperture-inward-projection"
import {
  resolveApertureCenter,
  resolveApertureCenterZ,
} from "./resolve-fdm-aperture-center"
import { resolveFdmEnclosureDimensions } from "./resolve-fdm-enclosure-dimensions"
import { resolveFdmEnclosureFrame } from "./resolve-fdm-enclosure-frame"
import type {
  CreateFdmEnclosureInput,
  ResolvedFdmEnclosureInput,
} from "./types"

/**
 * Turn an authored FDM enclosure request into a fully-decided problem.
 *
 * This is the single place where defaults are applied, fallbacks are resolved,
 * and the request is validated. Everything downstream is pure construction: no
 * pipeline stage may read `CreateFdmEnclosureInput` or re-derive a value that
 * appears in `ResolvedFdmEnclosureInput`.
 *
 * It reads as the order the decisions actually depend on each other:
 *
 * 1. authored input is checked for what can be judged on its own terms;
 * 2. the box is sized, which needs no aperture (see
 *    `resolve-fdm-enclosure-dimensions.ts` for why apertures deliberately do
 *    not grow it);
 * 3. the frame fixes the vertical planes of the assembly;
 * 4. each aperture is placed against that frame, checked to be on the box, and
 *    given its inward projection.
 */
export const resolveFdmEnclosureProblem = (
  input: CreateFdmEnclosureInput,
): ResolvedFdmEnclosureInput => {
  const rules: FdmDesignRules = {
    ...DEFAULT_FDM_DESIGN_RULES,
    ...input.fdmRules,
  }

  const apertures = input.apertures ?? []
  for (const [index, aperture] of apertures.entries()) {
    validateApertureInput(aperture, index)
  }

  const dimensions = resolveFdmEnclosureDimensions({ input, rules })
  const frame = resolveFdmEnclosureFrame({ board: input.board, dimensions })

  // The lip can only be as deep as the base cavity it seats into, and the shell
  // used to discover that for itself while the aperture projection went on using
  // the authored value. The two then disagreed: a lip requested deeper than the
  // cavity printed short, but openings were still projected clear of the full
  // requested depth, cutting further inboard than anything they had to clear --
  // far enough to breach the floor in the extreme.
  //
  // Resolving it here instead makes `dimensions.lidLipDepth` the *effective*
  // lip everywhere, which is what the single-resolution contract requires: no
  // stage may re-derive a value another stage also uses. It has to happen after
  // the frame, because the cavity depth is not known until the box is sized.
  dimensions.lidLipDepth = Math.min(
    dimensions.lidLipDepth,
    Math.max(0, frame.seamZ - dimensions.floorThickness),
  )

  const resolvedApertures: ResolvedEnclosureAperturePlacement[] = apertures.map(
    (aperture, index) => {
      const { face } = aperture
      const prefix = `apertures[${index}]`
      const { width, height } = getApertureDimensions(aperture)
      const widthDimensionOffset = aperture.widthDimensionOffset ?? 0
      const heightDimensionOffset = aperture.heightDimensionOffset ?? 0
      // A board rotation only rolls an opening whose face normal is Z; see the
      // `rotation` note below.
      const rotation = isHorizontalFace(face) ? (aperture.rotation ?? 0) : 0

      const center = resolveApertureCenter({
        face,
        boardCenter: aperture.center,
        widthDimensionOffset,
        heightDimensionOffset,
        rotation,
        // Only side faces read this; a horizontal face takes its position along
        // the normal from the plate it pierces.
        centerZ: resolveApertureCenterZ({
          boardSide: aperture.boardSide ?? "top",
          heightDatum: getApertureHeightDatum(aperture),
          heightDimensionOffset,
          boardTopZ: frame.boardTopZ,
          boardBottomZ: frame.boardBottomZ,
        }),
        dimensions,
        frame,
      })

      assertApertureFitsEnclosure({
        face,
        center,
        width,
        height,
        dimensions,
        prefix,
      })

      // An authored depth is authoritative: it can express what a derived
      // envelope cannot, such as a tapered shell that only fouls the lip for
      // part of its depth. Otherwise the envelope is projected onto this face.
      const depth =
        aperture.depth ??
        getComponentBodyFaceExtent({ body: aperture.componentBody, face }) ??
        0

      return {
        aperture,
        face,
        center,
        width,
        height,
        // A board rotation is a rotation about Z, so how much of it is a *roll*
        // of the opening is its component about the face normal -- the dot
        // product of the two axes. That is 1 on `z_pos`/`z_neg`, where the face
        // normal IS Z, and exactly 0 on the four side walls, whose normals lie
        // in the board plane. So this is not a policy choice about which faces
        // may turn; a side wall genuinely has no roll to apply.
        //
        // The part's rotation is still fully accounted for on a side wall --
        // just at an earlier stage. Core rotates the footprint's insertion
        // direction by it in `transformFootprintInsertionDirection`, which is
        // what picks WHICH wall the aperture belongs in. Face selection there,
        // in-face roll here.
        rotation,
        inwardProjection: getFdmApertureInwardProjection({
          face,
          depth,
          dimensions,
          rules,
        }),
      }
    },
  )

  return {
    construction: "fdm_box",
    board: input.board,
    apertures: resolvedApertures,
    dimensions,
    rules,
    frame,
  }
}
