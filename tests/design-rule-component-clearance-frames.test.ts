import { expect, test } from "bun:test"
import { checkComponentClearance } from "../lib/fdm/design-rule-checks/check-component-clearance"
import { DEFAULT_FDM_DESIGN_RULES } from "../lib/fdm/design-rules"
import type { ResolvedFdmMount } from "../lib/fdm/types"
import { resolveFdmEnclosureProblem, type FdmBoardComponent } from "../lib"

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

/** Boss diameter 7.2, so a radius of 3.6 about the mount axis. */
const mountAt = (x: number, y: number): ResolvedFdmMount =>
  resolveFdmEnclosureProblem({
    board,
    mounts: [
      {
        id: "EN1.H1",
        anchor: { x, y },
        fastens: "board",
        thread: "m3",
        fastening: "heat_set_insert",
        head: "socketcap",
      },
    ],
  }).mounts[0]!

const run = (component: FdmBoardComponent, mount: ResolvedFdmMount) =>
  checkComponentClearance({
    components: [component],
    mounts: [mount],
    board,
    dimensions,
    rules: DEFAULT_FDM_DESIGN_RULES,
  })

/**
 * `size` and `footprint` are in different frames, and the part is placed where
 * that difference decides the answer.
 *
 * A 20 x 2mm connector turned 90 degrees occupies 2mm of X and 20mm of Y. Its
 * `size` says 20 x 2 in the part's own frame; its `footprint` says 2 x 20,
 * already projected into board axes. Combining them per-axis with `Math.max`
 * produces a 20 x 20 square that is in no frame at all, and then rotating the
 * mount axis into the part frame reads a board-frame width as a part-frame one.
 *
 * The existing rotation test supplies `size` alone, so it cannot see this --
 * which is why it passed throughout. Core supplies BOTH on every part
 * (`get-component-body.ts` always emits `footprint` from `pcb_component`), so
 * both cases below are reachable from an ordinary board.
 */
test("a rotated part is measured in the frame each envelope is stated in", () => {
  const rotatedConnector = {
    id: "J1",
    center: { x: 0, y: 0 },
    boardSide: "bottom" as const,
    body: {
      size: { x: 20, y: 2 },
      footprint: { width: 2, height: 20 },
      aboveBoardHeight: 5,
      rotation: 90,
    },
  }

  // FALSE NEGATIVE, the one that matters. Only the footprint bounds this part,
  // which is the ordinary case for a component whose model was never measured.
  // The boss sits at y=6, inside the part's 20mm run along Y, so it is driven
  // straight through it. Rotating the already-board-frame footprint into the
  // part frame moved the axis to x=6 instead, cleared it by 1.4mm, and reported
  // nothing -- dropping a "the board cannot seat" error.
  const footprintOnly = {
    ...rotatedConnector,
    body: { ...rotatedConnector.body, size: undefined },
  }
  const through = run(footprintOnly, mountAt(0, 6))
  expect(through).toHaveLength(1)
  expect(through[0]!.severity).toBe("error")
  expect(through[0]!.message).toContain("runs through")

  // FALSE POSITIVE, the same mistake read the other way. 6mm along X clears a
  // part that is 2mm wide there, by both envelopes. The 20 x 20 square said
  // otherwise and reported an error against a boss the part never comes near.
  expect(run(rotatedConnector, mountAt(6, 0))).toEqual([])

  // And the check still bites when the part really is in the way.
  expect(run(rotatedConnector, mountAt(0, 6))).toHaveLength(1)
})
