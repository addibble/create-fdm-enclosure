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
}
