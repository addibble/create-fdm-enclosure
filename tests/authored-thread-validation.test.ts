import { expect, test } from "bun:test"
import {
  createFdmEnclosure,
  DEFAULT_FDM_DESIGN_RULES,
  getMountBoreDiameterMm,
  resolveFdmInstallationPolicy,
  type EnclosureMountInput,
} from "../lib"

test("thread strings are validated before sizing or catalogue access without normalization or fallback", () => {
  for (const thread of [
    "m6",
    "M3",
    " m3 ",
    "future_thread",
    "",
    "constructor",
  ]) {
    for (const fastening of ["self_tapping", "heat_set_insert"] as const) {
      for (const fastens of ["board", "lid"] as const) {
        const mount: EnclosureMountInput = {
          id: "EN1.H1",
          thread,
          fastening,
          fastens,
          anchor: { x: 0, y: 0 },
          ...(fastening === "self_tapping" ? { pilotDiameter: 2.5 } : {}),
        }
        const run = () =>
          createFdmEnclosure({
            board: { width: 40, height: 30, thickness: 1.6 },
            mounts: [mount],
          })
        expect(run).toThrow(
          `EN1.H1: unknown assembly thread ${JSON.stringify(thread)}`,
        )
        expect(mount.thread).toBe(thread)
        expect(() => getMountBoreDiameterMm(mount)).toThrow(
          "unknown assembly thread",
        )
        expect(() =>
          resolveFdmInstallationPolicy({
            mount,
            rules: DEFAULT_FDM_DESIGN_RULES,
          }),
        ).toThrow("EN1.H1: unknown assembly thread")
      }
    }
  }
})
