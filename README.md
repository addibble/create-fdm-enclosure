# @tscircuit/create-fdm-enclosure

A staged solver that turns board dimensions and wall apertures into a two-part
FDM enclosure represented as serializable JSCAD plans.

Enclosure width, height, and depth are inferred from the board unless explicitly
supplied.

**Units.** This package is a solver, and its API takes plain `number`s already
resolved to millimetres. That is a boundary convention, not the authoring one:
the `@tscircuit/props` layer above types every dimension as `Distance`, so a
circuit author writes `"3.5mm"`, `"0.25in"` or a bare number, and core parses it
to millimetres before the solver ever sees it. Any dimension crossing into this
package should therefore already be a millimetre `number`; if you are adding an
*authoring* prop, it belongs in props and must be a `Distance`.

### Naming: faces

A face is named by the axis its outward normal points along:

| Face | Normal | Formerly |
| --- | --- | --- |
| `x_pos` | +X | `right` |
| `x_neg` | -X | `left` |
| `y_pos` | +Y | `front` |
| `y_neg` | -Y | `back` |
| `z_pos` | +Z, the lid's outward face | `top` |
| `z_neg` | -Z, the floor's | `bottom` |

Named directions (`left`, `top`, `above`, ...) stay in `insertion_direction`,
where `top` is +Y. Faces use the axis outright because an enclosure face can
plausibly be +/-Y or +/-Z, and `top` meant both at once: the old
`EnclosureFace.top` was **+Z**, while `insertion_direction`'s `from_top` is
**+Y**. `front`/`back` are retired ecosystem-wide -- see the coordinate-frame
RFC and `~/src/tscircuit/AGENTS.md`.

Core's `BoardWall` uses the same six names, so converting a board wall to an
enclosure face is an identity rather than a lookup table -- which is the point:
core once swapped the +Y and -Y walls there to compensate for a renderer bug,
and there is now nowhere for such a flip to hide.

`boardSide` is deliberately **not** renamed: it names the PCB layer a part is
mounted on, which is a Z-side concept, so it stays `"top"`/`"bottom"`.

### Naming: enclosure axes vs aperture axes

The enclosure's own `width`/`height`/`depth` are board-aligned X/Y/Z spans. An
aperture begins with the part instead: its footprint direction defines a
continuous interaction axis through the component rotation datum.

Aperture dimensions describe a tool around that axis. On a side opening,
`height` is board Z, `width` is perpendicular to the axis in the board plane,
and `depth` follows the axis inboard. On a lid or floor opening, width and height
rotate with the footprint and depth is vertical. A circle uses `radius` for its
profile. The enclosure face is the first wall intersected by the transformed
axis; it supplies the material plane, not the aperture's original orientation.

## Status

The geometry pipeline is implemented: box, base/lid split, lid lip, board
clearances, vertical stack, and declared cutout apertures. Mounting-stack
selection, screw bosses, inserts, fasteners, and mechanical BOM behavior remain
out of scope.

The package boundaries hold today:

- `lib/enclosure/`, `lib/assembly/`, and `lib/fdm/` exist, and the dependency
  direction is one-way — neither `lib/assembly/` nor `lib/enclosure/` imports
  from `lib/fdm/`.
- `resolveFdmEnclosureProblem()` is the single resolution pass; every pipeline
  stage reads only its output and none re-derives a default.
- Package tests cover pure resolution and generated geometry. Cross-package and
  end-to-end coverage lives in `core/tests/enclosure/`, including rendered
  alignment checks on all six faces.

One boundary violation was found and corrected during review:

- Aperture cut depth is now decided entirely in this package. Core reports a
  normalized `componentBody` envelope (a mechanical fact) and this package
  projects it onto the face normal (enclosure policy). This replaced an earlier
  `componentDepthHint`, in which core pre-computed the projection and so owned a
  policy decision that belongs here.

### Upstream progress (2026-08-03)

