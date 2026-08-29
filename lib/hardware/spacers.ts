import { formatMm } from "format-si-unit"
import type { FastenerThread } from "./types"

/**
 * Round unthreaded spacers, and the stock they can be cut from.
 *
 * ## What a spacer is here
 *
 * A plain tube the screw passes through, bearing on the board at one end and the
 * lid at the other. **Unthreaded** is the point: a threaded standoff would need
 * a screw entering each end, whereas the whole reason a lid screw goes through a
 * board hole is that one fastener does the entire stack.
 *
 * ## Two realizations, one part family
 *
 * A spacer's length must equal the gap it fills, and the gap is whatever the
 * enclosure's headroom happens to be. Stocked lengths are discrete, so:
 *
 * - where the gap matches a stocked length, buy that piece. It is dimensionally
 *   accurate and needs no assembly operation.
 * - otherwise, **cut it from stock**. Nylon spacer stock is sold by the length
 *   and cut to size during assembly, which is what makes an arbitrary headroom
 *   buildable at all -- without it the enclosure would have to bend its own
 *   geometry to a vendor's inventory.
 *
 * Cutting is preferred *second* because it is a hand operation with a hand
 * operation's tolerance: a sawn nylon tube is good to a few tenths, and that
 * error lands directly in the clamp. Where a stocked length fits exactly, it is
 * the better part.
 *
 * ## Provenance of these numbers
 *
 * @todo VERIFY AGAINST A VENDOR CATALOGUE BEFORE RELEASE.
 *
 * Unlike screws and inserts, spacers have no ISO standard fixing their
 * dimensions -- they are a commodity, but a vendor-specific one. The values below
 * are the common metric nylon series and are stated *without* part numbers
 * rather than with invented ones. A hardware engine supplies the real rows, and
 * until one does these are dimensionally plausible defaults, not procurement
 * facts.
 *
 * Note this is the same footing the screw and insert tables are actually on: the
 * built-in catalogue carries standards-derived dimensions and no part numbers at
 * all. The difference is only that a screw's dimensions come from a published
 * standard and a spacer's come from a vendor.
 */
export interface SpacerSpec {
  /** The screw this spacer clears. */
  thread: FastenerThread
  material: string
  /** Bore. Must clear the screw shank. */
  innerDiameterMm: number
  outerDiameterMm: number
  /** Discrete stocked pieces. */
  availableLengthsMm: number[]
  /** Length the cuttable stock is sold in. */
  stockLengthMm: number
}

export const SPACER_SPECS: Record<FastenerThread, SpacerSpec> = {
  M2: {
    thread: "M2",
    material: "nylon",
    innerDiameterMm: 2.2,
    outerDiameterMm: 4,
    availableLengthsMm: [3, 4, 5, 6, 8, 10, 12, 15, 20, 25],
    stockLengthMm: 300,
  },
  "M2.5": {
    thread: "M2.5",
    material: "nylon",
    innerDiameterMm: 2.7,
    outerDiameterMm: 5,
    availableLengthsMm: [3, 4, 5, 6, 8, 10, 12, 15, 20, 25],
    stockLengthMm: 300,
  },
  M3: {
    thread: "M3",
    material: "nylon",
    innerDiameterMm: 3.2,
    outerDiameterMm: 6,
    availableLengthsMm: [3, 4, 5, 6, 8, 10, 12, 15, 20, 25],
    stockLengthMm: 300,
  },
  M4: {
    thread: "M4",
    material: "nylon",
    innerDiameterMm: 4.3,
    outerDiameterMm: 7,
    availableLengthsMm: [3, 4, 5, 6, 8, 10, 12, 15, 20, 25],
    stockLengthMm: 300,
  },
  M5: {
    thread: "M5",
    material: "nylon",
    innerDiameterMm: 5.3,
    outerDiameterMm: 9,
    availableLengthsMm: [4, 5, 6, 8, 10, 12, 15, 20, 25],
    stockLengthMm: 300,
  },
}

/** Shortest piece worth cutting; below this the stock crumbles rather than cuts. */
const MIN_CUT_LENGTH_MM = 2

