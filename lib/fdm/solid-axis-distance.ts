import { geometries } from "@jscad/modeling"
import type { Geom3 } from "@jscad/modeling/src/geometries/types"
import {
  isPointInsidePolygon,
  pointToSegmentDistance,
} from "@tscircuit/math-utils"

/** Minimum radius occupied by a solid, projecting its convex faces into XY. */
export const getFdmSolidAxisDistanceMm = (
  solid: Geom3,
  center: { x: number; y: number },
): number => {
  let distance = Number.POSITIVE_INFINITY
  for (const polygon of geometries.geom3.toPolygons(solid)) {
    const points = polygon.vertices.map(([x, y]) => ({ x, y }))
    if (isPointInsidePolygon(center, points)) return 0
    for (let i = 0; i < points.length; i++) {
      distance = Math.min(
        distance,
        pointToSegmentDistance(
          center,
          points[i]!,
          points[(i + 1) % points.length]!,
        ),
      )
    }
  }
  return distance
}
