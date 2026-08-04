import { formatMm } from "./format-mm"

/**
 * Numeric guards for authored input.
 *
 * Each takes the caller-facing path of the value (`apertures[2].width`)
 * rather than a bare label, so an author is told which field of their own input
 * is at fault and not which internal variable it became, and each reports the
 * value it actually got -- usually the fastest way to see that a unit or a
 * variable went astray.
 */

export const assertFinite = (value: number, name: string): void => {
  if (!Number.isFinite(value)) {
    throw new Error(`${name} must be finite, but is ${value}`)
  }
}

export const assertPositive = (value: number, name: string): void => {
  assertFinite(value, name)
  if (value <= 0) {
    throw new Error(`${name} must be greater than 0, but is ${formatMm(value)}`)
  }
}

export const assertNonNegative = (value: number, name: string): void => {
  assertFinite(value, name)
  if (value < 0) {
    throw new Error(`${name} must not be negative, but is ${formatMm(value)}`)
  }
}
