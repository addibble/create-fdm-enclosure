import { expect, test } from "bun:test"
import { explicitDimensionsInput } from "../fixtures/inputs"
import { CreateFdmEnclosureSolver } from "../lib"

test("preserves valid explicit enclosure dimensions", () => {
  const solver = new CreateFdmEnclosureSolver(explicitDimensionsInput)
  solver.solve()

  expect(solver.getOutput().dimensions).toEqual({
    width: 36,
    height: 31,
    depth: 14,
    wallThickness: 2.4,
    floorThickness: 3,
    lidThickness: 1,
    boardClearance: 1.5,
    standoffHeight: 1,
    topHeadroom: 7,
    lidLipDepth: 3,
  })
  expect(solver.getOutput().frame).toEqual({
    floorTopZ: 3,
    boardBottomZ: 4,
    boardTopZ: 5.2,
    seamZ: 13,
    totalHeight: 14,
  })
  expect(solver.getOutput().parts.map((part) => part.id)).toEqual([
    "base",
    "lid",
  ])
  expect(solver.getOutput().apertures).toEqual([])
  expect(solver.visualize()).toMatchGraphicsSvg(import.meta.path)
})
