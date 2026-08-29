/**
 * FDM process/design-rule profile.
 *
 * Rules are injectable rather than scattered through geometry code, so a
 * different printer, material, or fit class can be expressed as data instead of
 * edits to the shell and aperture builders.
 *
 * The first group are fallbacks for dimensions the author may set per
 * enclosure. The second group are process constants that are not authored.
 */
export interface FdmDesignRules {
  /** Side-wall thickness when the caller does not specify one. */
  wallThickness: number
  /** Horizontal gap from each board edge to the inside wall. */
  boardClearance: number
  /** Lid top-plate thickness. */
  lidThickness: number
  /** Gap from the inside floor to the PCB bottom. */
  standoffHeight: number
  /** Empty vertical space above the PCB. */
  topHeadroom: number
  /** Depth of the friction-fit lip below the lid. */
  lidLipDepth: number

  /**
   * Slop added to a subtraction tool so it pokes past the surface it is meant
   * to break through. Only ever applied to faces that are supposed to open:
   * extending a cut past a face that defines a wall thickness silently changes
   * that thickness.
   */
  booleanTolerance: number
  /** Total diametral gap between the lid lip and the base cavity wall. */
  slidingFitClearance: number
  /** Lip wall thickness as a fraction of the side-wall thickness. */
  lipWallThicknessRatio: number
  /** Upper bound on lip wall thickness regardless of the ratio. */
  lipWallThicknessMax: number

  /**
   * Printed wall around a fastener bore, per side. Sets the boss diameter when
   * the author does not. It is what stops a heat-set insert splitting the boss
   * as it is pressed in, so it is a process rule rather than a fastener one.
   */
  minInsertWallMm: number
  /**
   * Extra bore depth below an insert, for plastic the insert displaces as it
   * melts in. Without it the insert stops proud of the surface it should sit
   * flush with.
   */
  insertMeltReliefMm: number
  /**
   * Pilot bored beyond the thread engagement a self-tapping screw needs, so the
   * material it displaces has somewhere to go instead of jacking the screw back
   * out.
   */
  selfTapPilotReliefMm: number
  /**
   * Material that must remain below a blind bore. A bore that breaks through
   * turns the floor into a hole the screw can push a chip of plastic out of.
   */
  minFloorUnderBoreMm: number
  /** Diametral clearance added to a counterbore, so the head is not a press fit. */
  headRecessClearanceMm: number
  /**
   * Material that must remain under a head recess. What is left after a
   * countersink or counterbore is all that holds the screw down.
   */
  minMaterialUnderHeadRecessMm: number

  /**
   * Properties of the *printer*, as opposed to every rule above, which is a
   * dimension of this enclosure or a fit between its parts.
   *
   * They are what makes a design manufacturable rather than merely correct, and
   * they are the only rules here whose defaults change with the machine rather
   * than with taste. Checks measure the finished geometry against them; see
   * `checkFdmDesignRules`.
   */
  /**
   * Gap a mounting feature must leave around a part on the board.
   *
   * An assembly fit rather than a process constant: it absorbs placement
   * tolerance and the difference between a part's model and the part.
   */
  minComponentClearanceMm: number
  /** Nozzle bore. Sets the width of a single extrusion, and so every wall. */
  nozzleDiameterMm: number
  /**
   * Thinnest printable wall: two perimeters at the default nozzle.
   *
   * A single-perimeter wall prints, but it has no bonded interior and splits
   * along the layer lines, which is precisely how an enclosure fails.
   */
  minWallThicknessMm: number
  /**
   * Longest unsupported horizontal span that bridges acceptably.
   *
   * A flat roof over an opening -- the top edge of every side-wall aperture --
   * is printed into free air. Past this it sags into the opening instead of
   * holding its dimension, which is a fit problem rather than a cosmetic one.
   */
  maxBridgeSpanMm: number
  /**
   * Steepest overhang, measured from vertical, that prints without support.
   *
   * Beyond it the perimeter has nothing beneath it to bond to.
   */
  maxOverhangAngleDegrees: number
}

export const DEFAULT_FDM_DESIGN_RULES: FdmDesignRules = {
  wallThickness: 2,
  boardClearance: 1,
  lidThickness: 2,
  standoffHeight: 4,
  topHeadroom: 6,
  lidLipDepth: 4,

  booleanTolerance: 0.5,
  slidingFitClearance: 0.3,
  lipWallThicknessRatio: 0.7,
  lipWallThicknessMax: 1.5,

  minInsertWallMm: 1.6,
  insertMeltReliefMm: 0.5,
  selfTapPilotReliefMm: 1,
  minFloorUnderBoreMm: 0.8,
  headRecessClearanceMm: 0.4,
  minMaterialUnderHeadRecessMm: 0.8,

  // A 0.4mm nozzle at 0.2mm layers: the near-universal default, and what every
  // number above was implicitly chosen for.
  minComponentClearanceMm: 0.5,
  nozzleDiameterMm: 0.4,
  minWallThicknessMm: 0.8,
  maxBridgeSpanMm: 10,
  maxOverhangAngleDegrees: 45,
}
