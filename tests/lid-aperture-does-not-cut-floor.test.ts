import { expect, test } from "bun:test"
import * as jscadModeling from "@jscad/modeling"
import { executeJscadOperations } from "jscad-planner"
import { createFdmEnclosure } from "../lib"

/**
 * A 6x6 tactile switch with a 15mm plunger, mounted on top of the board with a
 * circle in the lid for the stem -- the shape that first showed this defect.
 */
const switchAperture = (depth?: number) => ({
  board: { width: 60, height: 40, thickness: 1.6 },
  apertures: [
    {
      shape: "circle" as const,
      face: "z_pos" as const,
      radius: 1.9,
      margin: 0.3,
      center: { x: 18, y: -6 },
      boardSide: "top" as const,
      ...(depth === undefined ? {} : { depth }),
      componentBody: {
        size: { x: 9.5, y: 6.05, z: 15 },
        aboveBoardHeight: 15,
        rotation: 0,
        footprint: { width: 9.5, height: 6.05 },
      },
    },
  ],
})

/** How much of a brick sitting inside the floor plate survives the cuts. */
const floorMaterialUnderSwitch = (input: ReturnType<typeof switchAperture>) => {
  const base = createFdmEnclosure(input).parts.find((p) => p.id === "base")!
  const geometry = executeJscadOperations(
    jscadModeling as any,
    base.jscadPlan as any,
  ) as any
  const probe = jscadModeling.primitives.cuboid({
    size: [2, 2, 1.2],
    center: [18, -6, 1.1],
  })
  return jscadModeling.measurements.measureVolume(
    jscadModeling.booleans.intersect(geometry, probe) as any,
  )
}

const PROBE_VOLUME = 2 * 2 * 1.2

/**
 * The plunger stands 15mm above the board and exits through the lid. Nothing
 * about it reaches the floor, and the floor must come out of the print solid
 * beneath it.
 *
 * It did not: the 15mm reach was used as a depth measured down from the lid's
 * outer surface, which on a 15.6mm box ended at z = 0.6 -- inside a floor plate
 * spanning 0..2, leaving a circular pocket in the bottom of the box.
 */
test("a tall lid-mounted part does not cut the floor beneath it", () => {
  expect(floorMaterialUnderSwitch(switchAperture())).toBeCloseTo(PROBE_VOLUME)
})

/**
 * The counterpart, and the reason this is not the depth capping that was
 * removed: an authored depth is still rendered exactly as drawn, including when
 * that deliberately reaches the shell at the far end. Silently cutting
 * shallower than asked is its own defect.
 */
test("an authored depth still cuts as drawn, through the floor if asked", () => {
  expect(floorMaterialUnderSwitch(switchAperture(15))).toBeLessThan(
    PROBE_VOLUME - 1e-6,
  )
})
