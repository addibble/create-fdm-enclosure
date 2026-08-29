import type { HeadRecess, ScrewHead } from "./types"

/**
 * Which recess a head style needs, when the author does not say.
 *
 * Derived rather than defaulted to one value, because the right answer differs
 * by head and getting it wrong is a joint failure, not a cosmetic one: a conical
 * head on a flat surface bears on its rim, so it neither seats nor clamps.
 *
 * A socket cap head defaults to sitting **proud**, not to a counterbore. A
 * counterbore is a legal thing to ask for and is often what you want on a thick
 * part, but an M3 cap head is 3mm tall and a printed lid is 2mm, so defaulting
 * to one would cut a recess straight through the lid of every box that did not
 * ask for it.
 */
const DEFAULT_HEAD_RECESS: Record<ScrewHead, HeadRecess> = {
  countersunk: "countersink",
  socket_cap: "none",
  pan: "none",
  button: "none",
}

/**
 * Resolve the recess cut into the part the head bears on.
 *
 * `hasMachinableSeat` is false on a PCB mount: the head bears on the board,
 * which the enclosure does not machine. There the recess is always `none`, and
 * an authored one is ignored rather than silently cut into the wrong part.
 */
export const getHeadRecess = ({
  head,
  authoredHeadRecess,
  hasMachinableSeat,
  label,
}: {
  head: ScrewHead
  authoredHeadRecess?: HeadRecess
  hasMachinableSeat: boolean
  label: string
}): HeadRecess => {
  if (!hasMachinableSeat) {
    // The head bears on the PCB, which the enclosure does not machine. Both
    // cases below used to resolve silently to "none", which meant a countersunk
    // board screw was accepted with its cone bearing on a flat board -- the very
    // thing the countersunk rule further down exists to forbid.
    if (head === "countersunk") {
      throw new Error(
        `${label}: a countersunk head cannot seat on a board mount -- the head bears on the PCB, which the enclosure does not machine, so the cone would bear on its rim. Use head="socket_cap", "pan" or "button", or fasten the lid instead.`,
      )
    }
    if (authoredHeadRecess && authoredHeadRecess !== "none") {
      throw new Error(
        `${label}: headRecess="${authoredHeadRecess}" has nothing to cut on a board mount -- the head bears on the PCB, not on a part the enclosure makes`,
      )
    }
    return "none"
  }
  const recess = authoredHeadRecess ?? DEFAULT_HEAD_RECESS[head]
  if (head === "countersunk" && recess !== "countersink") {
    throw new Error(
      `${label}: a countersunk head requires headRecess="countersink", but "${recess}" was given: a conical head bears on its rim on a flat surface, so it neither seats nor clamps`,
    )
  }
  return recess
}
