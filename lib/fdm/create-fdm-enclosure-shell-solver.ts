import { BaseSolver } from "@tscircuit/solver-utils"
import type { GraphicsObject } from "graphics-debug"
import type { JscadOperation } from "jscad-planner"
import { visualizeFdmEnclosure } from "./visualize-fdm-enclosure"
import type { FdmEnclosureShellPlans, ResolvedFdmEnclosureInput } from "./types"

export class CreateFdmEnclosureShellSolver extends BaseSolver {
  shellPlans?: FdmEnclosureShellPlans

  constructor(
    private readonly params: { resolved: ResolvedFdmEnclosureInput },
  ) {
    super()
  }

  override _step(): void {
    const { dimensions, rules, frame } = this.params.resolved
    const {
      width,
      height,
      wallThickness,
      floorThickness,
      lidThickness,
      lidLipDepth,
    } = dimensions
    const insideWidth = width - 2 * wallThickness
    const insideHeight = height - 2 * wallThickness
    const baseHeight = frame.seamZ
    // The cavity floor is a real surface at exactly `floorThickness`, so only
    // the open top is over-cut. Offsetting the cut upward here would print a
    // floor thicker than requested and put the board below `frame.floorTopZ`.
    const innerCutHeight =
      baseHeight - floorThickness + rules.booleanTolerance * 2
    const basePlan: JscadOperation = {
      type: "subtract",
      shapes: [
        {
          type: "translate",
          vector: [0, 0, baseHeight / 2],
          shape: { type: "cuboid", size: [width, height, baseHeight] },
        },
        {
          type: "translate",
          vector: [0, 0, floorThickness + innerCutHeight / 2],
          shape: {
            type: "cuboid",
            size: [insideWidth, insideHeight, innerCutHeight],
          },
        },
      ],
    }
    const lidPlate: JscadOperation = {
      type: "translate",
      vector: [0, 0, frame.seamZ + lidThickness / 2],
      shape: { type: "cuboid", size: [width, height, lidThickness] },
    }
    // The lip is only clamped to the base cavity here. It is NOT checked
    // against the PCB or its components, so a `lidLipDepth` larger than the
    // available headroom will happily intersect them. Interference of this kind
    // is a clearance concern that belongs to enclosure/assembly DRC, which is
    // deferred until product occurrences and assembly state exist (see the
    // "Assembly checks are deferred" section of the parametric-enclosures RFC).
    // `lidLipDepth` is already the effective depth: `resolveFdmEnclosureProblem`
    // clamps it to the base cavity, so this stage must not clamp it again. Doing
    // so here once left the aperture projection using the authored value while
    // the shell printed a shorter lip.
    const lipDepth = lidLipDepth
    let lidPlan: JscadOperation = lidPlate
    if (lipDepth > 0) {
      const lipOuterWidth = insideWidth - rules.slidingFitClearance
      const lipOuterHeight = insideHeight - rules.slidingFitClearance
      const lipWallThickness = Math.min(
        wallThickness * rules.lipWallThicknessRatio,
        rules.lipWallThicknessMax,
      )
      const lipInnerWidth = lipOuterWidth - 2 * lipWallThickness
      const lipInnerHeight = lipOuterHeight - 2 * lipWallThickness
      const lipPlan: JscadOperation = {
        type: "subtract",
        shapes: [
          {
            type: "translate",
            vector: [0, 0, frame.seamZ - lipDepth / 2],
            shape: {
              type: "cuboid",
              size: [lipOuterWidth, lipOuterHeight, lipDepth],
            },
          },
          {
            type: "translate",
            vector: [0, 0, frame.seamZ - lipDepth / 2],
            shape: {
              type: "cuboid",
              size: [
                lipInnerWidth,
                lipInnerHeight,
                lipDepth + rules.booleanTolerance * 2,
              ],
            },
          },
        ],
      }
      lidPlan = {
        type: "union",
        shapes: [lidPlate, lipPlan],
      }
    }
    this.shellPlans = { basePlan, lidPlan }
    this.solved = true
  }

  override getOutput(): FdmEnclosureShellPlans {
    if (!this.shellPlans)
      throw new Error("Enclosure shell has not been created")
    return this.shellPlans
  }

  override getConstructorParams(): [typeof this.params] {
    return [this.params]
  }

  override visualize(): GraphicsObject {
    return visualizeFdmEnclosure({
      title: "Base and lid blanks",
      resolved: this.params.resolved,
    })
  }
}
