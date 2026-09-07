import * as jscad from "@jscad/modeling"
import type { Geometry } from "@jscad/modeling/src/geometries/types"
import {
  executeJscadOperations,
  type JscadImplementation,
  type JscadOperation,
} from "jscad-planner"

export const executeApertureTestSolid = (plan: JscadOperation) => {
  // Modeling requires coordinate tuples where the planner declares number[].
  const geometry: unknown = executeJscadOperations(
    jscad as unknown as JscadImplementation<Geometry>,
    plan,
  )
  if (!jscad.geometries.geom3.isA(geometry))
    throw new Error("Expected aperture solid")
  return geometry
}
