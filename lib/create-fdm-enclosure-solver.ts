import {
  BasePipelineSolver,
  definePipelineStep,
  type PipelineStep,
} from "@tscircuit/solver-utils"
import type { GraphicsObject } from "graphics-debug"
import { ComposeFdmEnclosureSolver } from "./fdm/compose-fdm-enclosure-solver"
import { CreateFdmApertureCutoutsSolver } from "./fdm/create-fdm-aperture-cutouts-solver"
import { CreateFdmEnclosureShellSolver } from "./fdm/create-fdm-enclosure-shell-solver"
import { ResolveFdmEnclosureProblemSolver } from "./fdm/resolve-fdm-enclosure-problem-solver"
import type { CreateFdmEnclosureInput, CreateFdmEnclosureOutput } from "./types"
import { visualizeFdmEnclosure } from "./fdm/visualize-fdm-enclosure"

const requireStage = <T>(stage: T | undefined, name: string): T => {
  if (!stage) throw new Error(`${name} has not completed`)
  return stage
}

/**
 * Resolution happens once, in the first stage. Every later stage receives only
 * the `ResolvedFdmEnclosureInput` it produced, so no construction stage applies
 * a default, resolves a fallback, or re-runs a validation rule.
 */
export class CreateFdmEnclosureSolver extends BasePipelineSolver<CreateFdmEnclosureInput> {
  resolveFdmEnclosureProblemSolver?: ResolveFdmEnclosureProblemSolver
  createFdmEnclosureShellSolver?: CreateFdmEnclosureShellSolver
  createFdmApertureCutoutsSolver?: CreateFdmApertureCutoutsSolver
  composeFdmEnclosureSolver?: ComposeFdmEnclosureSolver

  private getResolvedProblem() {
    return requireStage(
      this.resolveFdmEnclosureProblemSolver,
      "resolveFdmEnclosureProblemSolver",
    ).getOutput()
  }

  override pipelineDef: PipelineStep<any>[] = [
    definePipelineStep(
      "resolveFdmEnclosureProblemSolver",
      ResolveFdmEnclosureProblemSolver,
      (pipeline: CreateFdmEnclosureSolver) => [pipeline.inputProblem],
    ),
    definePipelineStep(
      "createFdmEnclosureShellSolver",
      CreateFdmEnclosureShellSolver,
      (pipeline: CreateFdmEnclosureSolver) => [
        { resolved: pipeline.getResolvedProblem() },
      ],
    ),
    definePipelineStep(
      "createFdmApertureCutoutsSolver",
      CreateFdmApertureCutoutsSolver,
      (pipeline: CreateFdmEnclosureSolver) => [
        { resolved: pipeline.getResolvedProblem() },
      ],
    ),
    definePipelineStep(
      "composeFdmEnclosureSolver",
      ComposeFdmEnclosureSolver,
      (pipeline: CreateFdmEnclosureSolver) => [
        {
          resolved: pipeline.getResolvedProblem(),
          shellPlans: requireStage(
            pipeline.createFdmEnclosureShellSolver,
            "createFdmEnclosureShellSolver",
          ).getOutput(),
          apertureCutouts: requireStage(
            pipeline.createFdmApertureCutoutsSolver,
            "createFdmApertureCutoutsSolver",
          ).getOutput(),
        },
      ],
    ),
  ]

  override getConstructorParams(): [CreateFdmEnclosureInput] {
    return [this.inputProblem]
  }

  override getOutput(): CreateFdmEnclosureOutput {
    if (!this.solved) throw new Error("FDM enclosure solver has not completed")
    const resolved = this.getResolvedProblem()
    const composedPlans = requireStage(
      this.composeFdmEnclosureSolver,
      "composeFdmEnclosureSolver",
    ).getOutput()
    return {
      dimensions: resolved.dimensions,
      frame: resolved.frame,
      parts: composedPlans.parts,
      apertures: requireStage(
        this.createFdmApertureCutoutsSolver,
        "createFdmApertureCutoutsSolver",
      ).getOutput(),
      jscadPlan: composedPlans.assembledPlan,
    }
  }

  override initialVisualize(): GraphicsObject | null {
    return null
  }

  override finalVisualize(): GraphicsObject {
    const resolved = this.getResolvedProblem()
    return visualizeFdmEnclosure({
      title: "Final FDM enclosure",
      resolved,
      processedApertureCount: resolved.apertures.length,
    })
  }
}
