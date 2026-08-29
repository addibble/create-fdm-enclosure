import type {
  FastenerThread,
  InsertSpec,
  ScrewHead,
  ScrewHeadSpec,
  ThreadSpec,
} from "./types"

/**
 * The built-in fastener catalogue.
 *
 * ## What may be in here
 *
 * A specification may exist in this catalogue only if a real vendor stocks that
 * exact combination of thread, pitch, length, head style and finish. Standards
 * tables say what a conforming part *would* measure; they do not say that
 * anybody sells it, and a BOM line that cannot be bought fails at purchasing
 * rather than at design time. That is why `button` heads are listed for M3-M5
 * only, and why `availableLengthsMm` is data rather than a formula.
 *
 * The values below are the commodity series carried by general fastener
 * distributors (ISO 4762 / 7046 / 7045 / 7380) and by the two heat-set insert
 * families in common use for FDM parts. They are a curated starting set: where a
 * platform supplies a fastener engine, it supersedes them with live vendor data
 * including current availability, and that is the mechanism intended to keep
 * this file from becoming a stale copy of somebody's catalogue.
 *
 * ## What is not an axis yet
 *
 * Drive type (hex socket vs cross recess), material and finish are properties of
 * a purchased part that this catalogue fixes by picking one commodity series per
 * head style. They become specification axes when a mount needs to choose --
 * adding them is additive, because the designation is built from the axes that
 * exist.
 */
export const THREAD_SPECS: Record<FastenerThread, ThreadSpec> = {
  M2: {
    thread: "M2",
    nominalDiameterMm: 2,
    pitchMm: 0.4,
    clearanceHoleMm: 2.4,
    closeClearanceHoleMm: 2.2,
    selfTapPilotMm: 1.6,
    availableLengthsMm: [3, 4, 5, 6, 8, 10, 12, 14, 16, 18, 20],
  },
  "M2.5": {
    thread: "M2.5",
    nominalDiameterMm: 2.5,
    pitchMm: 0.45,
    clearanceHoleMm: 2.9,
    closeClearanceHoleMm: 2.7,
    selfTapPilotMm: 2.1,
    availableLengthsMm: [4, 5, 6, 8, 10, 12, 14, 16, 18, 20, 25],
  },
  M3: {
    thread: "M3",
    nominalDiameterMm: 3,
    pitchMm: 0.5,
    clearanceHoleMm: 3.4,
    closeClearanceHoleMm: 3.2,
    selfTapPilotMm: 2.5,
    availableLengthsMm: [4, 5, 6, 8, 10, 12, 14, 16, 18, 20, 25, 30],
  },
  M4: {
    thread: "M4",
    nominalDiameterMm: 4,
    pitchMm: 0.7,
    clearanceHoleMm: 4.5,
    closeClearanceHoleMm: 4.3,
    selfTapPilotMm: 3.3,
    availableLengthsMm: [5, 6, 8, 10, 12, 14, 16, 18, 20, 25, 30, 35, 40],
  },
  M5: {
    thread: "M5",
    nominalDiameterMm: 5,
    pitchMm: 0.8,
    clearanceHoleMm: 5.5,
    closeClearanceHoleMm: 5.3,
    selfTapPilotMm: 4.2,
    availableLengthsMm: [6, 8, 10, 12, 14, 16, 18, 20, 25, 30, 35, 40, 45, 50],
  },
}

/**
 * Head dimensions per thread and head style.
 *
 * A missing entry means the combination is not a stocked commodity part, and
 * resolution reports that rather than substituting a neighbouring style. Button
 * heads below M3 are the current example.
 */
export const SCREW_HEAD_SPECS: Record<
  FastenerThread,
  Partial<Record<ScrewHead, ScrewHeadSpec>>
