import * as jscad from "@jscad/modeling"
import type { Geom3, Geometry } from "@jscad/modeling/src/geometries/types"
import {
  executeJscadOperations,
  type JscadImplementation,
  type JscadOperation,
} from "jscad-planner"

// Planner declares vectors as number[]; modeling requires fixed tuples and uses
// overloaded geometry signatures. Keep this external declaration bridge at one
// boundary; polygon objects already share the same structural type.
const implementation = jscad as unknown as JscadImplementation<Geometry>

export const executeFdmSolid = (plan: JscadOperation): Geom3 => {
  const result: unknown = executeJscadOperations(implementation, plan)
  if (!jscad.geometries.geom3.isA(result)) {
    throw new Error("FDM solid plan must execute to a 3D solid")
  }
  return result
}

export const FDM_VOLUME_EPSILON = 1e-7

export const fdmSolidsIntersect = (a: Geom3, b: Geom3): boolean => {
  const [aMin, aMax] = jscad.measurements.measureBoundingBox(a)
  const [bMin, bMax] = jscad.measurements.measureBoundingBox(b)
  if (
    [0, 1, 2].some(
      (axis) => aMax[axis]! <= bMin[axis]! || bMax[axis]! <= aMin[axis]!,
    )
  ) {
    return false
  }
  return (
    Math.abs(jscad.measurements.measureVolume(jscad.booleans.intersect(a, b))) >
    FDM_VOLUME_EPSILON
  )
}
