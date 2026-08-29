import { parseAndConvertSiUnit } from "format-si-unit"
import type { JscadOperation } from "jscad-planner"
import { parseHardwareString } from "./hardware-dsl"
import { INSERT_SPECS, SCREW_HEAD_SPECS, THREAD_SPECS } from "./catalogue"
import type { FastenerThread, ScrewHead } from "./types"

/**
 * Turn a hardware string into a renderable solid.
 *
 * The mechanical counterpart of `getJscadModelForFootprint`, and the answer to
 * "a purchased part has no geometry": it is *generated* from the specification
 * rather than downloaded from a vendor, so it costs no network, no B-rep
 * tessellation and no licence, and it survives every boundary a serialized plan
 * survives.
 *
 * ## Frame
 *
 * Every model is built in its own frame with **+Z along the fastener axis** and
 * the origin at the part's **seating face** -- the underside of a screw head,
 * the end of an insert or spacer that meets its mating surface. The caller
 * translates it to the seat the resolver already computed, so no model needs to
 * know where in an enclosure it ended up.
 *
 * A screw therefore extends in **-Z** (down into the material) with its head in
 * +Z, which matches how every seat in `ResolvedFdmMount` is expressed.
 *
 * ## Fidelity
 *
 * Threads are not modelled. A helix costs a great many triangles to say
 * something the designation already says exactly, and nothing downstream
 * measures it. These are assembly and BOM visualizations, not thread-fit
 * simulations.
 */
const RESOLUTION = 24

const cylinder = ({
  diameterMm,
  bottomZ,
  topZ,
}: {
  diameterMm: number
  bottomZ: number
  topZ: number
}): JscadOperation => ({
  type: "translate",
  vector: [0, 0, (bottomZ + topZ) / 2],
  shape: {
    type: "cylinder",
    radius: diameterMm / 2,
    height: topZ - bottomZ,
    resolution: RESOLUTION,
  },
})

/**
 * Read a dimension out of a hardware string segment.
 *
 * Parsed with `parseAndConvertSiUnit`, not `Number`, so that the unit the
 * formatter wrote is understood -- and so that a hand-written `l0.5cm` resolves
 * to 5mm instead of becoming NaN or, worse under a `parseFloat`, 0.5.
 */
const number = (value: string | undefined, name: string): number => {
  const parsed = parseAndConvertSiUnit(value ?? null, "mm").value
  if (parsed == null || !Number.isFinite(parsed)) {
    throw new Error(
      `hardware string segment "${name}" needs a length, but got "${value ?? ""}"`,
    )
  }
  return parsed
}

const HEAD_BY_TOKEN: Record<string, ScrewHead> = {
  socketcap: "socket_cap",
  countersunk: "countersunk",
  pan: "pan",
  button: "button",
}

const buildScrew = (
  values: Map<string, string | undefined>,
): JscadOperation => {
  const thread = `M${values.get("m")}` as FastenerThread
  const threadSpec = THREAD_SPECS[thread]
  if (!threadSpec) throw new Error(`unknown thread "m${values.get("m")}"`)
  const headToken = [...values.keys()].find((key) => key in HEAD_BY_TOKEN)
  const head = HEAD_BY_TOKEN[headToken ?? "socketcap"]!
  const headSpec = SCREW_HEAD_SPECS[thread]?.[head]
  if (!headSpec) throw new Error(`no ${thread} screw with a ${head} head`)
  const designatedLengthMm = number(values.get("l"), "l")

  // A countersunk screw's designated length is measured overall, so the shank
  // below the head is shorter by the head. Same rule the length resolver uses --
  // stated once there, applied here so the drawn part matches the ordered one.
  const isOverall = head === "countersunk"
  const underHeadMm =
    designatedLengthMm - (isOverall ? headSpec.headHeightMm : 0)

  const shank = cylinder({
    diameterMm: threadSpec.nominalDiameterMm,
    bottomZ: -underHeadMm,
    topZ: 0,
  })

  if (head === "countersunk") {
    // A cone from the sharp diameter at the seating plane down to the shank,
    // built as the hull of two discs -- the plan vocabulary has no cone.
    return {
      type: "union",
      shapes: [
        shank,
        {
          type: "hull",
          shapes: [
            cylinder({
              diameterMm: headSpec.headDiameterMm,
              bottomZ: 0,
              topZ: 0.001,
            }),
            cylinder({
              diameterMm: threadSpec.nominalDiameterMm,
              bottomZ: -headSpec.headHeightMm,
              topZ: -headSpec.headHeightMm + 0.001,
            }),
          ],
        },
      ],
    }
  }

  return {
    type: "union",
    shapes: [
      shank,
      cylinder({
        diameterMm: headSpec.headDiameterMm,
        bottomZ: 0,
        topZ: headSpec.headHeightMm,
      }),
    ],
  }
}

