import { resolveEnclosureBoardPlanes } from "../assembly"
import { getApertureDimensions } from "../apertures/get-aperture-dimensions"
import { getApertureHeightDatum } from "../apertures/get-aperture-height-datum"
import { type EnclosureApertureInput, isHorizontalFace } from "../enclosure"
import { resolveApertureCenterZ } from "./resolve-fdm-aperture-center"

/**
 * The outside height at which the lid and its lip clear every side-face
 * aperture.
 *
 * An opening in a wall occupies a band of Z fixed by where the board sits and
 * how far up the part stands -- none of which depends on how tall the box is.
 * That is what makes this answerable before the depth is chosen: the board
 * planes come from the mounting stack alone (see `resolveEnclosureBoardPlanes`),
 * so only the lid is free to move.
 *
 * The lid must end up entirely above the tallest opening, and so must the lip
 * that hangs beneath it, or the opening runs into the parting seam: half the
 * hole is cut in the base and half in a lid that slides on afterwards, which is
 * not a hole so much as a notch in two pieces that no part can pass through.
 *
 * Openings in the lid and floor are excluded. They pierce a plate face-on
 * rather than occupying a band of the walls, so they impose no height at all --
 * their `depth` reaches along Z, and reaching *through* the plate is the
 * entire point.
 *
 * Returns 0 when nothing constrains the height, so callers can `Math.max` this
 * against their own minimum unconditionally.
 */
export const getApertureClearanceDepth = ({
  apertures,
  floorThickness,
  standoffHeight,
  boardThickness,
  lidThickness,
  lidLipDepth,
}: {
  apertures: EnclosureApertureInput[]
  floorThickness: number
  standoffHeight: number
  boardThickness: number
  lidThickness: number
  lidLipDepth: number
}): number => {
  const { boardTopZ, boardBottomZ } = resolveEnclosureBoardPlanes({
    floorThickness,
    standoffHeight,
    boardThickness,
  })

  let required = 0
  for (const aperture of apertures) {
    if (isHorizontalFace(aperture.face)) continue

    const centerZ = resolveApertureCenterZ({
      boardSide: aperture.boardSide ?? "top",
      heightDatum: getApertureHeightDatum(aperture),
      heightDimensionOffset: aperture.heightDimensionOffset ?? 0,
      boardTopZ,
      boardBottomZ,
    })
    const apertureTopZ =
      centerZ + getApertureDimensions(aperture).height / 2 + lidLipDepth

    required = Math.max(required, apertureTopZ + lidThickness)
  }

  return required
}
