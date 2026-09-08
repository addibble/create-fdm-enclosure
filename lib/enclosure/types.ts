import type { JscadOperation } from "jscad-planner"
import type {
  FastenerThread,
  FasteningMethod,
  HeadRecess,
} from "../hardware/types"
import type { EnclosureComponentBody } from "./component-body"

/**
 * An outward face of the enclosure, named by the axis its outward normal points
 * along. `z_pos` is the outward face of the closing part (the lid, for an
 * `fdm.box`); `z_neg` is the outward face of the floor.
 *
 * Named directions (`left`, `top`, ...) are deliberately avoided here: an
 * enclosure face can plausibly be +/-Y or +/-Z, and `top` already means +Y as an
 * `insertion_direction` and +Z as a PCB layer. Core's `BoardWall` uses the same
 * six names, so converting a board wall to a face is an identity.
 */
export type EnclosureFace =
  | "x_pos"
  | "x_neg"
  | "y_pos"
  | "y_neg"
  | "z_pos"
  | "z_neg"

export interface EnclosureBoardInput {
  /** Board width along X, in millimetres. */
  width: number
  /** Board height along Y, in millimetres. */
  height: number
  /** Board thickness along Z, in millimetres. */
  thickness: number
}

/**
 * An aperture's `width`/`height`/`depth` are measured in the frame of the face
 * it pierces, never in board or enclosure axes. They are the same three words
 * `EnclosureMechanicalInput` uses for the box's own X/Y/Z spans, but they belong
 * to a different object and the face is what fixes which axes they mean:
 *
 * | Face | `width` | `height` | `depth` |
 * | --- | --- | --- | --- |
 * | `x_pos`, `x_neg` | Y | Z | X |
 * | `y_pos`, `y_neg` | X | Z | Y |
 * | `z_pos`, `z_neg` | part-local, see below | part-local | Z |
 *
 * So on any side face `height` is the vertical dimension and `width` runs along
 * the wall; the two are the face-tangent axes in the order given by
 * `getFaceTangentAxes`, and `depth` is the face normal.
 *
 * On the two horizontal faces the tangent pair is board X and Y only when the
 * part is unrotated. A part on the lid or the floor can sit at any rotation, so
 * the opening turns with it -- see `rotation`.
 */
