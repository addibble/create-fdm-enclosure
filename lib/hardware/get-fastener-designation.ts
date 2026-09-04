import type {
  FastenerThread,
  InsertSpec,
  ScrewHead,
  ScrewHeadSpec,
} from "./types"

/**
 * A thread as a standards designation writes it: `m3` -> `M3`.
 *
 * The internal vocabulary is lowercase because that is what an author writes
 * and what a model string carries. A BOM line is neither: it is read by a buyer
 * against ISO tables, where the thread is `M3`. Converting here keeps the one
 * place the two conventions meet in the one function whose output a human buys
 * from.
 */
export const formatThreadDesignation = (thread: FastenerThread): string =>
  thread.toUpperCase()

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
}): string =>
  `${headSpec.standard} ${formatThreadDesignation(thread)}x${designatedLengthMm}`

export const getInsertDesignation = (
  thread: FastenerThread,
  insert: InsertSpec,
): string =>
  `${insert.method.replace(/_/g, "-")} ${formatThreadDesignation(thread)}x${insert.lengthMm} ${insert.series}`

const HEAD_LABELS: Partial<Record<ScrewHead, string>> = {
  socketcap: "socket head cap screw",
  countersunk: "countersunk head screw",
  panhead: "pan head screw",
  buttonhead: "button head screw",
}

export const getScrewDisplayValue = ({
  thread,
  head,
  designatedLengthMm,
}: {
  thread: FastenerThread
  head: ScrewHead
  designatedLengthMm: number
}): string =>
  `${formatThreadDesignation(thread)} x ${designatedLengthMm}mm ${HEAD_LABELS[head] ?? head}`

export const getInsertDisplayValue = (
  thread: FastenerThread,
  insert: InsertSpec,
): string =>
  `${formatThreadDesignation(thread)} ${insert.method === "heat_set_insert" ? "heat-set" : "press-fit"} insert, ${insert.lengthMm}mm ${insert.series}`

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
