import { expect, test } from "bun:test"
import * as jscadModeling from "@jscad/modeling"
import { executeJscadOperations } from "jscad-planner"
import { createFdmEnclosure } from "../lib"

/**
 * The cutter already spans the lid plate, so a derived inward projection begins
 * at the lid's inner surface. Measuring it again from the outer surface adds one
 * lid thickness and breaches the opposite floor when the board sits close to
 * that floor. This low-standoff fixture makes the otherwise hidden overrun land
 * inside a material probe.
 */
test("a derived lid cut preserves the floor at low standoff height", () => {
  const output = createFdmEnclosure({
    board: { width: 60, height: 40, thickness: 1.6 },
    standoffHeight: 0.5,
    apertures: [
      {
        shape: "circle",
        face: "z_pos",
        radius: 1.9,
        margin: 0.3,
        center: { x: 18, y: -6 },
        boardSide: "top",
        componentBody: {
          size: { x: 9.5, y: 6.05, z: 15 },
          aboveBoardHeight: 15,
          rotation: 0,
          footprint: { width: 9.5, height: 6.05 },
        },
      },
    ],
  })
  const base = output.parts.find((part) => part.id === "base")!
  const geometry = executeJscadOperations(
    jscadModeling as any,
    base.jscadPlan as any,
  ) as any
  const probe = jscadModeling.primitives.cuboid({
    size: [2, 2, 1.2],
    center: [18, -6, 1.1],
  })
  const remainingVolume = jscadModeling.measurements.measureVolume(
    jscadModeling.booleans.intersect(geometry, probe) as any,
  )

  expect(remainingVolume).toBeCloseTo(2 * 2 * 1.2)
})
