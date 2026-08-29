/**
 * Fastener vocabulary and specifications.
 *
 * Process-independent on purpose: a CNC or sheet-metal enclosure uses the same
 * threads, the same clearance holes and the same BOM identity. Only what a
 * *printed* boss does with them (melt relief, pilot depth in plastic, minimum
 * floor under a bore) belongs in `lib/fdm/`.
 *
 * All dimensions are millimetres.
 */

/** Nominal metric thread designations the catalogue covers. */
export type FastenerThread = "M2" | "M2.5" | "M3" | "M4" | "M5"

/**
 * How a boss retains the screw. Selects what is bored into the boss and what
 * hardware the assembly consumes.
 */
export type FasteningMethod =
  | "heat_set_insert"
  | "press_fit_insert"
  | "self_tapping"

/** Screw head style. Sets head dimensions and which recess is legal. */
export type ScrewHead = "socket_cap" | "countersunk" | "pan" | "button"

/** Geometry cut for the head in the part it bears on. */
export type HeadRecess = "none" | "countersink" | "counterbore"

/** Roles a purchased hardware piece can play. */
export type HardwareRole = "screw" | "insert" | "spacer"

/** Dimensions shared by every screw of a given thread, independent of head. */
export interface ThreadSpec {
  thread: FastenerThread
  /** Nominal major diameter. */
  nominalDiameterMm: number
  /** Coarse-series pitch. */
  pitchMm: number
  /**
   * Clearance for the shank, ISO 273 medium series.
   *
   * Used where the enclosure *generates* the passage and so chooses its size --
   * the lid -- because a printed part wants assembly slop. Not to be confused
   * with the boss bore, which is sized by the fastening method: a clearance is
   * sized so the screw does not touch it, a bore so that it does.
   */
  clearanceHoleMm: number
  /**
   * ISO 273 fine series.
   *
   * Used to *validate* a passage whose size we inherit rather than choose: a
   * PCB mounting hole, or a bought spacer's bore. A board's mounting holes are
   * conventionally close fits -- 3.2mm for
   * an M3 is what practically every layout uses -- and rejecting them for being
   * 0.2mm under the medium series would fail almost every real board while the
   * screw passes through perfectly well.
   */
  closeClearanceHoleMm: number
  /**
   * Pilot bore for a machine thread cutting its own thread in a thermoplastic
   * boss. Not the metal-tapping drill size: plastic is formed rather than cut,
   * so the pilot is larger relative to the thread.
   */
  selfTapPilotMm: number
  /**
   * Lengths under the head that are commonly stocked in this thread. Screw
   * length is derived from the assembled stack and then rounded up to a member
   * of this series -- "which lengths exist" is a fact about a vendor, never a
   * formula.
   */
  availableLengthsMm: number[]
}

/** Head dimensions for one thread/head-style combination. */
export interface ScrewHeadSpec {
  head: ScrewHead
  /** Published standard, used to build the BOM designation. */
  standard: string
  /**
   * Head diameter. For a countersunk head this is the theoretical sharp
   * diameter, which is what sizes the cone cut into the part beneath it.
   */
  headDiameterMm: number
  /** Head height. Sets counterbore depth, and the seat depth of a countersink. */
  headHeightMm: number
  /** Included angle of a countersunk head, in degrees. Absent for other styles. */
  countersinkAngleDegrees?: number
}

/** One threaded insert offered for a thread, in one series. */
export interface InsertSpec {
  method: "heat_set_insert" | "press_fit_insert"
  thread: FastenerThread
  /** Series name, part of the designation ("standard", "short", ...). */
  series: string
  /** Nominal bore in the printed boss. */
  installHoleDiameterMm: number
  /** Overall insert length along the bore. */
  lengthMm: number
  /**
   * Length of usable thread. Sets the screw's required engagement, and its
   * upper bound: a screw longer than this bottoms out and stops clamping.
   */
  threadedLengthMm: number
}

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
