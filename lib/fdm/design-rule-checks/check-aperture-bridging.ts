import { getFaceNormalAxis } from "../../enclosure/faces"
import type { ResolvedEnclosureAperturePlacement } from "../../enclosure/types"
import type { FdmDesignRules } from "../design-rules"
import type { FdmDesignRuleViolation } from "../types"

/**
 * Checks that the roof over each opening is narrow enough to bridge.
 *
 * A base is printed floor-down, so the top edge of every side-wall aperture is
 * laid into free air across the opening's width. Within a span the printer can
 * bridge, the strands pull straight and hold their line; past it they droop into
 * the opening, and the part that was supposed to fit through no longer does.
 *
 * Only the four side walls are checked. An opening in the lid or the floor is
 * cut through a plate that is printed flat, so its edges are supported all the
 * way round and there is no span to bridge.
 */
export const checkApertureBridging = ({
  placements,
  rules,
}: {
  placements: ResolvedEnclosureAperturePlacement[]
  rules: FdmDesignRules
}): FdmDesignRuleViolation[] =>
  placements.flatMap((placement, apertureIndex) => {
    if (getFaceNormalAxis(placement.face) === "z") return []
    // `width` is the opening across the face's horizontal tangent, which is the
    // span the roof has to cross. `height` runs vertically and is built up layer
    // by layer, so it is supported however tall it is.
    if (placement.width <= rules.maxBridgeSpanMm) return []

    return [
      {
        rule: "unsupported_bridge" as const,
        // Bridging degrades rather than fails: a span past the limit sags by an
        // amount the slicer's settings and the material both influence, so this
        // is a warning even when it is well over.
        severity: "warning" as const,
        measuredMm: placement.width,
        limitMm: rules.maxBridgeSpanMm,
        apertureIndex,
        face: placement.face,
        message: `The ${placement.face} aperture is ${placement.width.toFixed(1)}mm wide, so its roof bridges further than the ${rules.maxBridgeSpanMm}mm this profile prints cleanly and will sag into the opening. Split it, arch it, or print the base on a different face.`,
      },
    ]
  })
