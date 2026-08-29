import { INSERT_SPECS, SCREW_HEAD_SPECS, THREAD_SPECS } from "./catalogue"
import type {
  FastenerThread,
  FasteningMethod,
  InsertSpec,
  ScrewHead,
  ScrewHeadSpec,
  ThreadSpec,
} from "./types"

const listThreads = () => Object.keys(THREAD_SPECS).join(", ")

/**
 * Dimensions shared by every screw of a thread.
 *
 * An unknown thread is an error rather than a fallback to the nearest size: a
 * mount silently built for M3 when M3.5 was asked for looks correct in every
 * render and is discovered at assembly.
 */
export const getThreadSpec = (thread: FastenerThread): ThreadSpec => {
  const spec = THREAD_SPECS[thread]
  if (!spec) {
    throw new Error(
      `${thread} is not in the fastener catalogue. Available threads: ${listThreads()}`,
    )
  }
  return spec
}

/**
 * Head dimensions for one thread/head combination.
 *
 * A combination absent from the catalogue is one no vendor stocks -- button
 * heads below M3 today -- and is reported as such. Substituting a neighbouring
 * head style would change the recess geometry and the BOM line while still
 * rendering, which is the failure mode the vendor-backed catalogue exists to
 * prevent.
 */
export const getScrewHeadSpec = (
  thread: FastenerThread,
  head: ScrewHead,
): ScrewHeadSpec => {
  const byHead = getThreadSpec(thread) && SCREW_HEAD_SPECS[thread]
  const spec = byHead?.[head]
  if (!spec) {
    const available = Object.keys(byHead ?? {}).join(", ")
    throw new Error(
      `No stocked ${thread} screw with a ${head} head. Available head styles for ${thread}: ${available}`,
    )
  }
  return spec
}

/**
 * Inserts offered for a thread and method, longest first.
 *
 * The caller picks the longest one that fits the boss depth available, so a
 * shallow stack degrades to a shorter series rather than failing.
 */
export const getInsertOptions = (
  thread: FastenerThread,
  method: FasteningMethod,
): InsertSpec[] => {
  if (method === "self_tapping") return []
  const options = INSERT_SPECS[thread]?.filter(
    (insert) => insert.method === method,
  )
  if (!options?.length) {
    throw new Error(
      `No stocked ${thread} ${method.replace(/_/g, " ")} in the fastener catalogue`,
    )
  }
  return [...options].sort((a, b) => b.threadedLengthMm - a.threadedLengthMm)
}

/**
 * The longest insert whose installed length fits `availableBoreDepthMm`.
 *
 * Returns `undefined` when even the shortest does not fit, which the caller
 * turns into a design error naming the depth it had and the shortest insert it
 * could have used.
 */
export const selectInsert = ({
  thread,
  method,
  availableBoreDepthMm,
}: {
  thread: FastenerThread
  method: FasteningMethod
  availableBoreDepthMm: number
}): InsertSpec | undefined =>
  getInsertOptions(thread, method).find(
    (insert) => insert.lengthMm <= availableBoreDepthMm,
  )
