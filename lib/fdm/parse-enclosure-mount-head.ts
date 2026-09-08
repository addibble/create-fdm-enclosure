import { screwHeadSchema } from "@tscircuit/modelprinter"
import type { EnclosureMountInput } from "../enclosure"

export const parseEnclosureMountHead = (
  mount: Pick<EnclosureMountInput, "id" | "head">,
) => {
  const result = screwHeadSchema.safeParse(mount.head ?? "socketcap")
  if (!result.success) {
    throw new Error(
      `${mount.id}: unknown screw head ${JSON.stringify(mount.head)}. Expected one of: ${screwHeadSchema.options.join(", ")}`,
    )
  }
  return result.data
}
