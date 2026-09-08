import {
  fastenerThreadSchema,
  type FastenerThread,
} from "@tscircuit/modelprinter"

/** Validate without normalizing the authored designation or mutating the mount. */
export function assertEnclosureMountThread(mount: {
  thread: string
  id?: string
}): asserts mount is { thread: FastenerThread; id?: string } {
  if (!fastenerThreadSchema.safeParse(mount.thread).success) {
    throw new Error(
      `${mount.id ?? "mount"}: unknown assembly thread ${JSON.stringify(mount.thread)}. Expected one of: ${fastenerThreadSchema.options.join(", ")}`,
    )
  }
}
