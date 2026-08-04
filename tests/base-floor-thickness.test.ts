import { expect, test } from "bun:test"
import * as jscadModeling from "@jscad/modeling"
import * as geom3 from "@jscad/modeling/src/geometries/geom3"
import { executeJscadOperations } from "jscad-planner"
import { createFdmEnclosure } from "../lib"

/**
 * The cavity subtraction is over-extended by a boolean tolerance so the base
 * prints open at the top. That tolerance must never be applied to the cavity
 * floor, which is a real surface: doing so silently prints a floor thicker than
 * `floorThickness` and drops the board below the `frame.floorTopZ` that later
 * standoff/boss stages build against.
 */
test("the base cavity floor sits exactly at the requested floorThickness", () => {
  const floorThickness = 2
  const output = createFdmEnclosure({
    board: { width: 40, height: 24, thickness: 1.6 },
    floorThickness,
    standoffHeight: 4,
  })

  const base = output.parts.find((part) => part.id === "base")
  expect(base).toBeDefined()

  const geometry = executeJscadOperations(
    jscadModeling as any,
    base!.jscadPlan as any,
  ) as any
  const zPlanes = new Set<number>()
  for (const polygon of geom3.toPolygons(geometry)) {
    for (const vertex of polygon.vertices) {
      zPlanes.add(Math.round(vertex[2] * 1e6) / 1e6)
    }
  }
  const sortedZ = [...zPlanes].sort((a, b) => a - b)

  // Outside bottom, cavity floor, then the open rim at the seam.
  expect(sortedZ[0]).toBeCloseTo(0)
  expect(sortedZ[1]).toBeCloseTo(floorThickness)
  expect(sortedZ[1]).toBeCloseTo(output.frame.floorTopZ)
})