> = {
  M2: {
    socket_cap: {
      head: "socket_cap",
      standard: "ISO 4762",
      headDiameterMm: 3.8,
      headHeightMm: 2,
    },
    countersunk: {
      head: "countersunk",
      standard: "ISO 7046",
      headDiameterMm: 3.8,
      headHeightMm: 1.2,
      countersinkAngleDegrees: 90,
    },
    pan: {
      head: "pan",
      standard: "ISO 7045",
      headDiameterMm: 4,
      headHeightMm: 1.6,
    },
  },
  "M2.5": {
    socket_cap: {
      head: "socket_cap",
      standard: "ISO 4762",
      headDiameterMm: 4.5,
      headHeightMm: 2.5,
    },
    countersunk: {
      head: "countersunk",
      standard: "ISO 7046",
      headDiameterMm: 4.7,
      headHeightMm: 1.5,
      countersinkAngleDegrees: 90,
    },
    pan: {
      head: "pan",
      standard: "ISO 7045",
      headDiameterMm: 5,
      headHeightMm: 2.1,
    },
  },
  M3: {
    socket_cap: {
      head: "socket_cap",
      standard: "ISO 4762",
      headDiameterMm: 5.5,
      headHeightMm: 3,
    },
    countersunk: {
      head: "countersunk",
      standard: "ISO 7046",
      headDiameterMm: 5.6,
      headHeightMm: 1.65,
      countersinkAngleDegrees: 90,
    },
    pan: {
      head: "pan",
      standard: "ISO 7045",
      headDiameterMm: 6,
      headHeightMm: 2.4,
    },
    button: {
      head: "button",
      standard: "ISO 7380",
      headDiameterMm: 5.7,
      headHeightMm: 1.65,
    },
  },
  M4: {
    socket_cap: {
      head: "socket_cap",
      standard: "ISO 4762",
      headDiameterMm: 7,
      headHeightMm: 4,
    },
    countersunk: {
      head: "countersunk",
      standard: "ISO 7046",
      headDiameterMm: 7.5,
      headHeightMm: 2.2,
      countersinkAngleDegrees: 90,
    },
    pan: {
      head: "pan",
      standard: "ISO 7045",
      headDiameterMm: 8,
      headHeightMm: 3.1,
    },
    button: {
      head: "button",
      standard: "ISO 7380",
      headDiameterMm: 7.6,
      headHeightMm: 2.2,
    },
  },
  M5: {
    socket_cap: {
      head: "socket_cap",
      standard: "ISO 4762",
      headDiameterMm: 8.5,
      headHeightMm: 5,
    },
    countersunk: {
      head: "countersunk",
      standard: "ISO 7046",
      headDiameterMm: 9.2,
      headHeightMm: 2.5,
      countersinkAngleDegrees: 90,
    },
    pan: {
      head: "pan",
      standard: "ISO 7045",
      headDiameterMm: 10,
      headHeightMm: 3.8,
    },
    button: {
      head: "button",
      standard: "ISO 7380",
      headDiameterMm: 9.5,
      headHeightMm: 2.75,
    },
  },
}

/**
 * Threaded inserts, longest series first.
 *
 * Ordering matters: mount resolution takes the longest insert whose bore fits
 * the boss depth available, so a shallow stack degrades to the short series
 * instead of failing. The reference implementation hit exactly this and solved
 * it by hardcoding the short M3 -- which then made every deeper enclosure weaker
 * than it needed to be.
 */
export const INSERT_SPECS: Record<FastenerThread, InsertSpec[]> = {
  M2: [
    {
      method: "heat_set_insert",
      thread: "M2",
      series: "standard",
      installHoleDiameterMm: 3.2,
      lengthMm: 4,
      threadedLengthMm: 4,
    },
    {
      method: "press_fit_insert",
      thread: "M2",
      series: "knurled",
      installHoleDiameterMm: 3,
      lengthMm: 4,
      threadedLengthMm: 4,
    },
  ],
  "M2.5": [
    {
      method: "heat_set_insert",
      thread: "M2.5",
      series: "standard",
      installHoleDiameterMm: 3.6,
      lengthMm: 5.7,
      threadedLengthMm: 5.7,
    },
    {
      method: "heat_set_insert",
      thread: "M2.5",
      series: "short",
      installHoleDiameterMm: 3.6,
      lengthMm: 3.4,
      threadedLengthMm: 3.4,
    },
    {
      method: "press_fit_insert",
      thread: "M2.5",
      series: "knurled",
      installHoleDiameterMm: 3.4,
      lengthMm: 4,
      threadedLengthMm: 4,
    },
  ],
  M3: [
    {
      method: "heat_set_insert",
      thread: "M3",
      series: "standard",
      installHoleDiameterMm: 4,
      lengthMm: 5.7,
      threadedLengthMm: 5.7,
    },
    {
      method: "heat_set_insert",
      thread: "M3",
      series: "short",
      installHoleDiameterMm: 4,
      lengthMm: 3,
      threadedLengthMm: 3,
    },
    {
      method: "press_fit_insert",
      thread: "M3",
      series: "knurled",
      installHoleDiameterMm: 3.8,
      lengthMm: 4,
      threadedLengthMm: 4,
    },
  ],
  M4: [
    {
      method: "heat_set_insert",
      thread: "M4",
      series: "standard",
      installHoleDiameterMm: 5.6,
      lengthMm: 8.1,
      threadedLengthMm: 8.1,
    },
    {
      method: "heat_set_insert",
      thread: "M4",
      series: "short",
      installHoleDiameterMm: 5.6,
      lengthMm: 4.6,
      threadedLengthMm: 4.6,
    },
    {
      method: "press_fit_insert",
      thread: "M4",
      series: "knurled",
      installHoleDiameterMm: 5.4,
      lengthMm: 6,
      threadedLengthMm: 6,
    },
  ],
  M5: [
    {
      method: "heat_set_insert",
      thread: "M5",
      series: "standard",
      installHoleDiameterMm: 6.4,
      lengthMm: 9.5,
      threadedLengthMm: 9.5,
    },
    {
      method: "press_fit_insert",
      thread: "M5",
      series: "knurled",
      installHoleDiameterMm: 6.2,
      lengthMm: 7,
      threadedLengthMm: 7,
    },
  ],
}
