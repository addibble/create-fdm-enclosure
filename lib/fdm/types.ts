import type { JscadOperation, Matrix4 } from "jscad-planner"
import type { ResolvedThreadedFastener } from "@tscircuit/jscad-assembly-hardware"
import type { FdmInstallationPolicy } from "./resolve-installation-policy"
import type { EnclosureAssemblyFrame } from "../assembly"
import type {
  CircuitJsonElementRef,
  EnclosureBoardComponent,
  EnclosureFace,
  EnclosureMechanicalInput,
  EnclosureMountInput,
  ResolvedEnclosureAperture,
  ResolvedEnclosureDimensions,
  ResolvedEnclosureInput,
} from "../enclosure"
import type {
  HardwareRole,
  SelectedSpacer,
  HeadRecess,
  InsertSpec,
  ScrewHeadSpec,
  ScrewLengthResolution,
} from "../hardware"
import type { FdmDesignRules } from "./design-rules"

/**
 * Actual body geometry in board-local right-handed XYZ, Z-up millimetres.
 * The board midplane is Z=0. No additional center/layer transform is applied.
 * Boolean checks require a closed solid with consistently outward-wound faces.
 */
export type FdmComponentSolid =
  | { type: "jscad"; jscadPlan: JscadOperation }
  | { type: "triangle_mesh"; positions: number[]; indices?: number[] }

export interface FdmBoardComponent extends EnclosureBoardComponent {
  /** Preferred over the conservative body envelope when available. */
  solid?: FdmComponentSolid
}

export interface CreateFdmEnclosureInput extends EnclosureMechanicalInput {
  components?: FdmBoardComponent[]
  /** Lid top-plate thickness. Defaults to wallThickness. */
  lidThickness?: number
  /** Gap between the inside floor and PCB bottom. Defaults to 4 mm. */
  standoffHeight?: number
  /**
   * Empty vertical space above the PCB top surface, not above the tallest
   * component -- only parts owning an aperture report a height at all.
   *
   * Omitted, the depth is inferred and grows to clear every side-wall aperture.
   * Given, it is taken literally and apertures do not affect the depth. Defaults
   * to 6 mm when nothing else forces the box taller.
   */
  topHeadroom?: number
  /** Depth of the friction-fit lip below the lid. Defaults to 4 mm. */
  lidLipDepth?: number
  /** Overrides for the FDM design-rule profile. */
  fdmRules?: Partial<FdmDesignRules>
}

export interface ResolvedFdmEnclosureDimensions
  extends ResolvedEnclosureDimensions {
  lidThickness: number
  standoffHeight: number
  topHeadroom: number
  lidLipDepth: number
}

/**
 * The fully-decided FDM enclosure problem. Produced once by
 * `resolveFdmEnclosureProblem`; every pipeline stage reads only from this, so
 * no stage re-applies a default, a fallback, or a validation rule.
 */
export interface ResolvedFdmEnclosureInput extends ResolvedEnclosureInput {
  components?: FdmBoardComponent[]
  construction: "fdm_box"
  dimensions: ResolvedFdmEnclosureDimensions
  rules: FdmDesignRules
  frame: EnclosureAssemblyFrame
  mounts: ResolvedFdmMount[]
}

export interface FdmEnclosurePart {
  id: "base" | "lid"
  jscadPlan: JscadOperation
}

/**
 * One physical piece of purchased hardware the assembled enclosure consumes.
 *
 * One record per physical piece, never per line: a line's quantity is the count
 * of occurrences sharing a `bomGroupKey`, exactly as the PCBA BOM derives
 * quantity from placed components today. `bomGroupKey` is what
 * collapses identical pieces into a line -- a real part number when one is
 * known, and otherwise the specification, because mechanical hardware is bought
 * by specification and any conforming part is acceptable.
 *
 * This is the shape the proposed `assembly_component` Circuit JSON record carries,
 * minus its type tag, its ids, and its parent. The parent is absent on purpose
 * rather than missing: everything in this list is consumed by *this enclosure*,
 * which is a subassembly of the device in its own right, so the owning node is
 * whichever enclosure ran the solver and is supplied when these are lowered.
 *
 * Until that record exists, this is where the manufacturing BOM lives, and it
 * deliberately does **not** travel as a `pcb_component`: the board assembly does
 * not consume these, and the PCBA BOM is correct precisely because it is derived
 * from what the board carries.
 */
export interface HardwareOccurrence {
  id: string
  role: HardwareRole
  /** The mount that consumes it, for traceability. */
  mountId: string
  /** Canonical specification identity. */
  designation: string
  /**
   * A compact string that fully determines this part's geometry, expandable
   * with `getHardwareModel`. The mechanical twin of `footprinter_string`.
   *
   * Carried instead of a solid so the occurrence stays small and legible: the
   * string is ~20 bytes where its plan is ~250 and a mesh is kilobytes. Whoever
   * lowers these into CAD expands it; a renderer that learns the vocabulary can
   * skip even that.
   */
  /**
   * Null when the piece has no modelprinter family -- a press-fit insert today.
   * It is still a BOM line; it is simply not drawn, which is better than being
   * drawn as something else.
   */
  hardwareString: string | null
  displayValue: string
  manufacturerPartNumber?: string
  supplierPartNumbers?: Record<string, string[]>
  bomGroupKey: string
  /**
   * The element whose existence requires this piece, copied from the mount.
   * Absent when nothing more specific than the enclosure generated it -- a lid
   * screw is caused by the enclosure, which is already the assembly that
   * consumes it.
   */
  generatedBy?: CircuitJsonElementRef
  /** Part-local to enclosure-local right-handed Z-up mm transform. */
  enclosureFromPart: Matrix4
  /** Legacy translation boundary; actual part origin, not a mating target datum. */
  position: { x: number; y: number; z: number }
}