interface CommonEnclosureApertureInput {
  /**
   * Initial Cartesian face for the aperture. With no continuous axis this is
   * the final face. When `apertureAxisDirection` is present on a side opening,
   * resolution selects the first enclosure wall reached by that ray; this value
   * breaks an exact corner tie.
   */
  face: EnclosureFace
  /**
   * How far the opening is turned within the face it pierces, in degrees
   * counter-clockwise, about the face normal.
   *
   * Only meaningful on `z_pos`/`z_neg`. A board rotation is a rotation about Z,
   * so the part of it that *rolls* an opening is its component about the face
   * normal: 1 on the horizontal faces, whose normal is Z, and exactly 0 on the
   * four side walls, whose normals lie in the board plane. A part sitting on
   * the lid or the floor can be placed at any rotation, and its opening has to
   * turn with it -- otherwise a rotated rectangular connector gets a cutout
   * still squared to board X/Y.
   *
   * Adapters should pass the part's own rotation for every face and let this be
   * resolved; a side wall genuinely has no roll to apply, and the part's
   * rotation is accounted for there at an earlier stage, by rotating the
   * footprint's insertion direction to pick which wall the aperture belongs in.
   *
   * One case is currently invisible rather than absent: moving a part to the
   * bottom layer is a 180 degree rotation about Y, which for the +/-Y walls IS a
   * roll about the face normal. Every aperture shape today -- rect, pill, circle
   * -- is centrally symmetric, so a 180 degree roll maps the opening onto
   * itself. An asymmetric shape (a keyed or D-shaped opening) would make it
   * matter, and would need the flip folded in here.
   */
  rotation?: number
  /**
   * Continuous outward axis of the part's enclosure interaction, expressed as
   * a unit **direction** in the board's right-handed XYZ frame (+Z above the
   * board). It receives rotation and layer orientation but no translation;
   * units therefore do not apply.
   *
   * On a side face the enclosure measures this vector against the selected
   * face's outward normal to obtain the signed incidence angle. This must remain
   * separate from `face`: the face is the nearest quantized Cartesian choice,
   * while this vector preserves the physical angle within that choice. In
   * particular, reconstructing the vector from `rotation` is ambiguous at
   * exactly +/-45 degrees and is wrong when the footprint's local direction is
   * not the assumed axis.
   *
   * Optional for adapters that do not know the part's interaction direction;
   * absent means the part is treated as square to its selected face.
   */
  apertureAxisDirection?: { x: number; y: number; z: number }
  /**
   * A point on the interaction axis in board coordinates, relative to the board
   * center. With `apertureAxisDirection`, this must be the stable datum the part
   * rotates around; the enclosure intersects that ray with its first wall. With
   * no continuous axis, the point is projected orthogonally onto `face` and its
   * two tangent coordinates center the aperture.
   */
  center: { x: number; y: number }
  /**
   * Which board surface the part is mounted on. Sets the datum for
   * `heightDimensionOffset`, and for a vertical interaction it is also the face the
   * aperture exits through.
   *
   * Defaults to `"top"`.
   */
  boardSide?: "top" | "bottom"
  /**
   * Move the opening's **center** across the face it pierces, along the same
   * two axes its `width` and `height` are measured in. Both may be negative.
   *
   * Sharing the frame with the dimensions is the point: on a side face
   * `heightDimensionOffset` runs the way `height` does, and on a horizontal face
   * both follow the part's own rotation, exactly as the opening itself does.
   * There is no separate Z quantity to reason about, which is what
   * `zExtentAboveBoard` used to be -- a name that only made sense on the four
   * walls, since on the lid and the floor the opening does not move in Z at all.
   *
   * Zero means "wherever the part puts it", which is usually right:
   *
   * - Side faces: centered on the part's body above the board, taken from
   *   `componentBody.aboveBoardHeight`. An opening therefore lines up with the
   *   connector it serves without anyone computing a height. Where a part has no
   *   measured bounds this falls back to half the opening's own height, which
   *   rests its lower edge on the mounting surface.
   * - Horizontal faces: centered on the part's own position.
   *
   * `heightDimensionOffset` is measured **outward** from the mounting surface on
   * a side face -- up for a top-mounted part, down for a bottom-mounted one --
   * so, like the default it shifts, it describes the part rather than where the
   * part was placed. The same authored number stays correct on either side of
   * the board.
   */
  widthDimensionOffset?: number
  /** See `widthDimensionOffset`. */
  heightDimensionOffset?: number
  /** Extra clearance applied on every edge. */
  margin?: number
  /**
   * Opening size along the normal of the face -- how far the cut is projected
   * inboard, measured in the direction the part pokes through.
   *
   * This is the third aperture dimension, not a board-Z measurement: on a side
   * face it runs horizontally, along X or Y. The vertical dimension of a side
   * aperture is `height`.
   *
   * The cut is projected this far inboard of the face so that nothing *inside*
   * the enclosure fouls the part. Cutting only through the face itself leaves the
   * lid lip (which sits just inboard of the side walls) intact, so a connector
   * deep enough to reach it would be obstructed by a feature the opening never
   * touched. Over-projecting is harmless: inboard of the wall and lip there is
   * only cavity.
   *
   * Defaults to 0, i.e. cut through the face only.
   */
  depth?: number
  /**
   * Physical envelope of the part behind this aperture, supplied by an upstream
   * adapter when `depth` is not authored.
   *
   * The enclosure layer projects it onto the face normal (see
   * `getComponentBodyFaceExtent`), so the adapter reports facts about the part
   * and this package keeps ownership of what those facts mean for a cut.
   */
  componentBody?: EnclosureComponentBody
}

export interface RectEnclosureApertureInput
  extends CommonEnclosureApertureInput {
  shape: "rect"
  width: number
  height: number
}

export interface PillEnclosureApertureInput
  extends CommonEnclosureApertureInput {
  shape: "pill"
  width: number
  height: number
}

export interface CircleEnclosureApertureInput
  extends CommonEnclosureApertureInput {
  shape: "circle"
  radius: number
}

export type EnclosureApertureInput =
  | RectEnclosureApertureInput
  | PillEnclosureApertureInput
  | CircleEnclosureApertureInput

