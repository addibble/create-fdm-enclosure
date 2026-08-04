import type { JscadOperation } from "jscad-planner"
import type { EnclosureAssemblyFrame } from "../assembly"
import type {
  EnclosureMechanicalInput,
  ResolvedEnclosureAperture,
  ResolvedEnclosureDimensions,
  ResolvedEnclosureInput,
} from "../enclosure"
import type { FdmDesignRules } from "./design-rules"

export interface CreateFdmEnclosureInput extends EnclosureMechanicalInput {
  /** Lid top-plate thickness. Defaults to wallThickness. */
  lidThickness?: number
  /** Gap between the inside floor and PCB bottom. Defaults to 4 mm. */
  standoffHeight?: number
  /**
   * Empty vertical space above the PCB top surface, not above the tallest
   * component -- only parts owning an aperture report a height at all.
   *
   * Omitted, the depth is inferred and grows to clear every side-wall aperture.
   * Given, it is taken literally and apertures do not affect the depth. Defaults
   * to 6 mm when nothing else forces the box taller.
   */
  topHeadroom?: number
  /** Depth of the friction-fit lip below the lid. Defaults to 4 mm. */
  lidLipDepth?: number
  /** Overrides for the FDM design-rule profile. */
  fdmRules?: Partial<FdmDesignRules>
}

export interface ResolvedFdmEnclosureDimensions
  extends ResolvedEnclosureDimensions {
  lidThickness: number
  standoffHeight: number
  topHeadroom: number
  lidLipDepth: number
}

/**
 * The fully-decided FDM enclosure problem. Produced once by
 * `resolveFdmEnclosureProblem`; every pipeline stage reads only from this, so
 * no stage re-applies a default, a fallback, or a validation rule.
 */
export interface ResolvedFdmEnclosureInput extends ResolvedEnclosureInput {
  construction: "fdm_box"
  dimensions: ResolvedFdmEnclosureDimensions
  rules: FdmDesignRules
  frame: EnclosureAssemblyFrame
}

export interface FdmEnclosurePart {
  id: "base" | "lid"
  jscadPlan: JscadOperation
}

/** Blank shells before aperture cutouts are applied. */
export interface FdmEnclosureShellPlans {
  basePlan: JscadOperation
  lidPlan: JscadOperation
}

export interface ComposedFdmEnclosurePlans {
  parts: FdmEnclosurePart[]
  assembledPlan: JscadOperation
}

export interface CreateFdmEnclosureOutput {
  dimensions: ResolvedFdmEnclosureDimensions
  frame: EnclosureAssemblyFrame
  parts: FdmEnclosurePart[]
  apertures: ResolvedEnclosureAperture[]
  jscadPlan: JscadOperation
}
