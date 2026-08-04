import { BaseSolver } from "@tscircuit/solver-utils"
import type { GraphicsObject } from "graphics-debug"
import { createApertureCutoutPlan } from "../apertures/create-aperture-cutout-plan"
import { getFdmFaceThickness } from "./get-fdm-face-thickness"
import type { ResolvedEnclosureAperture } from "../enclosure"
import { visualizeFdmEnclosure } from "./visualize-fdm-enclosure"
import type { ResolvedFdmEnclosureInput } from "./types"

export class CreateFdmApertureCutoutsSolver extends BaseSolver {
  apertureCutouts: ResolvedEnclosureAperture[] = []

  constructor(
    private readonly params: { resolved: ResolvedFdmEnclosureInput },
  ) {
    super()
    this.MAX_ITERATIONS = params.resolved.apertures.length + 1
  }

  override _step(): void {
    const apertures = this.params.resolved.apertures
    const placement = apertures[this.apertureCutouts.length]
    if (!placement) {
      this.solved = true
      return
    }

    this.apertureCutouts.push(
      createApertureCutoutPlan({
        placement,
        faceThickness: getFdmFaceThickness(
          placement.face,
          this.params.resolved.dimensions,
        ),
        booleanTolerance: this.params.resolved.rules.booleanTolerance,
      }),
    )
    if (this.apertureCutouts.length === apertures.length) this.solved = true
  }

  computeProgress(): number {
    const apertureCount = this.params.resolved.apertures.length
    if (apertureCount === 0) return this.solved ? 1 : 0
    return this.apertureCutouts.length / apertureCount
  }

  override getOutput(): ResolvedEnclosureAperture[] {
    return this.apertureCutouts
  }

  override getConstructorParams(): [typeof this.params] {
    return [this.params]
  }

  override visualize(): GraphicsObject {
    return visualizeFdmEnclosure({
      title: `Aperture cutouts (${this.apertureCutouts.length}/${this.params.resolved.apertures.length})`,
      resolved: this.params.resolved,
      processedApertureCount: this.apertureCutouts.length,
    })
  }
}
