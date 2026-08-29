import type { InsertSpec, ScrewHeadSpec } from "./types"
import type { FastenerThread } from "./types"

/**
 * Canonical specification identity for a purchased piece.
 *
 * This -- not a catalogue key -- is what groups MBOM lines when no manufacturer
 * part number is known, because mechanical hardware is bought by specification
 * and any conforming part is acceptable. It must therefore be derived only from
 * the specification: two catalogues may name the same screw differently, and
 * renaming an entry must not silently split or merge a BOM line.
 *
 * Written in the order a standard designation uses, so it reads as what it is:
 *
 *     ISO 4762 M3x8
 *     heat-set-insert M3x5.7 standard
 */
export const getScrewDesignation = ({
  thread,
  headSpec,
  designatedLengthMm,
}: {
  thread: FastenerThread
  headSpec: ScrewHeadSpec
  designatedLengthMm: number
}): string => `${headSpec.standard} ${thread}x${designatedLengthMm}`

export const getInsertDesignation = (insert: InsertSpec): string =>
  `${insert.method.replace(/_/g, "-")} ${insert.thread}x${insert.lengthMm} ${insert.series}`

const HEAD_LABELS: Record<string, string> = {
  socket_cap: "socket head cap screw",
  countersunk: "countersunk head screw",
  pan: "pan head screw",
  button: "button head screw",
}

export const getScrewDisplayValue = ({
  thread,
  headSpec,
  designatedLengthMm,
}: {
  thread: FastenerThread
  headSpec: ScrewHeadSpec
  designatedLengthMm: number
}): string =>
  `${thread} x ${designatedLengthMm}mm ${HEAD_LABELS[headSpec.head] ?? headSpec.head}`

export const getInsertDisplayValue = (insert: InsertSpec): string =>
  `${insert.thread} ${insert.method === "heat_set_insert" ? "heat-set" : "press-fit"} insert, ${insert.lengthMm}mm ${insert.series}`

/**
 * Key that collapses identical pieces into one MBOM line with a quantity.
 *
 * **A designation is the canonical name of the part; a part number says where to
 * buy one.** For commodity hardware the designation is a standard's, and any
 * conforming part satisfies it -- which is why substitution is expected and why
 * two such screws are one line whatever their part numbers say. A part with no
 * standard still has a designation: the manufacturer's, which correctly means it
 * does not group with a competitor's lookalike, because it is not one.
 *
 * So there is no part-number fallback. Beyond being unnecessary, keying on a
 * part number would make the *shape* of the BOM depend on a lookup: it is the
 * result of one, against a vendor catalogue, at a moment, possibly over a
 * network, so the same unchanged design resolved on a day one vendor is out of
 * stock would split one line of eight into two of four.
 */
export const getBomGroupKey = (designation: string): string =>
  `spec:${designation}`
