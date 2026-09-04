import { expect, test } from "bun:test"
import { createFdmEnclosure } from "../lib"

/**
 * Apertures are subtracted after the bosses and lid columns are fused, so an
 * opening that overlaps one eats into it rather than being covered by it. The
 * part still fits, which is why this is a warning and not an error -- but the
 * column is left thinner than it was designed to be, and nothing in the
 * resulting solid says so.
 */
test("an aperture reaching into a lid column is reported with how deep it cuts", () => {
  const anchor = { x: -15, y: -8 }

  const enclosure = createFdmEnclosure({
    board: { width: 40, height: 24, thickness: 1.6 },
    mounts: [
      {
        id: "EN1.H1",
        fastens: "lid",
        anchor,
        thread: "m3",
        fastening: "heat_set_insert",
        head: "socketcap",
        // The column spans board-top to lid, which is exactly the band a
        // side-wall opening for a connector occupies.
        lidColumn: "printed",
      },
    ],
    apertures: [
      {
        shape: "rect",
        face: "x_neg",
        center: anchor,
        width: 8,
        height: 6,
        depth: 6,
      },
    ],
  })

  expect(enclosure.designRuleViolations).toHaveLength(1)
  const [collision] = enclosure.designRuleViolations
  expect(collision!.mountId).toBe("EN1.H1")
  expect(collision!.rule).toBe("insert_not_encircled")
  expect(collision!.face).toBe("x_neg")
  expect(collision!.apertureIndex).toBe(0)
  // The opening reaches past the column's axis, so nothing of the ring around
  // the bore survives: this column is severed rather than merely thinned, which
  // is why it is an error and not a warning.
  expect(collision!.severity).toBe("error")
  expect(collision!.measuredMm).toBeLessThanOrEqual(0)
  expect(collision!.message).toContain("EN1.H1")
})
