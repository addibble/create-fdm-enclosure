import { BaseSolver } from "@tscircuit/solver-utils"
import type { GraphicsObject } from "graphics-debug"
import { visualizeFdmEnclosure } from "./visualize-fdm-enclosure"
import { resolveFdmEnclosureProblem } from "./resolve-fdm-enclosure-problem"
import type {
  CreateFdmEnclosureInput,
  ResolvedFdmEnclosureInput,
} from "./types"

/**
 * Pipeline stage wrapper around the pure `resolveFdmEnclosureProblem`. It keeps
 * resolution visible as a step in the solver debugger; the logic itself is a
 * plain function so a caller can pre-resolve a problem and replay it.
 */
export class ResolveFdmEnclosureProblemSolver extends BaseSolver {
  resolved?: ResolvedFdmEnclosureInput

  constructor(private readonly input: CreateFdmEnclosureInput) {
    super()
  }

  override _step(): void {
    this.resolved = resolveFdmEnclosureProblem(this.input)
    this.solved = true
  }

  override getOutput(): ResolvedFdmEnclosureInput {
    if (!this.resolved) {
      throw new Error("FDM enclosure problem is not resolved")
    }
    return this.resolved
  }

  override getConstructorParams(): [CreateFdmEnclosureInput] {
    return [this.input]
  }

  override visualize(): GraphicsObject {
    if (!this.resolved) return super.visualize()
    return visualizeFdmEnclosure({
      title: "Resolved FDM enclosure problem",
      resolved: this.resolved,
    })
  }
}