/**
 * A part on the board that the enclosure has to make room for.
 *
 * Position is here rather than on `EnclosureComponentBody` because a body
 * describes the *part* -- how big it is, how far it reaches above the board --
 * while the same body can appear at many places on many boards. An aperture
 * gets its position from the opening it cuts; an obstacle needs its own.
 */
export interface EnclosureBoardComponent {
  /** Stable identity, used to name the part in a design rule violation. */
  id: string
  /** Centre of the part in board-frame XY, the same frame `mounts` use. */
  center: { x: number; y: number }
  /**
   * Which face of the board it is mounted on. Decides which enclosure features
   * can reach it at all: a floor boss stands under the board, a lid column
   * above it, and neither can touch a part on the far side.
   *
   * Defaults to `"top"`.
   */
  boardSide?: "top" | "bottom"
  body: EnclosureComponentBody
}

export interface EnclosureMechanicalInput {
  board: EnclosureBoardInput
  /**
   * Parts on the board that enclosure features must clear. Optional: an
   * enclosure can be solved without knowing what is on the board, it just
   * cannot be checked against it.
   */
  components?: EnclosureBoardComponent[]
  /** Outside X dimension. Inferred when omitted. */
  width?: number
  /** Outside Y dimension. Inferred when omitted. */
  height?: number
  /** Outside Z dimension. Inferred when omitted. */
  depth?: number
  /** Side wall thickness. Defaults to 2 mm. */
  wallThickness?: number
  /** Floor thickness. Defaults to wallThickness. */
  floorThickness?: number
  /** Horizontal clearance between each board edge and the inside wall. */
  boardClearance?: number
  apertures?: EnclosureApertureInput[]
  mounts?: EnclosureMountInput[]
}

export interface ResolvedEnclosureDimensions {
  width: number
  height: number
  depth: number
  wallThickness: number
  floorThickness: number
  boardClearance: number
}

/**
 * An aperture after resolution: every optional and every fallback in
 * `EnclosureApertureInput` has been decided. Geometry stages consume this and
 * must not re-derive placement from the authored aperture.
 */
export interface ResolvedEnclosureAperturePlacement {
  /** The authored aperture this placement was resolved from. */
  aperture: EnclosureApertureInput
  face: EnclosureFace
  /**
   * Aperture center in enclosure-local coordinates, already projected onto the
   * face plane. Geometry stages translate to this and must not re-derive it.
   */
  center: { x: number; y: number; z: number }
  /**
   * How far inboard of the face the cut is projected, so features inside the
   * enclosure (the lid lip today, mounting bosses later) cannot obstruct the
   * part. Resolved from the aperture's `depth`.
   */
  inwardProjection: number
  /**
   * How far off square the part meets this face, in degrees.
   *
   * The cutting tool is turned by it about board Z, so its depth axis follows
   * the part's real mating axis and the wall receives the true oblique section.
   * Zero on the horizontal faces and for any part square to its wall.
   */
  incidenceDegrees?: number
  /** Margin-inflated opening size across the face's first tangent axis. */
  width: number
  /** Margin-inflated opening size across the face's second tangent axis. */
  height: number
  /**
   * Rotation of the opening within its face, in degrees. Zero on the side
   * faces, which do not turn -- see `EnclosureApertureInput.rotation`.
   */
  rotation: number
}

/**
 * Process-independent resolved enclosure problem. `lib/fdm/` extends this with
 * construction-specific fields; a future CNC or sheet-metal pipeline would do
 * the same while reusing this resolution.
 */
export interface ResolvedEnclosureInput {
  board: EnclosureBoardInput
  /** Carried through unchanged: obstacles are checked against, not resolved. */
  components?: EnclosureBoardComponent[]
  apertures: ResolvedEnclosureAperturePlacement[]
}

export interface ResolvedEnclosureAperture {
  aperture: EnclosureApertureInput
  width: number
  height: number
  cutDepth: number
  jscadPlan: JscadOperation
}

/**
 * The four in-plane quadrants of the enclosure, named by the signs of the axes
 * whose corner they occupy.
 *
 * Cartesian rather than named (`front_left`) for the reason `EnclosureFace` is:
 * `top` already means +Y as a direction and +Z as a PCB layer, and the enclosure
 * would be the third meaning.
 */
