import { expect, test } from "bun:test"
import type { CreateFdmEnclosureInput, EnclosureMechanicalInput } from "../lib"
import { createFdmEnclosure } from "../lib"

test("the FDM DTO extends the generic enclosure geometry contract", () => {
  const genericInput: EnclosureMechanicalInput = {
    board: { width: 30, height: 20, thickness: 1.6 },
    wallThickness: 2,
    floorThickness: 2,
    boardClearance: 1,
  }
  const fdmInput: CreateFdmEnclosureInput = {
    ...genericInput,
    lidThickness: 2,
    standoffHeight: 4,
    topHeadroom: 6,
    lidLipDepth: 4,
  }

  const output = createFdmEnclosure(fdmInput)
  expect(output.parts.map((part) => part.id)).toEqual(["base", "lid"])
  expect(output.frame.boardBottomZ).toBe(6)
})
