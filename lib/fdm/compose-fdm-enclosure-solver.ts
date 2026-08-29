import { BaseSolver } from "@tscircuit/solver-utils"
import type { GraphicsObject } from "graphics-debug"
import type { JscadOperation } from "jscad-planner"
import type { ResolvedEnclosureAperture } from "../enclosure"
import { createMountFeaturePlans } from "./create-mount-feature-plans"
import { visualizeFdmEnclosure } from "./visualize-fdm-enclosure"
import type {
  ComposedFdmEnclosurePlans,
  FdmEnclosureShellPlans,
  ResolvedFdmEnclosureInput,
} from "./types"

export class ComposeFdmEnclosureSolver extends BaseSolver {
  enclosurePlans?: ComposedFdmEnclosurePlans

  constructor(
    private readonly params: {
      resolved: ResolvedFdmEnclosureInput
      shellPlans: FdmEnclosureShellPlans
      apertureCutouts: ResolvedEnclosureAperture[]
    },
  ) {
    super()
  }

  override _step(): void {
    // Every aperture is subtracted from EVERY part, deliberately.
    //
    // A cut is projected inboard past the face it pierces (see
    // `inwardProjection`) so that features inside the enclosure cannot obstruct
    // the part -- and those features belong to the other shell: the lid lip sits
    // just inboard of the *base* side walls. Routing a cut to only the part
    // whose face it enters would leave the lip intact and block the connector.
    //
    // Over-subtracting is safe: inboard of the wall and lip there is only
    // cavity, so a cut that reaches a part it does not intersect is a no-op
    // against it.
    const cutouts = this.params.apertureCutouts.map(
      (cutout) => cutout.jscadPlan,
    )
    const { dimensions, frame, rules, mounts } = this.params.resolved
    const mountPlans = mounts.map((mount) =>
      createMountFeaturePlans({
        mount,
        rules,
        lidThicknessMm: dimensions.lidThickness,
        totalHeightMm: frame.totalHeight,
      }),
    )

    // Adds before subtracts, always: a boss that were unioned after its own bore
    // would fill the bore back in. Keeping the two lists separate is what makes
    // that ordering a property of composition rather than of every feature
    // builder remembering it.
    const build = (
      shell: JscadOperation,
      adds: JscadOperation[],
      subtracts: JscadOperation[],
    ): JscadOperation => {
      const solid: JscadOperation =
        adds.length === 0 ? shell : { type: "union", shapes: [shell, ...adds] }
      return subtracts.length === 0
        ? solid
        : { type: "subtract", shapes: [solid, ...subtracts] }
    }

    const basePlan = build(
      this.params.shellPlans.basePlan,
      mountPlans.flatMap((plan) => plan.baseAdds),
      // Apertures are subtracted after the bosses are fused, so an opening that
      // overlaps a boss removes the material in its way rather than being
      // covered by it. That is the right outcome -- the part has to fit -- but it
      // silently weakens the boss, and a boss/aperture collision check belongs
      // with the other placement rules once they exist.
      [...mountPlans.flatMap((plan) => plan.baseSubtracts), ...cutouts],
    )
    const lidPlan = build(
      this.params.shellPlans.lidPlan,
      mountPlans.flatMap((plan) => plan.lidAdds),
      [...mountPlans.flatMap((plan) => plan.lidSubtracts), ...cutouts],
    )
    this.enclosurePlans = {
      parts: [
        { id: "base", jscadPlan: basePlan },
        { id: "lid", jscadPlan: lidPlan },
      ],
      assembledPlan: {
        type: "union",
        shapes: [basePlan, lidPlan],
      },
    }
    this.solved = true
  }

  override getOutput(): ComposedFdmEnclosurePlans {
    if (!this.enclosurePlans) {
      throw new Error("Enclosure plan has not been composed")
    }
    return this.enclosurePlans
  }

  override getConstructorParams(): [typeof this.params] {
    return [this.params]
  }

  override visualize(): GraphicsObject {
    return visualizeFdmEnclosure({
      title: "Composed enclosure",
      resolved: this.params.resolved,
      processedApertureCount: this.params.apertureCutouts.length,
    })
  }
}