/**
 * A reference to any Circuit JSON element: its `type`, and the value of that
 * element's own `<type>_id` field.
 *
 * Generic on purpose. The enclosure happens to generate bosses from `pcb_hole`s,
 * but the same field has to carry the pin header behind a jumper wire or the
 * component behind anything else, so naming a specific element kind here would
 * freeze this package's current use case into the contract. Resolved downstream
 * with `getElementId` / `getElementById`, which `@tscircuit/circuit-json-util`
 * already provides.
 *
 * Deliberately not typed as circuit-json's element-type union: this package does
 * not depend on circuit-json, and does not need to in order to carry a pair of
 * strings from its caller back out again.
 */
export interface CircuitJsonElementRef {
  elementType: string
  elementId: string
}

/**
 * One authored screw boss.
 *
 * Process-independent: which fastener, where it stands, and what it fastens.
 * How the boss is bored, how much melt relief it gets and how much floor must
 * remain beneath it are FDM answers, and live in `lib/fdm/`.
 */
export interface EnclosureMountInput {
  /** Stable identity. Names the generated parts and their BOM occurrences. */
  id: string
  /**
   * What the screw ultimately holds down.
   *
   * Both kinds stand on the same floor boss under the same PCB hole -- the
   * difference is how far the screw reaches:
   *
   * - `board`: a short screw drops through the PCB hole into the boss and
   *   clamps the board to the base.
   * - `lid`: a long screw enters through the lid, crosses the headroom, passes
   *   through the same PCB hole and threads into the same boss, so it holds the
   *   lid down and the board is captured on the way past.
   *
   * A lid screw therefore costs no extra floor area: it reuses a hole the board
   * already has, in space the board has already cleared.
   */
  fastens: "board" | "lid"
  /**
   * What fills the gap between the board and the lid, on a `lid` mount.
   *
   * - `printed`: a hollow column moulded into the **lid**, landing on the board.
   *   It cannot be part of the base: a column standing up from the floor through
   *   the board's own hole would leave nowhere for the board to be lowered in.
   * - `spacer`: a bought nylon tube. Where its length matches a stocked piece it
   *   is one, and otherwise it is cut to length from stock during assembly --
   *   which is what lets the enclosure keep whatever headroom it needs instead
   *   of rounding its geometry to a vendor's inventory.
   * - `none`: nothing. The screw crosses open air, the lid seats on the walls as
   *   it always did, and the board is held by whatever `board` mounts it has.
   */
  lidColumn?: "printed" | "spacer" | "none"
  /** Board-relative position, in board XY -- as apertures are. */
  anchor: { x: number; y: number }
  thread: FastenerThread
  fastening: FasteningMethod
  /** Authored name; validated downstream. Omission selects socketcap. */
  head?: string
  /** Derived from `head` when omitted, and forced to `none` on a PCB mount. */
  headRecess?: HeadRecess
  /** Pins the screw length. Normally derived from the stack and rounded. */
  length?: number
  /** Required thread engagement in millimetres; never silently shortened. */
  threadEngagement?: number
  /** Self-tapping installation bore diameter in millimetres. */
  pilotDiameter?: number
  /** Empty blind-bore depth below the screw tip, in millimetres. */
  bottomClearance?: number
  /** Self-tapping entry mouth / bore diameter ratio; 1 disables the chamfer. */
  boreEntryChamfer?: number
  /** Empty installation depth below the insert, in millimetres. */
  insertBottomClearance?: number
  /** Insert entry mouth / bore diameter ratio; 1 disables the chamfer. */
  insertBoreEntryChamfer?: number
  /** Overrides the boss outside diameter, otherwise derived from the bore. */
  bossDiameter?: number
  /**
   * Drill diameter of the PCB hole this mount was declared in.
   *
   * A constraint to check, never a value to size the boss from: a hole too small
   * for the screw shank is a design error naming both numbers.
   */
  pcbHoleDiameter?: number
  /**
   * The element whose existence requires this mount -- the mounting hole a boss
   * was declared in. Carried through to every piece of hardware the mount
   * consumes, so a BOM line can point back at the feature that caused it without
   * anyone re-deriving the association later.
   */
  generatedBy?: CircuitJsonElementRef
  manufacturerPartNumber?: string
  supplierPartNumbers?: Record<string, string[]>
}