/** One screw boss after every default, fallback and fastener choice is decided. */
export interface ResolvedFdmMount {
  /** The authored mount this was resolved from. */
  mount: EnclosureMountInput
  /** Boss axis, in enclosure-local XY. */
  center: { x: number; y: number }
  bossDiameterMm: number
  boreDiameterMm: number
  boreDepthMm: number
  /**
   * The floor boss spans this Z range: it stands on the inside floor and stops
   * at the underside of the board, whatever the screw goes on to fasten.
   */
  bossBottomZ: number
  bossTopZ: number
  /**
   * The purchased spacer filling the board-to-lid gap, when one was asked for.
   * Mutually exclusive with `lidColumn`: either the lid carries a printed
   * column, or a bought tube does the same job.
   */
  spacer?: SelectedSpacer
  /**
   * The column between the board and the lid, when a lid mount asks for one.
   *
   * Printed as part of the **lid**, hanging down -- see `EnclosureMountInput`'s
   * `lidColumn` for why it cannot belong to the base.
   */
  lidColumn?: { bottomZ: number; topZ: number; diameterMm: number }
  /** Absent for a self-tapping mount, which consumes no insert. */
  insert?: InsertSpec
  installation: FdmInstallationPolicy
  fastener: ResolvedThreadedFastener
  headRecess: HeadRecess
  headSpec: ScrewHeadSpec
  screwClearanceDiameterMm: number
  screwLength: ScrewLengthResolution
  /** Z of the surface the head bears on. */
  headSeatZ: number
  hardware: HardwareOccurrence[]
}

/** Blank shells before aperture cutouts are applied. */
export interface FdmEnclosureShellPlans {
  basePlan: JscadOperation
  lidPlan: JscadOperation
}

export interface ComposedFdmEnclosurePlans {
  parts: FdmEnclosurePart[]
  assembledPlan: JscadOperation
}

/**
 * Rules an enclosure must satisfy that are not enforceable while the geometry is
 * being built -- because they are properties of the *finished* solid, produced
 * by features that are resolved independently and only meet during composition.
 *
 * Distinct from `FdmDesignRules`, which is the parameter profile geometry is
 * built *from*. These are the checks that the result still honours it.
 */
export type FdmDesignRuleId =
  /** A wall thinner than the printer can lay down soundly. */
  | "wall_below_minimum_thickness"
  /** A boss whose ring of material around a fastener is broken. */
  | "insert_not_encircled"
  /** A flat roof over an opening, too wide to bridge without sagging. */
  | "unsupported_bridge"
  /** A mounting feature in the way of a part on the board. */
  | "component_clearance"
  /** A mount too near the board edge for the board to seat on it. */
  | "board_edge_clearance"
  /** A part in the way of a mounting feature, with no envelope to decide by. */
  | "component_bounds_unknown"
  | "printed_part_clearance"

export interface FdmDesignRuleViolation {
  rule: FdmDesignRuleId
  /**
   * `error` means the enclosure will not do its job -- a fastener with no
   * material to hold it. `warning` means it is buildable but weaker than the
   * rules it was designed to, which is a judgement call the author owns.
   */
  severity: "error" | "warning"
  message: string
  /**
   * The quantity the rule is about, as built. `NaN` where the rule fired
   * *because* the quantity is unavailable.
   */
  measuredMm: number
  /** The value it had to reach. */
  limitMm: number
  mountId?: string
  /**
   * Index into the resolved aperture placements. Apertures carry no identity of
   * their own -- they are authored as geometry on a face, not as named parts --
   * so position within the solve is the only stable handle there is.
   */
  apertureIndex?: number
  /** `EnclosureBoardComponent.id` of the part involved. */
  componentId?: string
  face?: EnclosureFace
}

export interface CreateFdmEnclosureOutput {
  dimensions: ResolvedFdmEnclosureDimensions
  frame: EnclosureAssemblyFrame
  parts: FdmEnclosurePart[]
  apertures: ResolvedEnclosureAperture[]
  mounts: ResolvedFdmMount[]
  /**
   * The enclosure's manufacturing BOM: every purchased piece the assembly
   * consumes, one entry per piece. See `HardwareOccurrence`.
   */
  hardware: HardwareOccurrence[]
  /**
   * Rules the finished geometry does not satisfy. Empty for a clean design.
   *
   * Reported rather than thrown: every violation here describes a solid that
   * was built successfully and is measurably worse than intended, which is a
   * different thing from an input that cannot be resolved at all.
   */
  designRuleViolations: FdmDesignRuleViolation[]
  jscadPlan: JscadOperation
}
