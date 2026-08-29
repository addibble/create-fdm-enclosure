import { expect, test } from "bun:test"
import { createFdmEnclosure } from "../lib"

const mountedBoard = (body: Record<string, unknown>) =>
  createFdmEnclosure({
    board: { width: 40, height: 24, thickness: 1.6 },
    mounts: [
      {
        id: "EN1.H1",
        fastens: "board",
        anchor: { x: -12, y: -6 },
        thread: "M3",
        fastening: "heat_set_insert",
        head: "socket_cap",
      },
    ],
    components: [
      { id: "C1", center: { x: -12, y: -6 }, boardSide: "bottom", body },
    ],
  }).designRuleViolations

/**
 * Most `cad_component` records today carry neither a body size nor a measured
 * height, so a part whose height defaulted to zero would be skipped as too
 * short to reach anything -- and the check would pass every board it was ever
 * given while appearing to work.
 */
test("a part standing on a boss with no measured height is reported as undecidable, not as clear", () => {
  const unmeasured = mountedBoard({ size: { x: 6, y: 6 } }).filter(
    (violation) => violation.rule === "component_bounds_unknown",
  )
  expect(unmeasured).toHaveLength(1)
  expect(unmeasured[0]!.componentId).toBe("C1")
  expect(unmeasured[0]!.severity).toBe("warning")

  // Given the height, the same part resolves to a definite answer instead.
  const measured = mountedBoard({ size: { x: 6, y: 6 }, aboveBoardHeight: 3 })
  expect(measured.filter((v) => v.rule === "component_bounds_unknown")).toEqual(
    [],
  )
  expect(measured.filter((v) => v.rule === "component_clearance")).toHaveLength(
    1,
  )
})
