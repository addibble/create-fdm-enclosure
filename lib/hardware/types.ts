/**
 * Fastener vocabulary and specifications.
 *
 * ## Where these come from
 *
 * The validated *vocabulary* (`FastenerThread`, `ScrewHead`) belongs to
 * `@tscircuit/modelprinter`. Props accepts nonempty strings, core forwards them
 * unchanged, and the enclosure boundary validates them before catalogue lookup.
 * Neither props nor core needs a copy of the supported vocabulary.
 *
 * The *catalogue* (`ThreadSpec`, `ScrewHeadSpec`, `InsertSpec` and their tables)
 * is `@tscircuit/jscad-assembly-hardware`'s. This package held a byte-for-byte
 * copy; the two then diverged where it mattered most -- the sibling fixed the
 * countersunk cone's angle and datum and this copy did not, so the solver sized
 * a recess for a head the renderer drew differently.
 *
 * Process-independent on purpose: a CNC or sheet-metal enclosure uses the same
 * threads, the same clearance holes and the same BOM identity. Only what a
 * *printed* boss does with them (melt relief, pilot depth in plastic, minimum
 * floor under a bore) belongs in `lib/fdm/`.
 *
 * All dimensions are millimetres.
 */

export type {
  FastenerThread,
  ScrewHead,
} from "@tscircuit/modelprinter"
export type {
  InsertMethod,
  InsertSpec,
  ScrewHeadSpec,
  ThreadSpec,
} from "@tscircuit/jscad-assembly-hardware"

/**
 * How a boss retains the screw. Selects what is bored into the boss and what
 * hardware the assembly consumes.
 */
export type FasteningMethod =
  | "heat_set_insert"
  | "press_fit_insert"
  | "self_tapping"

/** Geometry cut for the head in the part it bears on. */
export type HeadRecess = "none" | "countersink" | "counterbore"

/**
 * Roles a purchased hardware piece can play.
 *
 * `screw` covers a bolt too: they are the same solid, and what distinguishes
 * them -- what they thread into -- is the mount's `fastening`, not the piece's.
 * The emitted model string does make the distinction, because the renderer
 * colours them differently; see `getThreadedFastenerHardwareString`.
 */
export type HardwareRole = "screw" | "insert" | "spacer"

/** A specification resolved to real dimensions and a purchasable identity. */
export interface ResolvedFastener {
  role: HardwareRole
  /** Canonical specification identity. Groups BOM lines when no MPN exists. */
  designation: string
  /** Human-readable BOM line. */
  displayValue: string
  manufacturerPartNumber?: string
  supplierPartNumbers?: Record<string, string[]>
}
