import type { EnclosureApertureInput } from "../enclosure"
import { getComponentBodyAboveBoardHeight } from "../enclosure/component-body"
import { getApertureDimensions } from "./get-aperture-dimensions"

/**
 * How far above the mounting surface a side-face opening sits before any
 * authored offset, measured to the opening's CENTER.
 *
 * The part decides: an opening is centered on the body it serves, so it lines up
 * with the connector without anyone computing a height. That needs the part's
 * true reach above the board, which `componentBody.aboveBoardHeight` supplies
 * from measured model bounds.
 *
 * Where a part has no measured bounds there is nothing to center on, so this
 * falls back to half the opening's own height -- which rests its lower edge on
 * the mounting surface. That is the older behaviour, kept because it is a
 * reasonable guess and because it keeps parts without CAD models working.
 */
export const getApertureHeightDatum = (
  aperture: EnclosureApertureInput,
): number => {
  const aboveBoardHeight = getComponentBodyAboveBoardHeight(
    aperture.componentBody,
  )
  if (aboveBoardHeight !== undefined) return aboveBoardHeight / 2
  return getApertureDimensions(aperture).height / 2
}
