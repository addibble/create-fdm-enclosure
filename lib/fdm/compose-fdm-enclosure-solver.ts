import { BaseSolver } from "@tscircuit/solver-utils"
import type { GraphicsObject } from "graphics-debug"
import type { JscadOperation } from "jscad-planner"
import type { ResolvedEnclosureAperture } from "../enclosure"
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
    const applyCutouts = (plan: JscadOperation): JscadOperation =>
      cutouts.length === 0
        ? plan
        : {
            type: "subtract",
            shapes: [plan, ...cutouts],
          }
    const basePlan = applyCutouts(this.params.shellPlans.basePlan)
    const lidPlan = applyCutouts(this.params.shellPlans.lidPlan)
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
