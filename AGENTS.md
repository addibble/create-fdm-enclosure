# AGENTS.md — @tscircuit/create-fdm-enclosure

A staged solver that turns board dimensions and wall apertures into a two-part
FDM enclosure, represented as serializable JSCAD plans. Read `README.md` for the
domain contract; this file covers the conventions an agent must follow.

## Commands

```bash
bun install
bun test                                # bun's runner
bun test ./tests/x.test.ts              # single file (name must contain ".test")
BUN_UPDATE_SNAPSHOTS=1 bun test ...     # update snapshots intentionally
bunx tsc --noEmit                       # typecheck
bun run format                          # biome (format:check in CI)
bun run build                           # tsup
bun run start                           # React Cosmos debugger
```

This package sits **below core** in the dependency order, so it must never
import from core. Cross-package and end-to-end fixtures that need a rendered
board live in `core/tests/enclosure/` instead.

## Units

The solver API takes plain `number`s already resolved to **millimetres**. That is
a boundary convention, not the authoring one: `@tscircuit/props` types every
authored dimension as `Distance`, so a user writes `"3.5mm"` or `"0.25in"` and
core parses it before this package sees it. A new *authoring* prop belongs in
props and must be a `Distance`; a new solver input is a millimetre `number`.

## Coordinate frames, side names, and transforms

This area has produced more defects than any other in this project. The rules
below are settled; they apply to code, prose, type names and test names.

### Canonical direction names

A direction names **where something is**, not which way it travels, and is
expressed in board space:

| Axis | Name | `insertion_direction` |
| --- | --- | --- |
| +X | `right` | `from_right` |
| −X | `left` | `from_left` |
| +Y | `top` | `from_top` |
| −Y | `bottom` | `from_bottom` |
| +Z | `above` | `from_above` |
| −Z | `below` | `from_below` |

There are **two** direction properties on a footprint, sharing this vocabulary,
this frame, and one transform: `insertionDirection` names where a mating part
attaches, `cutoutApertureDirection` names where the part's enclosure opening
faces. They coincide for connectors and differ for anything actuated rather than
entered -- a side-actuated switch is installed from above and actuated from the
side. Face selection prefers the aperture direction and falls back to the
insertion direction; see the README's "How an aperture finds its wall".

**`front` and `back` are retired.** They named opposite axes in different
packages — `3d-viewer`'s `Front` camera preset is −Y while `core`, `checks` and
`circuit-json-to-gltf` treated front as +Y — and both readings were defensible,
which is why the disagreement went undetected. They are `@deprecated` in
`circuit-json`: accepted as input, normalized on parse, never emitted.

### Faces are Cartesian

`EnclosureFace` (here) and `BoardWall` (core) are both:

```ts
"x_pos" | "x_neg" | "y_pos" | "y_neg" | "z_pos" | "z_neg"
```

Spelled `_pos`/`_neg` to match the published `InsertionDirectionCartesian`
(`from_x_pos`, …) and because Circuit JSON enum values must be snake_case, so one
spelling works on both sides of that boundary with no translation layer.

Because both vocabularies are identical, core's `getSolverWall` is a typed
identity rather than a lookup table — deliberately, since core once swapped the
+Y and −Y walls there to compensate for a renderer bug. With no table there is
nowhere for such a flip to reappear.

Faces avoid named directions because an enclosure face can plausibly be ±Y *or*
±Z, and `top` meant both at once: as an `EnclosureFace` it used to be **+Z**,
while `insertion_direction`'s `from_top` is **+Y**.

### Migrating older face names — migrate by axis, never by word

An older `EnclosureFace` used named sides, and two of those names change meaning
under the Cartesian scheme:

| old name | axis | new name |
| --- | --- | --- |
| `right` | +X | `x_pos` |
| `left` | −X | `x_neg` |
| `front` | +Y | `y_pos` |
| `back` | −Y | `y_neg` |
| `top` | **+Z** | `z_pos` |
| `bottom` | **−Z** | `z_neg` |