const INSERT_METHOD_BY_TOKEN: Record<
  string,
  "heat_set_insert" | "press_fit_insert"
> = {
  heatset: "heat_set_insert",
  pressfit: "press_fit_insert",
}

const buildInsert = (
  values: Map<string, string | undefined>,
): JscadOperation => {
  const thread = `M${values.get("m")}` as FastenerThread
  const threadSpec = THREAD_SPECS[thread]
  if (!threadSpec) throw new Error(`unknown thread "m${values.get("m")}"`)
  const lengthMm = number(values.get("l"), "l")
  const methodToken = [...values.keys()].find(
    (key) => key in INSERT_METHOD_BY_TOKEN,
  )
  if (!methodToken) {
    throw new Error(
      `an insert string needs a method: ${Object.keys(INSERT_METHOD_BY_TOKEN).join(" or ")}`,
    )
  }
  const method = INSERT_METHOD_BY_TOKEN[methodToken]!

  // The outside diameter comes from the catalogue entry this string names, not
  // from a formula on the thread: an M4 heat-set insert installs into 5.6mm, and
  // `nominal + 1` would draw it 0.6mm undersize. Matched on method and length so
  // the drawn part is the series that was actually selected.
  const insert = INSERT_SPECS[thread]?.find(
    (candidate) =>
      candidate.method === method &&
      Math.abs(candidate.lengthMm - lengthMm) < 1e-6,
  )
  if (!insert) {
    throw new Error(
      `no ${thread} ${method.replace(/_/g, " ")} of ${lengthMm}mm in the catalogue`,
    )
  }

  return {
    type: "subtract",
    shapes: [
      cylinder({
        diameterMm: insert.installHoleDiameterMm,
        bottomZ: -lengthMm,
        topZ: 0,
      }),
      cylinder({
        diameterMm: threadSpec.nominalDiameterMm,
        bottomZ: -lengthMm - 0.1,
        topZ: 0.1,
      }),
    ],
  }
}

const buildSpacer = (
  values: Map<string, string | undefined>,
): JscadOperation => {
  const outerDiameterMm = number(values.get("od"), "od")
  const innerDiameterMm = number(values.get("id"), "id")
  const lengthMm = number(values.get("l"), "l")
  return {
    type: "subtract",
    shapes: [
      cylinder({ diameterMm: outerDiameterMm, bottomZ: -lengthMm, topZ: 0 }),
      cylinder({
        diameterMm: innerDiameterMm,
        bottomZ: -lengthMm - 0.1,
        topZ: 0.1,
      }),
    ],
  }
}

const BUILDERS: Record<
  string,
  (values: Map<string, string | undefined>) => JscadOperation
> = {
  screw: buildScrew,
  insert: buildInsert,
  spacer: buildSpacer,
}

export const getHardwareModel = (hardwareString: string): JscadOperation => {
  const segments = parseHardwareString(hardwareString)
  const family = segments[0]!.name
  const build = BUILDERS[family]
  if (!build) {
    throw new Error(
      `"${family}" is not a hardware family. Known families: ${Object.keys(BUILDERS).join(", ")}`,
    )
  }
  const values = new Map(
    segments.slice(1).map((segment) => [segment.name, segment.value]),
  )
  return build(values)
}

/** Exposed so a caller can check a family exists before asking for a model. */
export const getHardwareFamilies = (): string[] => Object.keys(BUILDERS)