The `insertion_direction` half of this work has landed upstream and is
published, so it no longer needs a fork branch:

| Package | Published | Carries |
| --- | --- | --- |
| `circuit-json` | 0.0.461 | canonical `InsertionDirection`, Cartesian input spellings, `insertionDirectionToCanonical` |
| `props` | 0.0.606 | `FootprintInsertionDirection` widened to the input union |
| `circuit-json-util` | 0.0.103 | canonical names |
| `checks` | 0.0.151 | canonical names |
| `infer-cable-insertion-point` | 0.0.3 | explicit mating direction beats geometry guessing; canonical names |
| `core` | merged | the rename, plus the bottom-layer flip-axis fix below |

The enclosure branches (`source_fdm_enclosure`, `source_cutout_aperture`,
`cad_fdm_enclosure`, the authoring props, the core host elements, and the
renderer paths) have **not** merged, so a checkout using only published versions
still cannot run the end-to-end pipeline.

Two consequences for the rebase onto core `main`:

- The fork's own copy of the flip fix is superseded by the merged one. Take
  `main`'s implementation; keep the fork's stronger
  `footprint-insertion-direction-matches-pads.test.tsx`.
- Face and wall names move to the Cartesian vocabulary at the same time. See
  "Naming: faces" above, and map by axis, not by word.

## Required modified upstreams

The solver package itself builds and tests against published dependencies. The
end-to-end examples and Cosmos fixtures (the prefab board with seven connectors,
its core-emitted Circuit JSON, and the 3D previews) additionally require
coordinated changes that are **not yet released** by upstream tscircuit
packages. A checkout using only published versions is not sufficient to run the
full example pipeline; use these addibble-owned fork branches together as
sibling checkouts, linked with yalc (see `~/src/tscircuit/tsc-dev`):

