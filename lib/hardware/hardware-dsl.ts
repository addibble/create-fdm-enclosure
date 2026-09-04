import { formatMm } from "format-si-unit"
import type {
  FasteningMethod,
  FastenerThread,
  InsertMethod,
  ScrewHead,
} from "./types"

/**
 * A compact string that fully determines a piece of hardware.
 *
 * This is the mechanical twin of a footprinter string, and it is deliberately
 * the *same grammar*: segments joined by `_`, each segment a lowercase name
 * followed by an optional numeric value.
 *
 *     screw_m3_l8mm_socketcap
 *     bolt_m3_l10mm_countersunk
 *     heatsetinsert_m3_l5.7mm
 *     spacer_od6mm_id3.2mm_l6.3mm
 *
 * ## Why a string at all, when we already have typed props
 *
 * Because a string is the one representation that is simultaneously an
 * *identity*, a *geometry source* and a *record field*. `footprinter` already
 * proves the pattern: `cad_component.footprinter_string` stores eight characters
 * and the renderer expands them into a mesh, instead of the record carrying a
 * serialized solid.
 *
 * The three jobs it can do at once:
 *
 * - **identity** -- it is canonical and total, so two pieces with the same string
 *   are the same part, which is exactly what a BOM group key needs;
 * - **geometry** -- `@tscircuit/jscad-assembly-hardware` turns it into a solid, so
 *   a purchased part can be *drawn* without anyone shipping a mesh for it. The
 *   grammar is `@tscircuit/modelprinter`'s, so every string emitted here must
 *   parse there; `tests/hardware-string-round-trip.test.ts` holds that shut.
 * - **storage** -- it is 20 bytes where a JSCAD plan is kilobytes, and it is
 *   diffable, greppable and human-readable in a saved `circuit.json`.
 *
 * ## Why not fetch the vendor's CAD instead
 *
 * For anything whose shape is implied by its specification -- every fastener --
 * a generated model is strictly better than a downloaded one: no network, no
 * B-rep tessellation, no vendor availability dependency, and it survives the
 * worker boundary and a saved build. Vendor CAD earns its keep only for shapes a
 * specification does *not* imply, such as a switch or a cable gland.
 */
export interface HardwareDslSegment {
  name: string
  value?: string
}

/**
 * Split a hardware string into its segments.
 *
 * Deliberately the same shape as footprinter's parser (`split("_")`, then
 * `/([a-zA-Z]+)([\d.].*)?/` per segment) so that one grammar covers both
 * vocabularies and neither has to be learned twice.
 */
export const parseHardwareString = (
  hardwareString: string,
): HardwareDslSegment[] => {
  const segments: HardwareDslSegment[] = []
  for (const raw of hardwareString.trim().toLowerCase().split("_")) {
    if (!raw) continue
    const match = raw.match(/^([a-z]+)([\d.].*)?$/)
    if (!match) {
      throw new Error(
        `"${raw}" is not a hardware string segment; expected a name optionally followed by a number, as in "m3" or "l8" or "socketcap"`,
      )
    }
    segments.push({ name: match[1]!, value: match[2] })
  }
  if (segments.length === 0) {
    throw new Error("a hardware string cannot be empty")
  }
  return segments
}

/**
 * Format a dimension into a hardware string.
 *
 * `formatMm` and not hand-rolled arithmetic: it already rounds floating-point
 * dust to three decimals and drops trailing zeros, which is precisely what an
 * *identity* string needs. A gap derived as
 * `totalHeight - lidThickness - boardTopZ` arrives as 7.500000000000002, and
 * left alone that noise reaches the string -- so two spacers of the same real
 * length, computed by paths differing in the last bit, would be different parts.
 *
 * Its `mm` suffix is kept rather than stripped, because that is what footprinter
 * strings do (`soic8_w5.3mm_p1.27mm`) and because it lets the value be read back
 * with `parseAndConvertSiUnit` -- which accepts other units too, so a
 * hand-written `l0.5cm` means what it says instead of being silently truncated
 * by a `parseFloat`.
 */
const dimensionToken = (valueMm: number): string => {
  if (!Number.isFinite(valueMm)) {
    throw new Error(`a hardware dimension must be finite, but is ${valueMm}`)
  }
  return formatMm(valueMm)
}

/**
 * `screw_m3_l8mm_socketcap`, or `bolt_m3_l8mm_socketcap`.
 *
 * A screw and a bolt are the same solid; they differ in what they thread into,
 * and that is a property of the MOUNT, not of the piece -- so the family is
 * chosen from the fastening method rather than read off the fastener. It is not
 * a cosmetic distinction: `jscad-assembly-hardware` colours a screw steel and a
 * bolt black-oxide precisely so the two are told apart in a section view, which
 * is the view the hardware exists to make legible.
 */
export const getThreadedFastenerHardwareString = ({
  thread,
  designatedLengthMm,
  head,
  fastening,
}: {
  thread: FastenerThread
  designatedLengthMm: number
  head: ScrewHead
  fastening: FasteningMethod
}): string =>
  `${fastening === "self_tapping" ? "screw" : "bolt"}_${thread}_l${dimensionToken(
    designatedLengthMm,
  )}_${head}`

/**
 * `heatsetinsert_m3_l5.7mm`
 *
 * The method leads the family name rather than trailing it, because in
 * modelprinter's vocabulary the family IS the method. An earlier spelling here
 * was `insert_m3_l5.7mm_heatset`, which no modelprinter family matches -- so the
 * one string that was supposed to be "the mechanical twin of a footprinter
 * string" could not be expanded into a solid by the renderers that consume it.
 *
 * A press-fit insert has no modelprinter family, so it has no model string; it
 * is still a BOM line, and it is simply not drawn.
 */
export const getInsertHardwareString = ({
  thread,
  lengthMm,
  method,
}: {
  thread: FastenerThread
  lengthMm: number
  method: InsertMethod
}): string | null =>
  method === "heat_set_insert"
    ? `heatsetinsert_${thread}_l${dimensionToken(lengthMm)}`
    : null

/**
 * `spacer_od6_id3.2_l6.3`
 *
 * The length is part of the *geometry* string even when the piece is cut from
 * stock, because the model has to be the length it was cut to. That is why this
 * is not the same string as the BOM designation, which for cut stock must omit
 * the length so that every cut draws from one line.
 */
export const getSpacerHardwareString = ({
  outerDiameterMm,
  innerDiameterMm,
  lengthMm,
}: {
  outerDiameterMm: number
  innerDiameterMm: number
  lengthMm: number
}): string =>
  `spacer_od${dimensionToken(outerDiameterMm)}_id${dimensionToken(
    innerDiameterMm,
  )}_l${dimensionToken(lengthMm)}`
