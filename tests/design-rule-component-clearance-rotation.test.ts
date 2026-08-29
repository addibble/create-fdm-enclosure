import { expect, test } from "bun:test"
import { checkComponentClearance } from "../lib/fdm/design-rule-checks/check-component-clearance"
import { DEFAULT_FDM_DESIGN_RULES } from "../lib/fdm/design-rules"
import type { ResolvedFdmMount } from "../lib/fdm/types"

const board = { width: 40, height: 24, thickness: 1.6 }
const dimensions = {
  width: 46,
  height: 30,
  depth: 14,
  wallThickness: 2,
  floorThickness: 2,
  boardClearance: 1,
  lidThickness: 2,
  standoffHeight: 4,
  topHeadroom: 6,
  lidLipDepth: 3,
}

const mountAt = (x: number): ResolvedFdmMount =>
  ({
    mount: { id: "EN1.H1" },
    center: { x, y: 0 },
    bossDiameterMm: 7.2,
    bossBottomZ: 2,
    bossTopZ: 6,
  }) as unknown as ResolvedFdmMount

/**
 * A part is tested against the rectangle it actually occupies, not against the
 * larger box that rectangle spans in board axes. For a long thin part turned 90
 * degrees the difference decides the answer, and using the axis-aligned span
 * would report interference with a boss the part does not come near.
 */
test("a rotated part is tested against its own rectangle, not its board-axis span", () => {
  // 20mm long, 2mm wide, turned to run along Y. A boss 6mm away in X is clear
  // of it, though it sits well inside the part's unrotated 20mm X span.
  const component = {
    id: "J1",
    center: { x: 0, y: 0 },
    boardSide: "bottom" as const,
    body: { size: { x: 20, y: 2 }, aboveBoardHeight: 5, rotation: 90 },
  }

  const run = (mountX: number) =>
    checkComponentClearance({
      components: [component],
      mounts: [mountAt(mountX)],
      board,
      dimensions,
      rules: DEFAULT_FDM_DESIGN_RULES,
    })

  expect(run(6)).toEqual([])
  // Along the direction it was turned to, the same distance interferes.
  expect(run(0)).toHaveLength(1)
})
