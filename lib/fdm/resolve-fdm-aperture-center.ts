import type { EnclosureAssemblyFrame } from "../assembly"
import { getObliqueTangentShift } from "./resolve-oblique-aperture"
import {
  type EnclosureFace,
  getEnclosureSpanAlongAxis,
  getFaceNormalAxis,
  getFaceNormalSign,
} from "../enclosure"
import type { ResolvedFdmEnclosureDimensions } from "./types"

/**
 * Z of a side-face aperture center.
 *
 * `heightDatum` is where the part puts the opening -- the middle of its body
 * above the board -- and `heightDimensionOffset` moves it from there. Both are
 * measured *outward* from the part's own mounting surface, so a part authored
 * once is correct on either board side: a top-mounted connector measures up from
 * the board top, a bottom-mounted one down from the board bottom.
 */
export const resolveApertureCenterZ = ({
  boardSide,
  heightDatum,
  heightDimensionOffset,
  boardTopZ,
  boardBottomZ,
}: {
  boardSide: "top" | "bottom"
  heightDatum: number
  heightDimensionOffset: number
  boardTopZ: number
  boardBottomZ: number
}): number => {
  const outward = heightDatum + heightDimensionOffset
  return boardSide === "bottom" ? boardBottomZ - outward : boardTopZ + outward
}

/**
 * Place an aperture center on its face.
 *
 * An authored aperture gives a point on the BOARD and a height above its
 * mounting surface; a cut needs a point in the enclosure. The two tangent
 * coordinates carry over, and the coordinate along the face normal is replaced
 * by the face's own plane -- the mid-surface of the material being pierced, so
 * the cutting prism straddles it. Callers therefore never decide which axis a
 * given face pins.
 */
export const resolveApertureCenter = ({
  face,
  boardCenter,
  centerZ,
  widthDimensionOffset,
  heightDimensionOffset,
  rotation,
  incidenceDegrees = 0,
  dimensions,
  frame,
}: {
  face: EnclosureFace
  boardCenter: { x: number; y: number }
  centerZ: number
  /** Across the face, in the same frame as the opening's `width`. */
  widthDimensionOffset: number
  /**
   * Across the face, in the same frame as the opening's `height`. Already folded
   * into `centerZ` on a side face, so it is only applied here on the horizontal
   * pair, where "height" is an in-plane axis rather than board Z.
   */
  heightDimensionOffset: number
  /** In-face rotation of the opening, in degrees. Zero on the side faces. */
  rotation: number
  /**
   * How far off square the part meets a side wall, in degrees. Zero on the
   * horizontal faces and for a part that meets its wall head on.
   */
  incidenceDegrees?: number
  dimensions: ResolvedFdmEnclosureDimensions
  frame: EnclosureAssemblyFrame
}): { x: number; y: number; z: number } => {
  const normalAxis = getFaceNormalAxis(face)

  // The two horizontal faces are the asymmetric pair: the lid rides above the
  // seam while the floor starts at zero, so neither is at a signed offset from
  // the box center the way the four walls are.
  if (normalAxis === "z") {
    // Both offsets are in-plane here, and they turn with the opening: a part
    // rotated on the lid carries its offsets around with it, or a nudge authored
    // as "3mm along my width" would drift off the part as soon as it rotated.
    const radians = (rotation * Math.PI) / 180
    const cos = Math.cos(radians)
    const sin = Math.sin(radians)
    return {
      x:
        boardCenter.x +
        widthDimensionOffset * cos -
        heightDimensionOffset * sin,
      y:
        boardCenter.y +
        widthDimensionOffset * sin +
        heightDimensionOffset * cos,
      z:
        face === "z_pos"
          ? frame.seamZ + dimensions.lidThickness / 2
          : dimensions.floorThickness / 2,
    }
  }

  // Mid-wall on the normal axis, board coordinates on the other two.
  const midWall =
    getFaceNormalSign(face) *
    (getEnclosureSpanAlongAxis(dimensions, normalAxis) / 2 -
      dimensions.wallThickness / 2)

  // A part that meets the wall at an angle does not cross it above its own
  // centre: its mating axis leans, and where that axis reaches the wall is where
  // the hole belongs. Square-on this is zero, which is why it went unnoticed --
  // every fixture placed parts square to their wall.
  const obliqueShift = getObliqueTangentShift({
    face,
    incidenceDegrees,
    distanceToWall:
      (midWall - boardCenter[normalAxis === "x" ? "x" : "y"]) *
      getFaceNormalSign(face),
  })

  // On a side wall the width axis is the one tangent to the board plane, so the
  // width offset slides the opening ALONG the wall. The height offset is already
  // in `centerZ`.
  return normalAxis === "x"
    ? {
        x: midWall,
        y: boardCenter.y + widthDimensionOffset + obliqueShift,
        z: centerZ,
      }
    : {
        x: boardCenter.x + widthDimensionOffset + obliqueShift,
        y: midWall,
        z: centerZ,
      }
}
