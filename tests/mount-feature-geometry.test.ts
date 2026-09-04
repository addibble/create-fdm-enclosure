import { expect, test } from "bun:test"
import { createFdmEnclosure } from "../lib"
import type { JscadOperation } from "jscad-planner"

const board = { width: 40, height: 24, thickness: 1.6 }

/** Every node of a plan, flattened, so a test can look for one shape in it. */
const walk = (plan: JscadOperation): JscadOperation[] => {
  const node = plan as JscadOperation & {
    shapes?: JscadOperation[]
    shape?: JscadOperation
  }
  return [
    plan,
    ...(node.shapes ?? []).flatMap(walk),
    ...(node.shape ? walk(node.shape) : []),
  ]
}

const cylindersOf = (plan: JscadOperation) =>
  walk(plan)
    .filter(
      (node): node is JscadOperation & { type: "cylinder" } =>
        node.type === "cylinder",
    )
    .map((node) => ({
      radius: (node as { radius?: number }).radius,
      height: (node as { height?: number }).height,
    }))

test("a PCB boss is fused into the base and then bored, in that order", () => {
  const enclosure = createFdmEnclosure({
    board,
    mounts: [
      {
        id: "EN1.H1",
        fastens: "board",
        anchor: { x: -15, y: -8 },
        thread: "m3",
        fastening: "heat_set_insert",
        head: "socketcap",
      },
    ],
  })

  const base = enclosure.parts.find((part) => part.id === "base")!.jscadPlan
  // A boss unioned *after* its own bore would fill the bore back in, so the
  // ordering is the thing worth pinning: the subtract that carries the bore has
  // the union that carries the boss as its first operand.
  expect(base.type).toBe("subtract")
  const [solid, ...cuts] = (base as { shapes: JscadOperation[] }).shapes
  expect(solid!.type).toBe("union")
  expect(cylindersOf(solid!)).toContainEqual({ radius: 3.6, height: 4.5 })
  expect(cuts.flatMap(cylindersOf)).toContainEqual({ radius: 2, height: 4 })

  // The lid is untouched by a PCB mount: nothing passes through it.
  const lid = enclosure.parts.find((part) => part.id === "lid")!.jscadPlan
  expect(cylindersOf(lid)).toHaveLength(0)
})

test("a lid mount grows a column on the lid, then bores through both", () => {
  const enclosure = createFdmEnclosure({
    board,
    mounts: [
      {
        id: "EN1.H1",
        fastens: "lid",
        anchor: { x: -15, y: -8 },
        thread: "m3",
        fastening: "heat_set_insert",
        head: "countersunk",
      },
    ],
  })

  const lid = enclosure.parts.find((part) => part.id === "lid")!.jscadPlan
  expect(lid.type).toBe("subtract")
  const [solid, ...cuts] = (lid as { shapes: JscadOperation[] }).shapes

  // The lid is additive for the first time: the board-to-lid column hangs from
  // it. It cannot belong to the base -- a column standing up from the floor
  // would occupy the very hole the board has to be lowered over.
  expect(solid!.type).toBe("union")
  const column = cylindersOf(solid!)[0]!
  expect(column.radius).toBeCloseTo(3.6)
  // From the board's top surface up to the underside of the lid plate, plus the
  // boolean overlap into the plate.
  expect(column.height).toBeCloseTo(
    enclosure.frame.totalHeight -
      enclosure.dimensions.lidThickness -
      enclosure.frame.boardTopZ +
      0.5,
  )

  // One clearance hole for the whole run the screw makes through lid-side
  // material -- the plate and the column together, not one cut each.
  const clearanceHole = cuts.flatMap(cylindersOf)[0]!
  expect(clearanceHole.radius).toBeCloseTo(1.7)
  expect(clearanceHole.height).toBeCloseTo(
    enclosure.frame.totalHeight - enclosure.frame.boardTopZ + 1,
  )

  // The countersink is a hull of two coaxial discs -- there is no cone in the
  // plan vocabulary, and the hull of two discs is exactly the frustum between
  // them. Its top disc is the head diameter plus recess clearance, and it meets
  // the clearance hole 1.27mm down -- a 90 degree cone descends by the radius it
  // sheds -- so the head seats flush without a lip.
  const hulls = cuts.flatMap(walk).filter((node) => node.type === "hull")
  expect(hulls).toHaveLength(1)
  const hullDiscs = cylindersOf(hulls[0]!)
  // ISO 10642 M3 head is 5.54 across, plus 0.4 of recess clearance.
  expect(hullDiscs[0]!.radius).toBeCloseTo(2.97)
  expect(hullDiscs[1]!.radius).toBeCloseTo(1.7)
})
