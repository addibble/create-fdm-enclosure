/**
 * Format a millimetre value for an error message.
 *
 * Rounded so derived numbers do not surface floating-point dust (a minimum of
 * `46.00000000000001mm` reads like a bug in the tool rather than a bound the
 * author has to clear), and trailing zeros dropped so whole numbers -- which
 * most authored dimensions are -- stay whole.
 */
export const formatMm = (value: number): string =>
  `${Number(value.toFixed(3))}mm`
