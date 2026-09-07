import { expect, test } from "bun:test"
import { THREAD_SPECS } from "@tscircuit/jscad-assembly-hardware"
import { DEFAULT_FDM_DESIGN_RULES, resolveFdmInstallationPolicy } from "../lib"

test("moving pilot defaults to the FDM profile preserves every thread's bore", () => {
  for (const [thread, diameter] of [
    ["m2", 1.6],
    ["m2.5", 2.1],
    ["m3", 2.5],
    ["m4", 3.3],
    ["m5", 4.2],
  ] as const) {
    const installation = resolveFdmInstallationPolicy({
      mount: {
        id: "H1",
        fastens: "board",
        anchor: { x: 0, y: 0 },
        thread,
        fastening: "self_tapping",
        head: "socketcap",
      },
      rules: DEFAULT_FDM_DESIGN_RULES,
    })
    expect(installation.boreDiameterMm).toBe(diameter)
    expect(THREAD_SPECS[thread]).not.toHaveProperty("selfTapPilotMm")
  }
})
