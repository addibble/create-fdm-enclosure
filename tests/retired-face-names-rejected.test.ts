import { expect, test } from "bun:test"
import { createFdmEnclosure } from "../lib"
import type { CreateFdmEnclosureInput } from "../lib"

const inputWithFace = (face: string): CreateFdmEnclosureInput =>
  ({
    board: { width: 40, height: 24, thickness: 1.6 },
    apertures: [
      {
        shape: "rect",
        face,
        width: 6,
        height: 4,
        center: { x: 0, y: 0 },
      },
    ],
  }) as unknown as CreateFdmEnclosureInput

// The retired names fail quietly if unchecked: the face helpers read the axis
// and sign straight off the name, so "top" yields axis "t" with a negative sign
// and the solver places a malformed side wall instead of throwing. Worse, "top"
// used to mean +Z, so a caller migrating by word rather than by axis would get
// a lid opening silently relocated to a wall.
test.each(["top", "bottom", "front", "back", "left", "right"])(
  "the retired face name %p is rejected",
  (face) => {
    expect(() => createFdmEnclosure(inputWithFace(face))).toThrow(
      /must be one of x_pos/,
    )
  },
)

test("the error says how to migrate", () => {
  expect(() => createFdmEnclosure(inputWithFace("top"))).toThrow(
    /old `top` \(\+Z\) is `z_pos`/,
  )
})

test("a Cartesian face is accepted", () => {
  expect(() => createFdmEnclosure(inputWithFace("z_pos"))).not.toThrow()
})
