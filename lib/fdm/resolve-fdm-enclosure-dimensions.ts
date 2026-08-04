import { assertNonNegative, assertPositive } from "../validation/assert-number"
import { getApertureClearanceDepth } from "./get-aperture-clearance-depth"
import { formatMm } from "../validation/format-mm"
import type { EnclosureBoardInput } from "../enclosure"
import type { FdmDesignRules } from "./design-rules"
import type {
  CreateFdmEnclosureInput,
  ResolvedFdmEnclosureDimensions,
} from "./types"

/** The three spans of the box, in the enclosure's own frame. */
const ENCLOSURE_AXES = ["width", "height", "depth"] as const
type EnclosureAxis = (typeof ENCLOSURE_AXES)[number]

/**
 * A lower bound, carried together with the reason it is what it is.
 *
 * A bare "width must be at least 46mm" leaves the author to work out where 46
 * came from before they can decide whether to widen the box, thin the wall or
 * cut the clearance. The breakdown is only ever assembled to be shown, so it
 * travels with the number rather than being reconstructed at the throw site.
 */
interface DimensionMinimum {
  value: number
  /** Reads as "must be at least X <because>". */
  because: string
}

/**
 * The smallest box that can hold the board, per axis.
 *
 * Width and height are the board plus a wall and a clearance on each side.
 * Depth is the vertical stack read bottom-up: floor, standoffs, board,
 * headroom, lid.
 *
 * These serve two purposes at once -- they are the default when an author gives
 * no explicit dimension, and the lower bound when they do -- which is why they
 * are computed before the choice is made rather than inside either branch.
 */
const getMinimumDimensions = ({
  board,
  wallThickness,
  boardClearance,
  floorThickness,
  standoffHeight,
  topHeadroom,
  lidThickness,
}: {
  board: EnclosureBoardInput
  wallThickness: number
  boardClearance: number
  floorThickness: number
  standoffHeight: number
  topHeadroom: number
  lidThickness: number
}): Record<EnclosureAxis, DimensionMinimum> => {
  const perSide = wallThickness + boardClearance
  const aroundTheBoard = (boardSpan: number): string =>
    `to fit the ${formatMm(boardSpan)} board inside ${formatMm(
      wallThickness,
    )} walls with ${formatMm(boardClearance)} clearance on each side`

  return {
    width: {
      value: board.width + 2 * perSide,
      because: aroundTheBoard(board.width),
    },
    height: {
      value: board.height + 2 * perSide,
      because: aroundTheBoard(board.height),
    },
    depth: {
      value:
        floorThickness +
        standoffHeight +
        board.thickness +
        topHeadroom +
        lidThickness,
      because:
        `to stack ${formatMm(floorThickness)} floor + ${formatMm(
          standoffHeight,
        )} standoffs + ${formatMm(board.thickness)} board + ` +
        `${formatMm(topHeadroom)} headroom + ${formatMm(lidThickness)} lid`,
    },
  }
}

/**
 * Decide every dimension of the box.
 *
 * `topHeadroom` is the one lever an author has over how tall the box is, so
 * whether apertures are allowed to affect the depth turns on whether they
 * authored it:
 *
 * - **Authored** (or an explicit `depth`): taken literally, apertures ignored.
 *   Growing the box to contain every opening would silently override the very
 *   number the author set -- the depth would land on `tallestApertureTop +
 *   margin` no matter what `topHeadroom` said, so lowering it would do nothing
 *   and a part could never deliberately poke through the lid.
 * - **Defaulted**: there is no intent to override, and the useful default is a
 *   box that actually works, so the depth grows until the lid and its lip clear
 *   every side-face aperture (see `getApertureClearanceDepth`). Otherwise the
 *   common case -- a connector taller than the default headroom -- produces an
 *   opening straddling the parting seam, which no cable can enter.
 *
 * Note what this does NOT promise: clearance over components. Only parts that
 * own an aperture report their envelope, so an arbitrary tall capacitor is
 * invisible here. `topHeadroom` is clearance above the board, not above the
 * tallest part, and its documentation says so.
 */
export const resolveFdmEnclosureDimensions = ({
  input,
  rules,
}: {
  input: CreateFdmEnclosureInput
  rules: FdmDesignRules
}): ResolvedFdmEnclosureDimensions => {
  assertPositive(input.board.width, "board.width")
  assertPositive(input.board.height, "board.height")
  assertPositive(input.board.thickness, "board.thickness")

  // The floor defaults to the WALL thickness rather than to a rule of its own,
  // so overriding `wallThickness` alone still yields a uniform shell.
  const wallThickness = input.wallThickness ?? rules.wallThickness
  const floorThickness = input.floorThickness ?? wallThickness
  const lidThickness = input.lidThickness ?? rules.lidThickness
  const boardClearance = input.boardClearance ?? rules.boardClearance
  const standoffHeight = input.standoffHeight ?? rules.standoffHeight
  const topHeadroom = input.topHeadroom ?? rules.topHeadroom
  const lidLipDepth = input.lidLipDepth ?? rules.lidLipDepth

  assertPositive(wallThickness, "wallThickness")
  assertPositive(floorThickness, "floorThickness")
  assertPositive(lidThickness, "lidThickness")
  assertNonNegative(boardClearance, "boardClearance")
  assertNonNegative(standoffHeight, "standoffHeight")
  assertNonNegative(topHeadroom, "topHeadroom")
  assertNonNegative(lidLipDepth, "lidLipDepth")

  const minimum = getMinimumDimensions({
    board: input.board,
    wallThickness,
    boardClearance,
    floorThickness,
    standoffHeight,
    topHeadroom,
    lidThickness,
  })

  // Only consulted when `topHeadroom` was left to us; see the note above.
  const inferredDepth =
    input.topHeadroom === undefined
      ? Math.max(
          minimum.depth.value,
          getApertureClearanceDepth({
            apertures: input.apertures ?? [],
            floorThickness,
            standoffHeight,
            boardThickness: input.board.thickness,
            lidThickness,
            lidLipDepth,
          }),
        )
      : minimum.depth.value

  const dimensions: ResolvedFdmEnclosureDimensions = {
    width: input.width ?? minimum.width.value,
    height: input.height ?? minimum.height.value,
    depth: input.depth ?? inferredDepth,
    wallThickness,
    floorThickness,
    lidThickness,
    boardClearance,
    standoffHeight,
    topHeadroom,
    lidLipDepth,
  }

  for (const axis of ENCLOSURE_AXES) {
    assertPositive(dimensions[axis], axis)
  }
  for (const axis of ENCLOSURE_AXES) {
    const { value, because } = minimum[axis]
    if (dimensions[axis] < value) {
      throw new Error(
        `${axis} must be at least ${formatMm(value)} ${because}, but is ${formatMm(
          dimensions[axis],
        )}`,
      )
    }
  }

  return dimensions
}
