import {
  type EnclosureAssemblyFrame,
  resolveEnclosureAssemblyFrame,
} from "../assembly"
import type { EnclosureBoardInput } from "../enclosure"
import type { ResolvedFdmEnclosureDimensions } from "./types"

/**
 * Map resolved FDM box dimensions onto the process-independent assembly frame.
 * The FDM lid top plate is what sits above the seam, so its thickness is the
 * generic `seamOffsetFromTop`.
 */
export const resolveFdmEnclosureFrame = ({
  board,
  dimensions,
}: {
  board: EnclosureBoardInput
  dimensions: ResolvedFdmEnclosureDimensions
}): EnclosureAssemblyFrame =>
  resolveEnclosureAssemblyFrame({
    floorThickness: dimensions.floorThickness,
    standoffHeight: dimensions.standoffHeight,
    boardThickness: board.thickness,
    seamOffsetFromTop: dimensions.lidThickness,
    totalHeight: dimensions.depth,
  })
