import type {
  EnclosureBoardInput,
  ResolvedEnclosureAperturePlacement,
  ResolvedEnclosureInput,
} from "../enclosure/types"
import { checkApertureBridging } from "./design-rule-checks/check-aperture-bridging"
import { checkBoardEdgeClearance } from "./design-rule-checks/check-board-edge-clearance"
import { checkComponentClearance } from "./design-rule-checks/check-component-clearance"
import { checkInsertEncirclement } from "./design-rule-checks/check-insert-encirclement"
import { checkWallThickness } from "./design-rule-checks/check-wall-thickness"
import type { FdmDesignRules } from "./design-rules"
import type {
  FdmDesignRuleViolation,
  ResolvedFdmEnclosureDimensions,
  ResolvedFdmMount,
} from "./types"

/**
 * Runs every FDM design rule check against a solved enclosure.
 *
 * The rules are constraints of the *process*, not of this package: a wall has a
 * minimum thickness because of what a nozzle can lay down, an opening has a
 * maximum roof span because of what will bridge, a boss must encircle its insert
 * because a broken ring has nothing to resist the press. An enclosure can be
 * perfectly consistent -- every dimension derived correctly from every other --
 * and still be unprintable, and nothing in the resolution path is positioned to
 * notice, because each stage only sees the feature it builds.
 *
 * So they run in one place, after composition, over resolved data. Adding a rule
 * is a file under `design-rule-checks/` and a line here; each takes plain data
 * and returns violations, with no solver and no geometry kernel, so it is tested
 * by describing a design rather than by building an enclosure.
 *
 * Not yet checked: unsupported overhangs. Unlike the three below it cannot be
 * decided from resolved dimensions -- it needs the composed solid and the print
 * orientation of each part, since the same feature is an overhang or not
 * depending on which way up it is printed.
 */
export const checkFdmDesignRules = (input: {
  dimensions: ResolvedFdmEnclosureDimensions
  mounts: ResolvedFdmMount[]
  placements: ResolvedEnclosureAperturePlacement[]
  /** Tool depth per placement, positionally matched, from the cutout planner. */
  cutDepths: number[]
  components: ResolvedEnclosureInput["components"]
  board: EnclosureBoardInput
  rules: FdmDesignRules
}): FdmDesignRuleViolation[] => [
  ...checkWallThickness(input),
  ...checkBoardEdgeClearance(input),
  ...checkComponentClearance(input),
  ...checkInsertEncirclement(input),
  ...checkApertureBridging(input),
]