So `top → z_pos`, **not** `y_pos`. A mechanical rename that reads `top` as +Y
moves lid apertures onto a side wall — and because the geometry still resolves,
nothing throws and no test fails unless it happens to probe that face. After any
such change, check that `getFaceNormalAxis` and `getFaceNormalSign`
(`lib/enclosure/faces.ts`) agree with the intended face.

The `front`/`back` rows are equally treacherous in the other direction: `front`
is −Y in `3d-viewer`'s camera presets but +Y here, which is why the named forms
are retired ecosystem-wide. Convert from the axis, never from the word.

### `top`/`bottom` mean different axes depending on the owner

| Owner | `top` | `bottom` |
| --- | --- | --- |
| direction / `insertion_direction` | **+Y** | **−Y** |
| **PCB layer** (`layer`, `boardSide`) | **+Z** | **−Z** |

This is irreducible: PCB layers are named top/bottom industry-wide. `boardSide`
here is deliberately *not* renamed to a face name, because it names a layer. Any
symbol carrying either word across a boundary must say which it means.

**Renaming these is by axis, never by word.** A word-wise rename reads `top` as
+Y and moves lid apertures onto a side wall — and the geometry still resolves, so
nothing throws.

### Transforms

1. **Compose; never hand-roll a rotation matrix.** Use `transformation-matrix`
   with `compose()`/`applyToPoint()`.
2. **Orient from a paired reference transform.** When two places orient the same
   physical thing, build both from the *same* expression. Core's
   `transformFootprintInsertionDirection` re-derived a footprint's placement by
   hand, disagreed with the matrix applied to the pads, and put bottom-layer
   apertures in the wrong wall.
3. **Cite what you copied** — file, symbol and expression — so a reader can check
   agreement without re-deriving the geometry.
4. **Order is load-bearing.** `compose(a, b)` applies **b** first, and rotations
   and reflections do not commute (`F·R(θ) = R(−θ)·F`), so a re-statement that
   differs only in order is wrong at *some* angles only — which is exactly what
   lets it survive review.
5. **A layer flip is a rotation, not an inversion**: `flipY()`, i.e.
   `(x, y, z) → (−x, y, −z)`. Exactly two components invert; negating all three
   would be improper and would mirror the part.
6. **Fix compensations at the source.** Correct the frame; never add an
   offsetting flip downstream. A compensation is invisible once the bug it
   offsets is fixed, and then it becomes the bug.

### State the frame

Anything carrying geometry states, in its docstring: which frame, what the axes
mean, units, handedness and which way is up, and whether the value is a point
(picks up translation) or a direction (must not). Note this package uses **two**
frames that do not share an origin — see "Input coordinates" in `README.md`.

### Validate a convention before copying it

Match surrounding code only once you have confirmed it is intentional: find the
origin commit, the test that pins it, or a measurement. Conventions here have
repeatedly turned out to be bugs, or compensations for bugs elsewhere.

## Testing

- **Assert against emitted geometry, not a restatement of the transform.** A test
  that restates the implementation pins the implementation, bugs included.
- **Make fixtures discriminating.** A marker at `x = 0` cannot detect an X mirror,
  and 90°/270° rotations cannot distinguish a wrong mirror axis — there, right
  and wrong agree exactly. Cover 0°/180° *and* 90°/270°, on both layers.
- **Make sure the test can fail.** If two inputs normally agree, place the fixture
  where they disagree; otherwise the test passes no matter which one is used.
  Breaking the code deliberately and confirming the test goes red is cheap.
- **Never blind-rebaseline a snapshot.** Look at the image. A rebaseline here once
  silently disabled the very guard its test comment described. Snapshots are
  captioned (`tests/fixtures/caption-png.ts`) so a wrong render reads as wrong in
  a diff viewer rather than merely different. When a rename changes only labels,
  prove it: map the new labels back and diff against the old file.

## Conventions

- Use `bun`, never npm/yarn/pnpm.
- Kebab-case filenames; one test per file.
- Run `bun run format` (biome) before finishing.
- Never commit yalc `file:` links in `package.json`.
