import {
  assertFinite,
  assertNonNegative,
  assertPositive,
} from "../validation/assert-number"
import type { EnclosureApertureInput } from "../enclosure"
import { assertEnclosureFace } from "../enclosure/faces"

/**
 * Check one authored aperture for values that are wrong on their own terms.
 *
 * Only what can be judged without an enclosure: a radius must be positive
 * whatever box it is cut into. Whether the opening actually FITS is a different
 * question, needs resolved dimensions, and lives in
 * `lib/fdm/assert-aperture-fits-enclosure.ts`.
 */
export const validateApertureInput = (
  aperture: EnclosureApertureInput,
  index: number,
): void => {
  const prefix = `apertures[${index}]`
  // Checked rather than trusted: a retired face name would otherwise be read
  // for its axis and sign and silently produce a malformed placement.
  assertEnclosureFace(aperture.face, `${prefix}.face`)
  assertFinite(aperture.center.x, `${prefix}.center.x`)
  assertFinite(aperture.center.y, `${prefix}.center.y`)
  assertNonNegative(aperture.margin ?? 0, `${prefix}.margin`)
  if (aperture.shape === "circle") {
    assertPositive(aperture.radius, `${prefix}.radius`)
  } else {
    assertPositive(aperture.width, `${prefix}.width`)
    assertPositive(aperture.height, `${prefix}.height`)
  }
  // An authored depth still has to be a real number. It is deliberately not
  // capped to the cavity -- see get-fdm-aperture-inward-projection.ts -- but a
  // NaN or a string would propagate silently into the geometry.
  if (aperture.depth !== undefined) {
    assertNonNegative(aperture.depth, `${prefix}.depth`)
  }
  // Deliberately NOT constrained to be non-negative: an opening may be nudged
  // either way across its face, and on a side wall a negative height offset can
  // pull it back toward -- and past -- the board, which is what a cable jacket
  // fatter than its connector needs. The real limit is that the opening must
  // stay on the enclosure, which is checked once dimensions exist.
  if (aperture.widthDimensionOffset !== undefined) {
    assertFinite(
      aperture.widthDimensionOffset,
      `${prefix}.widthDimensionOffset`,
    )
  }
  if (aperture.heightDimensionOffset !== undefined) {
    assertFinite(
      aperture.heightDimensionOffset,
      `${prefix}.heightDimensionOffset`,
    )
  }
}
