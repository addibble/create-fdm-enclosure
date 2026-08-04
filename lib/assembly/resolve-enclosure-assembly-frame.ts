import type {
  EnclosureAssemblyFrame,
  EnclosureAssemblyFrameInput,
  EnclosureBoardPlanes,
} from "./types"

/**
 * Resolve the vertical planes of an enclosed-board assembly.
 *
 * This module must not import from `lib/enclosure/` or `lib/fdm/`: the assembly
 * layer sits at the bottom of the dependency order so it can be extracted into
 * a generic `@tscircuit/assembly` package later. Process-specific callers map
 * their own dimensions onto `EnclosureAssemblyFrameInput` (see
 * `lib/fdm/resolve-fdm-enclosure-frame.ts`).
 */
export const resolveEnclosureBoardPlanes = ({
  floorThickness,
  standoffHeight,
  boardThickness,
}: Pick<
  EnclosureAssemblyFrameInput,
  "floorThickness" | "standoffHeight" | "boardThickness"
>): EnclosureBoardPlanes => {
  const floorTopZ = floorThickness
  const boardBottomZ = floorTopZ + standoffHeight
  return {
    floorTopZ,
    boardBottomZ,
    boardTopZ: boardBottomZ + boardThickness,
  }
}

export const resolveEnclosureAssemblyFrame = ({
  seamOffsetFromTop,
  totalHeight,
  ...stack
}: EnclosureAssemblyFrameInput): EnclosureAssemblyFrame => ({
  ...resolveEnclosureBoardPlanes(stack),
  seamZ: totalHeight - seamOffsetFromTop,
  totalHeight,
})