| Repository branch | Required capability |
| --- | --- |
| [`addibble/circuit-json:feat/parametric-enclosures`](https://github.com/addibble/circuit-json/tree/feat/parametric-enclosures) | Typed enclosure Circuit JSON records: `source_fdm_enclosure`, `source_cutout_aperture` (with `width_dimension_offset`/`height_dimension_offset` and `depth`), `cad_fdm_enclosure`, and `source_assembly_device`. |
| [`addibble/props:feat/parametric-enclosures`](https://github.com/addibble/props/tree/feat/parametric-enclosures) | `enclosure.fdm.box`, `enclosure.cutoutaperture` (with `widthDimensionOffset`/`heightDimensionOffset` and `depth`), and `assembly.device` authoring props. |
| [`addibble/core:feat/parametric-enclosures`](https://github.com/addibble/core/tree/feat/parametric-enclosures) | `assembly.device` / `enclosure.fdm.box` / `enclosure.cutoutaperture` host elements, typed source-record emission, cutout wall/offset/tangent-Z resolution, isolated-subcircuit aperture inflation, and the end-to-end prefab-board fixtures (`core/tests/enclosure/`). |
| [`addibble/circuit-json-to-gltf:feat/parametric-enclosures`](https://github.com/addibble/circuit-json-to-gltf/tree/feat/parametric-enclosures) | Typed `cad_fdm_enclosure` rendering. The shared JSCAD-plan coordinate fix is already on upstream main. |
| [`addibble/infer-cable-insertion-point:fix/explicit-insertion-direction`](https://github.com/addibble/infer-cable-insertion-point/tree/fix/explicit-insertion-direction) | **Merged and published as 0.0.3** — no longer a fork requirement. Explicit connector mating direction takes precedence over silkscreen/geometry guessing. |
| [`addibble/3d-viewer:feat/parametric-enclosures`](https://github.com/addibble/3d-viewer/tree/feat/parametric-enclosures) | `cad_fdm_enclosure` render path for the direct viewer (`CadViewerJscad`, `CadViewerManifold`, and the headless SVG converter). |

Enclosure parts ship **only** as typed `cad_fdm_enclosure` records — no
synthetic `source_component`/`pcb_component`/`cad_component` triple. Any renderer
that should draw an enclosure therefore needs an explicit `cad_fdm_enclosure`
code path; both `circuit-json-to-gltf` and `3d-viewer` have one. The standalone `<model-viewer>` preview and PoppyGL snapshots render the
enclosure through `circuit-json-to-gltf`. Its AGENTS.md and this repository's
AGENTS.md document the canonical frame conversion and transform rules.

### How an aperture finds its wall

`insertionDirection` is a property of the **part**, authored on its footprint and
expressed in the footprint's own frame -- the same frame its pads are drawn in:

| Value | Footprint-local direction |
| --- | --- |
| `from_top` | +Y |
| `from_bottom` | -Y |
| `from_right` | +X |
| `from_left` | -X |
| `from_above` | +Z |
| `from_below` | -Z |

A part author is saying *"my cable enters from the +Y side of the footprint as I
drew it"*, and never has to think about the board. Placement supplies the rest:
core's `transformFootprintInsertionDirection` mirrors the local vector in X when
the part is on the bottom layer, rotates it by the component's `pcbRotation`,
and re-quantizes it to a board-frame name on `pcb_component.insertion_direction`.
So a footprint authored `from_top` reports `from_top` at 0 degrees and
`from_bottom` at 180.

The names are the canonical Circuit JSON values: `from_top` is +Y, `from_bottom`
is -Y, and `from_above`/`from_below` are the Z pair. The older `from_front` and
`from_back` are `@deprecated` -- still accepted as input and normalized on parse,
never emitted. They named +Y and -Y respectively, but read as if they described a
3D viewport rather than the board as drawn in the 2D PCB view, and different
packages resolved that ambiguity differently.

The same names therefore appear in two frames -- footprint-local as authored,
board-global as emitted -- which is easy to miss, because for an unrotated part
on the top layer the two coincide.

The emitted name gives the nearest Cartesian direction to the interaction axis.
Core passes it as an initial face together with the paired, continuous
board-space vector produced by the same transform. For a side opening, the
solver casts that vector from the component's rotation datum and chooses the
first enclosure wall the ray intersects. This matters near a corner: an
orientation-only rule switches walls at 45 degrees regardless of where the part
sits, while the physical axis changes walls exactly where it crosses the corner.
The emitted name breaks an exact corner tie and remains the final answer for
adapters that cannot supply the continuous vector.

**Unless the part says otherwise.** `cutoutApertureDirection` is a second
footprint property with the same vocabulary, the same frame, and the same
transform, naming where the part's *opening* faces rather than where a mating
part attaches. It is emitted as `pcb_component.cutout_aperture_direction`, and
axis selection prefers it:

1. `cutout_aperture_direction`, else
2. `insertion_direction`, else
3. proximity to the nearest board edge -- the only step that guesses.

For steps 1 and 2, the transformed continuous axis selects the first wall it
physically reaches as described above. Step 3 has no authored axis, so its
nearest-edge face is used directly and the cut remains square to that wall.

The two coincide for every connector, which is why the fallback is the common
case: a cable arrives through the opening it needs. They come apart on a part
that is not entered at all. A side-actuated switch is pressed into the board from
above and actuated sideways: `insertionDirection="from_above"` is the truth about
installation, and taking it as the aperture direction puts the opening in the lid
above a lever pointing at a wall. Declaring both is what places the opening in
the wall while leaving the installation fact intact for anything else that reads
it.

Both directions ride the same paired transform: its continuous vector orients
the physical axis, and `transformFootprintInsertionDirection` quantizes that
vector for the Circuit JSON name. A rotated or bottom-mounted part therefore
carries both facts around together. Deriving the angle from rotation or the face
from a second transform is how they came to disagree about the same part.

`from_above` and `from_below` are the exception: they name +Z and -Z rather than a
side, so the aperture exits through the lid or the floor. Which one is carried by
the direction itself, not by the mounting layer -- a layer flip is a 180 degree
rotation about the board's Y axis, so it inverts Z, and a footprint authored
`from_above` reports `from_below` once mounted on the bottom layer.

#### Orient from a paired reference transform

When two places in a codebase orient the same physical thing, they must be built
from the *same* transform, not from two statements of it. This package and core
learned that the expensive way: `transformFootprintInsertionDirection` re-derived
a footprint's placement by hand, disagreed with the matrix core actually applies
to the pads, and put bottom-layer apertures in the wrong wall (see below).

So before writing a transform, find the object that already moves the way yours
must, and compose from its expression:

```ts
// PrimitiveComponent._computePcbGlobalTransformBeforeLayout, isFlipped branch
compose(parentTransform, flipY(), this.computePcbPropsTransform())
```

Then cite it where you use it, so a reader can check the two agree without
re-deriving the geometry. Rotations and reflections do not commute, so a
re-statement that differs only in *order* is still wrong -- and wrong at only
some angles, which is what makes it survive review.

#### One vocabulary, everywhere

`from_top` is +Y in `core`, `circuit-json-util` and `checks`, and now also in
`infer-cable-insertion-point`, which had mapped the +Y name to the -Y side of a
part's bounds and so placed cable insertion points on the opposite wall from the
one core had chosen. `EnclosureFace` uses the Cartesian `y_pos` for the same
axis, deliberately: faces name axes, directions name sides.

Because the two disagreed, `cable_insertion_center` could not be used to check
the face: the inferrer derives it from `insertion_direction` when one is
present, so comparing them only re-measured the naming clash. The check that
does hold is geometric --
`core/tests/enclosure/prefab-board-cutout-alignment.test.ts` matches every
connector body to its cutout in world coordinates, and is what caught the
disagreement.

### Release order

Three waves, in this order: **data structures, then renderers, then
box-building**. Each wave depends on the previous being *released*, not merged,
because a consumer's manifest has to name a published version. Note that `^` on
a `0.0.x` version pins EXACTLY, so every bump here is an explicit edit.

**Wave 1 -- data structures.** Nothing can render or build until the record
types exist.

| # | Package | Carries |
| --- | --- | --- |
| 1 | `circuit-json` | `source_assembly_device`, `source_fdm_enclosure`, `source_cutout_aperture`, `cad_fdm_enclosure`, and `cad_component.model_bounds`. Tracked in [#649](https://github.com/tscircuit/circuit-json/pull/649); the current contract includes dimension offsets, `disable_cutouts`, one `cad_fdm_enclosure` per `enclosure_part`, and no durable display/translucency hint. |
| 2 | `props` | `enclosure.fdm.box`, `enclosure.cutoutaperture`, `assembly.device`, and `cadModel.modelBounds`. The `aperture*` rename keeps deprecated `width`/`height`/`radius` aliases, so this wave is **not** a breaking release. |

**Wave 2 -- renderers.** These consume wave 1 and are what makes an enclosure
visible at all.

| # | Package | Carries |
| --- | --- | --- |
| 3 | `circuit-json-to-gltf` | The `cad_fdm_enclosure` render path and the JSCAD-plan loader frame fix. **No published version has either** -- verified against the 0.0.111 tarball -- so until this ships, anything that renders an enclosure is relying on a local link. |
| 4 | `3d-viewer` | `cad_fdm_enclosure` path for the direct viewer (`CadViewerJscad`, `CadViewerManifold`, headless SVG). Without it the viewer shows the board and connectors but no enclosure. |
| -- | `infer-cable-insertion-point` | **Done -- published 0.0.3.** Independent of the waves, but core's aperture walls depend on its behavior. |

**Wave 3 -- box building.** The solver and its integration.

| # | Package | Carries | Depends on |
| --- | --- | --- | --- |
| 5 | `create-fdm-enclosure` | The solver. Its *API* needs neither wave -- it takes plain millimetre numbers -- but its preview tests render through `circuit-json-to-gltf`. The currently pinned `^0.0.113` predates the branch's enclosure render path; bump it only after wave 2 publishes. | 3 |
| 6 | `core` | Host elements, typed source emission, solver orchestration, Circuit JSON lowering. Bump `circuit-json`, `props`, `create-fdm-enclosure` and `circuit-json-to-gltf` to the versions the earlier waves published, and drop the local `overrides` entries. A clean checkout cannot compile against the currently pinned versions, which predate every new API. | 1, 2, 3, 5 |
| 7 | `eval`, `runframe`, `cli` | Nothing of their own. Core is inlined into eval's web worker, which is inlined into runframe's standalone bundle, so they must be rebuilt bottom-up even when unchanged. | 6 |

Until wave 2 ships, this repo and `core` are green locally only because the
renderer is yalc-linked; `package.json` stays clean, so the linkage is invisible
in a diff. Treat a green run here as provisional.

Deferred until after this sequence (see the parametric-enclosures RFC): a
physical-occurrence record for generated mounting hardware; aperture size derived
from the part's profile, which is now unblocked -- `cad_component.model_bounds`
carries the model's measured extent, so `componentBody` can report a true
`aboveBoardHeight` rather than an envelope that spans the pins (see "Input
coordinates" below); and DRC clearance rules between apertures and enclosure
features.

### Upstream defects found while integrating

None is caused by this work. All are recorded here so they can be raised against
upstream `core` and `circuit-json`. Each is tagged with its current upstream
status.

| Defect | Upstream status |
| --- | --- |
| The bottom-layer flip mirrored the wrong axis | **Fixed upstream** -- merged into `core` |
| `pcb_plated_hole` demands fields its schema defaults | **Unfixed upstream** -- not yet reported |
| `Length` is documented in meters | **Unfixed upstream** -- not yet reported |

#### The bottom-layer flip mirrored the wrong axis (fixed upstream)

`transformFootprintInsertionDirection` mirrored Y for a bottom-layer part, but a
layer change mirrors X. The rule was correct where it was borrowed from --
`circuit-json-util` applies it in response to `scale(1, -1)`, a genuine Y-mirror
-- but reusing it for a layer flip negates the wrong axis, and it was also
applied *after* the rotation instead of before. See
[How an aperture finds its wall](#how-an-aperture-finds-its-wall).

The two errors partly cancel, because a reflection and a rotation do not commute
(`F.R(t) = R(-t).F`): the net difference is a rotation by `2t + 180`, so the
result was exactly reversed at 0 and 180 degrees and exactly right at 90 and 270.
The obvious spot-check rotations are the ones that agreed, and a wrong answer is
still a valid direction name, so nothing threw.

This mattered here more than anywhere else: picking a face from
`insertion_direction` is unsafe until it is fixed, because every bottom-mounted
connector gets its opening in the wrong wall.

Fixed in core by composing the same matrix the pads use rather than restating it:

```ts
compose(rotate(theta), isFlipped ? flipY() : identity())
```

Merged upstream as part of the `insertion_direction` canonical-axes work. It
changed one pre-existing assertion, in
`footprint-insertion-direction-pcb-component.test.tsx`: `R3` (bottom layer, no
rotation, authored `from_top`) was recorded as `from_bottom` and is now
`from_top`, matching where its pads sit. The old assertion had locked in the bug.

#### `pcb_plated_hole` demands fields its schema defaults (unfixed upstream)

`hole_offset_x` and `hole_offset_y` are declared `distance.default(0)` in the zod schema but
non-optional in the exported `PcbPlatedHole` interface, so a literal that the
schema accepts fails to typecheck. `jscad-electronics` hits this today
(`lib/JSTZH1_5mm.tsx`).

The `expectTypesMatch` assertion does not catch it and is not wrong to pass:
`z.infer` is the *output* type, in which `.default()` has already been applied
and the field is genuinely always present. The gap is that the output type is
also what consumers use to *author* records, where the input type is the honest
one. The same split affects `pcb_board` dimensions, `pcb_via` diameters,
`cad_component` alignment, and `source_simple_pin_header.gender`; the fix is to
publish and document the input types (a `CircuitJsonInput` array type) rather
than to remove the defaults. None of the four enclosure records added by this
work uses `.default()`, so none of them is affected.

#### `Length` is documented in meters (unfixed upstream)

`src/units/index.ts` describes `Length` as
"Length in meters" while `parseAndConvertSiUnit` yields millimetres and every
consumer treats it as such. A one-line doc fix, but a load-bearing one: it is the
type every dimension in these records resolves to.

## Solver usage

`CreateFdmEnclosureSolver` is the primary API. Constructing the solver directly
lets an integrator expose its constructor parameters to the standard tscircuit
solver debugger before solving it.

```ts
import {
  CreateFdmEnclosureSolver,
  type CreateFdmEnclosureInput,
} from "@tscircuit/create-fdm-enclosure"

const input: CreateFdmEnclosureInput = {
  board: { width: 40, height: 24, thickness: 1.6 },
  apertures: [
    {
      shape: "pill",
      face: "y_pos",
      width: 9,
      height: 3.6,
      margin: 0.5,
      center: { x: 0, y: -12 },
    },
    {
      // A pushbutton stem exiting the lid, centered on the part.
      shape: "circle",
      face: "z_pos",
      radius: 1.9,
      margin: 0.3,
      center: { x: 8, y: -4 },
    },
  ],
}

const solver = new CreateFdmEnclosureSolver(input)
solver.solve()

if (solver.failed) {
  throw new Error(solver.error ?? "Failed to create FDM enclosure")
}

const enclosure = solver.getOutput()

console.log(enclosure.dimensions)
console.log(enclosure.jscadPlan)
```

Inside `tscircuit/core`, emit the standard event after construction and before
calling `solve()`. The debugger can recreate the solver from `solverParams` and
use `step()`, `visualize()`, and the pipeline stage metadata.

```ts
const solver = new CreateFdmEnclosureSolver(input)

this.root?.emit("solver:started", {
  type: "solver:started",
  solverName: solver.getSolverName(),
  solverParams: solver.getConstructorParams()[0],
  componentName: this.getString(),
})

solver.solve()
const enclosure = solver.getOutput()
```

For callers that do not need solver lifecycle access, `createFdmEnclosure(input)`
is available as a convenience wrapper.

## Input coordinates

Two frames are in play, and they do **not** share an origin.

**The solver's own frame**, which is what this package's inputs and outputs use:
the enclosure is centred on X/Y and its **outside floor** is at Z = 0, so the
whole box occupies positive Z. The board is *not* at Z = 0 here -- it sits at
`floorThickness + standoffHeight + boardThickness / 2`.

**Circuit world frame**, which is where core places the finished part: the
board's *centre plane* is Z = 0, so its bottom surface is at
`-boardThickness / 2`. Core translates the enclosure to
`z = -boardThickness / 2 - floorThickness - standoffHeight`
(`EnclosureFdmBox_doInitialEnclosureRender.ts`), which is exactly the offset that
lines the two frames up.

Aperture inputs are in **board coordinates relative to the board centre**, not in
either frame's Z. Faces are named `x_pos` (+X), `x_neg` (-X), `y_pos` (+Y),
`y_neg` (-Y), `z_pos` (the lid's outward face) and `z_neg` (the floor's).

A directed side aperture supplies a continuous board-space axis through
`center`, the component's rotation datum in board coordinates relative to the
board centre. The enclosure layer intersects that ray with the first cavity wall
it reaches. Without an authored direction, the nearest-edge fallback supplies a
face and the point is projected square to it.

`widthDimensionOffset` and `heightDimensionOffset` move the opening's **center**
across the face it pierces, along the same two axes its `width` and `height` are
measured in. Both may be negative.

Sharing a frame with the dimensions is the point. They replace an earlier
`zExtentAboveBoard`, which only made sense on the four walls: on the lid and the
floor an opening does not move in Z at all, so a "Z extent" had no meaning there.
These work on all six faces because the face already fixes which axes `width` and
`height` mean.

Zero means *wherever the part puts it*, which is usually right:

- **Side faces** centre the opening on the part's body above the board, taken
  from `componentBody.aboveBoardHeight` -- the model's measured bounds. An
  opening lines up with the connector it serves without anyone computing a
  height. A part with no measured bounds falls back to half the opening's own
  margin-inflated height, which rests its lower edge on the mounting surface.
- **Horizontal faces** centre on the part's own position, and both offsets turn
  with the part, exactly as the opening itself does.

`heightDimensionOffset` runs *outward* from the mounting surface on a side face:
up from the board top for a top-mounted part, down from the board bottom for a
bottom-mounted one (`boardSide`, default `"top"`). Like the default it shifts, it
describes the part rather than where the part was placed, so the same authored
number is correct on either side. A negative value pulls the opening back toward
and past the board -- needed when a cable jacket is fatter than the connector it
plugs into. The binding constraint is that the opening must not cut into the
enclosure floor.

Every aperture tool is subtracted from both printed parts. The tool's position
and depth decide which material it actually intersects: a lid-only tool misses
the base, a floor-only tool misses the lid, and a side opening crossing the seam
naturally splits across both.

`depth` is the opening's size along its component-relative interaction axis --
how deep the part is in the direction it occupies. The cut is projected that far
inboard, so nothing behind the wall -- the lid lip today, mounting bosses later
-- obstructs a part that reaches past it. For a horizontal face the primitive
already spans the plate; a derived inward projection begins at the plate's inner
surface rather than counting its thickness twice.

Because it is the face-normal dimension, what it cuts is whatever material lies
along that normal, which is generally *not* the face it entered. A large `z_pos`
opening in a corner is bounded in X and Y by `width` and
`height`, and its depth relieves the side walls it overlaps -- otherwise
the lid would open above a part while the wall stayed intact beside it.

The depth is rendered as authored, on every face. Nothing is capped to the
cavity, so a deep enough opening reaches the shell on the far side and cuts it
too. This is by design, to prevent or at least highlight accidental obstruction
of the connector and jacket path as described by the cutout aperture.

When `depth` is not authored, an integrating adapter may instead supply
`componentBody`, a normalized envelope of the part: its authored body `size` in
the part's own frame, the `rotation` it is placed at on the board, the board-frame
`footprint` it occupies, and how far it reaches above the board.

This package projects that envelope onto the **face normal** and uses the result
as the cut's depth, taking the footprint as a floor since pad fans and courtyards
can reach further inboard than the body itself. The projection is one scalar: it
sets how deep the opening travels, **not** how wide or tall it is. Those still
come from the aperture's own `width`/`height`/`radius`,
so a body wider than its aperture is not relieved. Full body-envelope clearance
-- subtracting the whole part from the shell so nothing fouls it -- is a
separate, and still unimplemented, concern.

For through-hole and side-entry components, `componentBody.size.z` is taller than
the part's reach above the board, because it spans the pins and shell hanging
below it too. `componentBody.aboveBoardHeight` is the honest number and is
preferred wherever it is present; `size.z` remains the fallback for parts whose
model was never measured. That fallback is a poor one: projection is not clamped
to the cavity, so an over-reported Z extent can drive a lid cut through the
floor. Measure the model, or authorise `depth` explicitly. Neither
sizes an opening.

The split is recoverable because `modelOriginPosition` is the point of the model
placed on the board surface and `modelBounds` is that model's measured extent in
the same frame, so

```text
aboveBoardHeight = modelBounds.max[normal] - modelOriginPosition[normal]
                 + zOffsetFromSurface
```

where `modelBoardNormalDirection` names the axis (default `z+`). `size` alone
cannot answer it: it carries the extent but not where the box sits relative to
the origin, and the box is generally not centered on it. Nor can
`zOffsetFromSurface`, which is a translation of the whole model rather than an
extent. Measured on the prefab PJ-320D: bounds `z ∈ [-3.1, 2.75]` against an
origin at `-2.550`, giving 5.30mm above the board and 0.55mm of locating peg
below, versus a `size.z` of 5.85mm.

`modelBounds` is cheap to supply: whatever generates a part file already measures
it to produce `size` -- the PJ-320D's authored `size` matches its mesh bounding
box to five decimals -- and previously discarded everything but the extent.

An **inferred** depth starts from the board stack:
`floorThickness + standoffHeight + board + topHeadroom + lidThickness`, and then
grows, if needed, until the lid and its lip clear every side-wall aperture.
Without that, the common case -- a connector taller than the default headroom --
puts the opening across the parting seam, so half the hole is cut in a lid that
slides on afterwards and no cable can enter it.

Whether apertures may inflate the depth turns on whether `topHeadroom` was
authored. Set explicitly, it is taken literally and apertures are ignored:
growing the box anyway would pin the lid underside to the tallest opening's top,
silently overriding the author's only lever on how tall the box is and making it
impossible for a part to poke through the lid on purpose. Left to default, there
is no intent to override and the useful default is a box that works.

Note what this does **not** promise: clearance over components. Only parts owning
an aperture report an envelope, so a tall capacitor with no opening is invisible
to the enclosure. `topHeadroom` is clearance above the *board*, not above the
tallest part.

An **explicit** `depth` is taken as authoritative. An opening may then straddle
the base/lid seam -- which is what lets one tall connector be cut from the base
wall, the lid plate and the lid lip together -- and may run past the top of the
enclosure so a part pokes out of a deliberately short box. Only an opening that
misses the enclosure altogether is rejected. Note that a part crossing the seam
means the lid can no longer lift straight off; that is an assembly check, not a
geometry one, and is deferred to enclosure/assembly DRC.

The default wall thickness is 2 mm, board clearance is 1 mm per side, and
top headroom is 6 mm. The default floor and lid are 2 mm thick, the PCB
standoff is 4 mm, and the friction-fit lid lip is 4 mm deep. An explicit outside
dimension is accepted only when it can still contain the board and its
configured clearances.

Input is resolved once, then constructed:

- `EnclosureMechanicalInput` contains process-independent box, board, and
  aperture geometry; `CreateFdmEnclosureInput` extends it with FDM box
  properties such as lid thickness, standoff height, top headroom, and lid-lip
  depth.
- `resolveFdmEnclosureProblem()` turns that request into a
  `ResolvedFdmEnclosureInput`: defaults applied, the aperture-placement
  fallback resolved, the request validated, and each aperture reduced to a
  decided wall/offset/centerZ/size placement. It also carries the resolved
  `FdmDesignRules` and `EnclosureAssemblyFrame` (floor, PCB, seam, and outside Z
  planes).
- Every pipeline stage reads only the resolved problem, so no construction step
  applies a default or re-derives a fallback.

Process constants live in `FdmDesignRules` and can be overridden per enclosure:

```ts
createFdmEnclosure({
  board: { width: 40, height: 24, thickness: 1.6 },
  fdmRules: { slidingFitClearance: 0.6, booleanTolerance: 0.25 },
})
```

The output includes separate `base` and `lid` plans plus a combined assembled
preview plan.

The Cosmos fixtures combine the standard tscircuit solver debugger with an
interactive GLB preview. Run them locally with `bun start`.
