import type { CreateFdmEnclosureInput } from "../lib"

export const usbCPillInput: CreateFdmEnclosureInput = {
  board: { width: 40, height: 24, thickness: 1.6 },
  apertures: [
    {
      shape: "pill",
      face: "y_pos",
      width: 9,
      height: 3.6,
      margin: 0.5,
      center: { x: 0, y: 0 },
    },
  ],
}

export const multipleAperturesInput: CreateFdmEnclosureInput = {
  board: { width: 50, height: 35, thickness: 1.6 },
  topHeadroom: 8,
  apertures: [
    {
      shape: "rect",
      face: "y_pos",
      width: 12,
      height: 6,
      margin: 0.4,
      center: { x: -11, y: 0 },
    },
    {
      shape: "circle",
      face: "x_pos",
      radius: 3,
      margin: 0.25,
      center: { y: 4, x: 0 },
    },
    {
      shape: "pill",
      face: "y_neg",
      width: 4,
      height: 9,
      margin: 0.3,
      center: { x: 12, y: 0 },
    },
    {
      shape: "rect",
      face: "x_neg",
      width: 8,
      height: 4,
      center: { y: -5, x: 0 },
    },
  ],
}

export const explicitDimensionsInput: CreateFdmEnclosureInput = {
  board: { width: 25, height: 20, thickness: 1.2 },
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
  apertures: [],
}
