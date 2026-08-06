import { getFaceNormalAxis, isHorizontalFace } from "./faces"
import type { EnclosureFace } from "./types"

/**
 * Normalized physical envelope of the part behind an aperture.
 *
 * This is deliberately *not* a renderer bounding box. Nothing upstream loads a
 * mesh, so a true min/max box would either be a lie or force the enclosure layer
 * to depend on geometry loading. What an adapter can honestly supply is:
 *
 *   - the authored body extent in the part's own frame (`size`),
 *   - how the part is turned on the board (`rotation`), and
 *   - the board-frame footprint it occupies (`footprint`).
 *
 * The enclosure layer turns those facts into a face-relative depth. Keeping the
 * projection here rather than in the adapter means every consumer -- FDM today,
 * CNC or sheet metal later, plus assembly/DRC -- reads the same envelope and
 * applies its own policy to it.
 */
export interface EnclosureComponentBody {
  /**
   * Body extent in the part's own, unrotated frame.
   *
   * `z` is the full model extent, so it spans whatever hangs *below* the board
   * as well. Prefer `aboveBoardHeight` when it is present; `size.z` is the
   * fallback for parts whose model bounds were never measured, and is only used
   * where over-reporting is harmless.
   */
  size?: { x: number; y: number; z?: number }
  /**
   * How far the part reaches above the board surface, in millimetres.
   *
   * This is the honest Z extent for anything the enclosure must clear. It is
   * derived by the adapter from the model's measured bounds and the point of
   * the model placed on the board surface, so unlike `size.z` it excludes pins
   * and through-board shells.
   */
  aboveBoardHeight?: number
  /** Rotation of the part about the board normal, in degrees. */
  rotation?: number
  /**
   * Axis-aligned board-frame extents of the part's footprint. Used as the floor
   * for a projection, since pad fans and courtyards can reach further inboard
   * than the body itself.
   */
  footprint?: { width: number; height: number }
}

/**
 * Axis-aligned extent of a `w x h` rectangle rotated by `degrees`, projected
 * onto a board axis.
 */
const getRotatedExtent = (
  w: number,
  h: number,
  degrees: number,
  axis: "x" | "y",
): number => {
  const radians = (degrees * Math.PI) / 180
  const cos = Math.abs(Math.cos(radians))
  const sin = Math.abs(Math.sin(radians))
  return axis === "x" ? w * cos + h * sin : w * sin + h * cos
}

/**
 * How far the part reaches along the normal of the face it pokes through.
 *
 * Prefers the authored body extent, because that is the physical part. A
 * footprint is only where the pads and silkscreen are, and a through-board
 * connector shell commonly overhangs it by a lot: the prefab USB-A has a 19mm
 * deep body over a 10mm footprint, so sizing a cut from the footprint alone left
 * the opening stopping barely half way along the connector. The footprint is
 * still taken as a floor, since it can be the larger of the two.
 *
 * On a horizontal face the normal is Z, so the extent is how far the part
 * reaches above the board. `aboveBoardHeight` is that number honestly, derived
 * from the model's measured bounds about the board surface, and is what should
 * be supplied. Reporting a Z extent at all is what lets a part in a corner
 * relieve the side walls it presses against. A footprint has no Z extent, so
 * there is no floor to apply.
 *
 * `size.z` is only a fallback for parts whose model was never measured, and it
 * is a poor one: it spans the pins and any through-board shell, so it
 * over-reports the part's reach. Prefer measuring the model; a caller relying on
 * this fallback for a tall through-hole part should authorise the depth
 * explicitly instead.
 *
 * Note this is an extent in the PART's frame, measured from the board it stands
 * on -- not a depth. On a horizontal face the two datums are a whole cavity
 * apart, so `getDerivedApertureDepth` converts before anything cuts with it.
 * Using this number raw as a lid depth is what once drove a cut into the floor.
 */
export const getComponentBodyFaceExtent = ({
  body,
  face,
}: {
  body: EnclosureComponentBody | undefined
  face: EnclosureFace
}): number | undefined => {
  if (!body) return undefined
  if (isHorizontalFace(face)) return body.aboveBoardHeight ?? body.size?.z

  const axis = getFaceNormalAxis(face) === "y" ? "y" : "x"
  const footprintExtent =
    body.footprint &&
    (axis === "y" ? body.footprint.height : body.footprint.width)

  if (!body.size) return footprintExtent

  const bodyExtent = getRotatedExtent(
    body.size.x,
    body.size.y,
    body.rotation ?? 0,
    axis,
  )

  return footprintExtent === undefined
    ? bodyExtent
    : Math.max(bodyExtent, footprintExtent)
}

/**
 * The part's reach above the board, if it was measured.
 *
 * Deliberately does NOT fall back to `size.z`: that spans the pins and any
 * through-board shell, so centering an opening on it would sit the opening too
 * high. A caller with no measured bounds is better served by its own fallback.
 */
export const getComponentBodyAboveBoardHeight = (
  body: EnclosureComponentBody | undefined,
): number | undefined => body?.aboveBoardHeight
