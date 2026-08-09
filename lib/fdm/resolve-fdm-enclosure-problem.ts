import { getApertureDimensions } from "../apertures/get-aperture-dimensions"
import { getApertureHeightDatum } from "../apertures/get-aperture-height-datum"
import { validateApertureInput } from "../apertures/validate-aperture-input"
import {
  isHorizontalFace,
  type ResolvedEnclosureAperturePlacement,
} from "../enclosure"
import { assertApertureFitsEnclosure } from "./assert-aperture-fits-enclosure"
import { DEFAULT_FDM_DESIGN_RULES, type FdmDesignRules } from "./design-rules"
import { getDerivedApertureDepth } from "./get-derived-aperture-depth"
import { getFdmApertureInwardProjection } from "./get-fdm-aperture-inward-projection"
import {
  getApertureIncidenceDegrees,
  resolveFirstFaceAlongApertureAxis,
} from "./resolve-oblique-aperture"
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
      // The named face is the nearest axis by orientation. A continuous
      // interaction axis carries more information: select the first cavity wall
      // its ray actually reaches, so an off-centre part changes walls where its
      // axis crosses the box corner rather than at an unrelated global 45°.
      const face = resolveFirstFaceAlongApertureAxis({
        face: aperture.face,
        origin: aperture.center,
        apertureAxisDirection: aperture.apertureAxisDirection,
        dimensions,
      })
      const prefix = `apertures[${index}]`
      const { width, height } = getApertureDimensions(aperture)

      // How far off square this part meets its selected wall. The face is the
      // nearest quantized Cartesian choice; the paired board-space direction
      // retains the continuous physical axis, including the sign at the exact
      // +/-45-degree tie. Never reconstruct this from component rotation: that
      // loses the footprint's local direction and can disagree with the face.
      const incidenceDegrees = getApertureIncidenceDegrees({
        face,
        apertureAxisDirection: aperture.apertureAxisDirection,
      })
      // The opening keeps its authored size. It is the *tool* that leans, so
      // the wall receives the true oblique section of the part's own profile --
      // an ellipse for a round barrel -- instead of an axis-aligned hole
      // widened to approximate one.
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
        incidenceDegrees,
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

      // A side tool meeting its wall obliquely has a wider intersection there:
      // a finite profile projects to width/cos(incidence). Fit validation must
      // inspect that realized opening, not the authored square-on width, while
      // still allowing partial overlap that deliberately wraps a box corner.
      const projectedWidth = isHorizontalFace(face)
        ? width
        : width / Math.abs(Math.cos((incidenceDegrees * Math.PI) / 180))
      assertApertureFitsEnclosure({
        face,
        center,
        width: projectedWidth,
        height,
        dimensions,
        prefix,
      })

      // An authored depth is authoritative: it can express what a derived
      // envelope cannot, such as a tapered shell that only fouls the lip for
      // part of its depth. Otherwise the envelope is projected onto this face,
      // converted into the datum that face measures depth in -- see
      // `getDerivedApertureDepth`, which is what stops a tall part on a
      // horizontal face from cutting into the plate at the other end of the box.
      const depth =
        aperture.depth ??
        getDerivedApertureDepth({
          face,
          boardSide: aperture.boardSide,
          componentBody: aperture.componentBody,
          frame,
        }) ??
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
        // Side-wall orientation is accounted for by `incidenceDegrees`: core's
        // continuous transformed aperture axis is measured against the normal
        // of the quantized face it selected. Face selection and tool orientation
        // therefore share one source transform without conflating them.
        rotation,
        incidenceDegrees,
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
