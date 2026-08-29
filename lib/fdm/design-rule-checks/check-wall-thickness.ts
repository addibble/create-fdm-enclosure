import type { ResolvedFdmEnclosureDimensions } from "../types"
import type { FdmDesignRules } from "../design-rules"
import type { FdmDesignRuleViolation } from "../types"

/**
 * Checks every wall the enclosure generates against the thinnest wall the
 * printer can lay down soundly.
 *
 * This is the most basic manufacturability rule there is, and the one most
 * easily broken from a distance: the thicknesses below are authored per
 * enclosure, or derived from a ratio, or raised to satisfy a fastener stack, and
 * nothing along any of those paths knows what the machine can print. A 0.5mm
 * lid is a perfectly consistent design and an unprintable object.
 */
export const checkWallThickness = ({
  dimensions,
  rules,
}: {
  dimensions: ResolvedFdmEnclosureDimensions
  rules: FdmDesignRules
}): FdmDesignRuleViolation[] => {
  const walls: Array<{ label: string; thicknessMm: number }> = [
    { label: "side wall", thicknessMm: dimensions.wallThickness },
    { label: "floor", thicknessMm: dimensions.floorThickness },
    { label: "lid", thicknessMm: dimensions.lidThickness },
    {
      // Derived from the side wall by ratio and then capped, so it can fall
      // below the minimum without any authored number doing so.
      label: "lid lip wall",
      thicknessMm: Math.min(
        dimensions.wallThickness * rules.lipWallThicknessRatio,
        rules.lipWallThicknessMax,
      ),
    },
  ]

  return walls
    .filter((wall) => wall.thicknessMm < rules.minWallThicknessMm)
    .map((wall) => ({
      rule: "wall_below_minimum_thickness" as const,
      // Unlike a weakened boss this is not a judgement the author can make:
      // below one extrusion width there is no wall, only a gap.
      severity:
        wall.thicknessMm < rules.nozzleDiameterMm
          ? ("error" as const)
          : ("warning" as const),
      measuredMm: wall.thicknessMm,
      limitMm: rules.minWallThicknessMm,
      message: `The ${wall.label} is ${wall.thicknessMm.toFixed(2)}mm, below the ${rules.minWallThicknessMm}mm minimum printable wall for a ${rules.nozzleDiameterMm}mm nozzle.`,
    }))
}