export interface SelectedSpacer {
  spec: SpacerSpec
  lengthMm: number
  /**
   * `stocked` is a discrete purchased piece, counted in the BOM.
   * `cut` is consumed from stock and measured in millimetres, so four of them
   * are one BOM line of a length rather than four line items.
   */
  supply: "stocked" | "cut"
}

/**
 * Choose the spacer that fills a gap.
 *
 * An exact stocked length wins; otherwise the piece is cut from stock, which is
 * what lets the enclosure keep whatever headroom its apertures and components
 * asked for instead of rounding its geometry to a vendor's inventory.
 */
export const selectSpacer = ({
  thread,
  gapMm,
  minimumBoreDiameterMm,
  label,
}: {
  thread: FastenerThread
  gapMm: number
  /**
   * The smallest bore that still passes the screw -- the **fine** clearance
   * series, not the medium one.
   *
   * The rule is whether the dimension is ours to choose: the medium series where
   * the enclosure *generates* the passage and wants assembly slop (the lid), the
   * fine series where it *inherits* one (a PCB mounting hole, a bought spacer's
   * bore). A spacer is deliberately a close fit so it stays concentric with the
   * screw; demanding 3.4mm of an M3 spacer would reject every one made.
   */
  minimumBoreDiameterMm: number
  label: string
}): SelectedSpacer => {
  const spec = SPACER_SPECS[thread]
  if (!spec) {
    throw new Error(`${label}: no ${thread} spacer in the catalogue`)
  }
  if (spec.innerDiameterMm + 1e-9 < minimumBoreDiameterMm) {
    throw new Error(
      `${label}: the ${thread} spacer's ${spec.innerDiameterMm}mm bore will not pass a screw needing ${minimumBoreDiameterMm}mm`,
    )
  }
  if (gapMm < MIN_CUT_LENGTH_MM) {
    throw new Error(
      `${label}: the gap between the board and the lid is ${gapMm}mm, which is too short to fill with a spacer -- raise topHeadroom or use lidColumn="printed"`,
    )
  }
  if (gapMm > spec.stockLengthMm) {
    throw new Error(
      `${label}: the gap between the board and the lid is ${gapMm}mm, longer than the ${spec.stockLengthMm}mm stock a ${thread} spacer is cut from`,
    )
  }

  const stocked = spec.availableLengthsMm.find(
    (length) => Math.abs(length - gapMm) < 1e-6,
  )
  return {
    spec,
    lengthMm: stocked ?? gapMm,
    supply: stocked === undefined ? "cut" : "stocked",
  }
}

/**
 * A cut spacer's designation names the stock *and* the length it is cut to, so
 * pieces of one length group into one line with a count: sixteen 8.2mm pieces
 * and twelve 9.1mm pieces are two lines, not one line of 220.4mm.
 *
 * How many 300mm rods that takes, and what kerf and trim it costs, is the
 * assembler's arithmetic -- in the same way a BOM asking for eight screws does
 * not ask for nine in case one is dropped.
 */
export const getSpacerDesignation = (spacer: SelectedSpacer): string => {
  // Formatted through `formatMm`, not interpolated raw. A spacer is the one
  // fastener whose length is *derived* rather than looked up in a table -- it is
  // the board-to-lid gap -- so it arrives carrying floating-point noise, and
  // 7.500000000000002 in a designation would split one BOM line into two.
  const od = formatMm(spacer.spec.outerDiameterMm)
  const id = formatMm(spacer.spec.innerDiameterMm)
  const length = formatMm(spacer.lengthMm)
  return spacer.supply === "stocked"
    ? `spacer ${spacer.spec.material} ${od} x ${id} x ${length}`
    : `spacer-stock ${spacer.spec.material} ${od} x ${id} cut ${length}`
}

export const getSpacerDisplayValue = (spacer: SelectedSpacer): string =>
  spacer.supply === "stocked"
    ? `${spacer.spec.material} spacer, ${formatMm(spacer.spec.outerDiameterMm)} OD x ${formatMm(spacer.spec.innerDiameterMm)} ID x ${formatMm(spacer.lengthMm)}`
    : `${spacer.spec.material} spacer stock, ${formatMm(spacer.spec.outerDiameterMm)} OD x ${formatMm(spacer.spec.innerDiameterMm)} ID, cut to ${formatMm(spacer.lengthMm)}`
