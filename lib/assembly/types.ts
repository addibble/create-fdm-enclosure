/**
 * Process-independent description of the vertical stack of an enclosed-board
 * assembly. It deliberately says nothing about how the shells are produced, so
 * this layer can move to `@tscircuit/assembly` unchanged.
 */
export interface EnclosureAssemblyFrameInput {
  /** Material below the mounted board, measured from the outside bottom. */
  floorThickness: number
  /** Gap between the inside floor and the board bottom surface. */
  standoffHeight: number
  /** Board thickness. */
  boardThickness: number
  /** Distance from the outside top down to the parting plane. */
  seamOffsetFromTop: number
  /** Outside height of the assembled product. */
  totalHeight: number
}

/**
 * The planes fixed by the stack below the seam. These depend only on how the
 * board is mounted, never on how tall the enclosure is, which is what lets the
 * overall height be *derived* from them.
 */
export interface EnclosureBoardPlanes {
  /** Top surface of the base floor. */
  floorTopZ: number
  /** PCB bottom surface in enclosure-local coordinates. */
  boardBottomZ: number
  /** PCB top surface in enclosure-local coordinates. */
  boardTopZ: number
}

export interface EnclosureAssemblyFrame extends EnclosureBoardPlanes {
  /** Base/lid parting plane. */
  seamZ: number
  /** Outside top surface of the assembled enclosure. */
  totalHeight: number
}
