# Feature: category and discipline visibility

> Part of [`features/`](README.md). Phase 2. Status: **built
> (`ifc/ifcCategories.ts`, `components/CategoryPanel.tsx`,
> `viewer/ModelViewer.tsx`), the Architecture/Structure side verified
> against real data in an actual production build (a real
> production-only bug was found and fixed here — see the Addendum) — the
> MEP discipline-detection logic is NOT verified against any real MEP
> export (see Open questions, this is the one feature in this project
> shipped without that step, by explicit owner agreement).

## Summary

A "Show/hide categories" panel lists every category of element in the
model (Walls, Doors, Windows, Furniture, Columns, Pipes, Lighting, etc.),
grouped under its discipline (Architecture, Structure, MEP). Unchecking a
category hides every element in it from the 3D view — a client can look
at just the structure, or hide furniture to see the walls clearly behind
it, without needing the architect to prepare a separate stripped-down
model.

## User story

As a client or consultant, I want to hide categories of elements I don't
care about right now (furniture, MEP, finishes), so I can focus on the
part of the design that's actually relevant to the conversation I'm
having.

## Requirements

- Only appears when the loaded IFC file actually has classifiable
  elements in it — no empty panel for a model with no IFC file.
- Categories are grouped under their discipline (Architecture, Structure,
  MEP) with the discipline shown as a heading.
- Unchecking a category hides every element in that category; rechecking
  restores it. Nothing else on screen is affected.
- Only real, physical building-element categories appear — never internal
  IFC bookkeeping (property sets, relationships, type/style definitions,
  spatial containers like "Building" or "Site"). See Technical approach
  for why this needed an explicit fix.
- **Does not apply inside "View in AR"** — same underlying reason
  tap-to-inspect and the levels/rooms camera jump don't either: Scene
  Viewer/Quick Look re-fetch the original, complete, unmodified model
  file directly, with no way for the page to pass along which categories
  are currently hidden. Confirmed by reading `<model-viewer>`'s own
  Scene Viewer intent-building code, not assumed.

## Technical approach

**Classifying elements**: `ifc/ifcCategories.ts` maps each element's
concrete IFC type name (e.g. `IfcWallStandardCase`, `IfcPipeSegment` —
same mixed-case convention documented in `ifcSpatialTree.ts`) to a
discipline and a readable category label, via a flat lookup table rather
than walking IFC's class inheritance tree (web-ifc's untyped API, which
this whole `ifc/` module uses, doesn't expose "is this a subtype of X" at
runtime — only the concrete type per element). Covers common real-world
Architecture, Structure, and MEP-by-type element types; not exhaustive
against IFC's full schema.

**A real bug, found and fixed by testing against real data before
telling the owner to try it**: the first version classified *every*
GlobalId-bearing line in the file, including a fallback "Other" bucket
for anything unmapped. Running it against the real Duplex sample
surfaced categories like "PropertySet", "RelAggregates", and
"BuildingStorey" — none of which are physical elements at all. Cause:
`buildGlobalIdIndex` (`ifcPropertyLookup.ts`) indexes every line with a
GlobalId, which in IFC is nearly everything (`IfcRoot`, the base nearly
the whole schema inherits from, carries one) — property sets,
relationships, type/style definitions, and spatial containers all have
real GlobalIds despite having no geometry of their own. That's fine for
that index's original purpose (matching a *clicked glTF mesh* back to an
element, since meshes only ever exist for physical elements), but this
feature walks the *whole* index directly. Fixed by dropping the "Other"
fallback entirely — an unmapped type is now excluded from the panel
rather than shown as a meaningless category — and re-verified against the
real file: the panel now shows only genuine categories (Walls, Doors,
Windows, Floors & slabs, Roofs, Stairs, Rooms, Beams, Footings, etc. for
Duplex).

**Hiding elements**: `ModelViewer.tsx`'s `hiddenGlobalIds` prop, applied
in an effect that traverses the loaded Three.js scene and sets
`object.visible` based on whether `resolveNodeNameToExpressId()` (the
same tap-to-inspect/camera-focus resolution logic) matches the hidden
set — recomputed in full on every change rather than diffed, which is
simple and cheap enough at the element counts this app deals with.
Verified live against the real Duplex sample: unchecking "Walls" while
focused inside a room made the solid wall geometry disappear, revealing
window glass, railings, and door frames that had been hidden behind it.

**MEP sub-discipline detection (Plumbing / Fire / HVAC / Electrical /
...)**: an element's *type* alone doesn't say which discipline it
belongs to — an `IfcPipeSegment` could be plumbing, fire protection, or
heating depending on what system it's part of. Real disambiguation comes
from IFC's `IfcRelAssignsToGroup` relationship to an `IfcSystem` (usually
`IfcDistributionSystem`), read via that system's `PredefinedType`
(`FIREPROTECTION`, `AIRCONDITIONING`, `DOMESTICCOLDWATER`, etc. — mapped
to friendly labels in `ifcCategories.ts`). **The data shapes this relies
on were verified against the real Duplex file** (its `RelatingGroup`/
`RelatedObjects` fields really do come back as `{ value, type }` handles,
matching the code's assumptions) **but the actual system-assignment
relationship itself was not** — Duplex is a purely architectural sample
with zero `IfcRelAssignsToGroup` or `IfcSystem` entities in it at all, so
there was nothing to test the real discipline-detection logic against.
Owner's explicit decision (2026-08-09): ship this now, verify once a real
MEP-inclusive export is available, rather than wait.

## Addendum: a second real bug, this time production-only

The owner reported the "Show/hide categories" button missing entirely —
even on a brand-new test project, ruling out anything stale about an old
project. Reproduced it directly: built and served the actual production
bundle locally (`npm run build` + `npm run preview`), not just the dev
server, and hit the same empty panel. Root cause, confirmed by grepping
the built file itself: production minification renames `web-ifc`'s
dynamically-generated IFC entity classes (the built bundle contains
`class AS extends ...`, `class Aa extends ...`, etc.) — so
`line.constructor.name`, which this feature's classification relied on,
returned a meaningless mangled string in production instead of e.g.
`"IfcWallStandardCase"`. Every element silently failed to classify, with
no thrown error, since nothing ever matched the lookup table. Worked
perfectly under `npm run dev` the whole time because dev builds don't
minify, which is exactly why this wasn't caught earlier despite testing
"against real data" — the data was real, the *build mode* wasn't.

`ifc/ifcSpatialTree.ts` never had this problem, because it already reads
type names via `GetLineType()`/`GetNameFromTypeCode()` — driven by
`web-ifc`'s WASM module directly, not a JS class identifier, so it
survives minification untouched. That's exactly why "Levels" kept
working live while "Categories" silently didn't. Fixed by adding
`getLineTypeName()` (in `ifcPropertyLookup.ts`) using that same pair, and
switching every `.constructor.name` use in `ifcCategories.ts` — and in
`ifcPropertyLookup.ts`'s `getElementData()`, which had the identical
latent bug in its own `type` field, just not one that had broken
anything visibly yet — to use it instead. Verified against the real
*production build* this time (not the dev server) with the real Duplex
sample before shipping again.

**Standing lesson for this codebase**: don't trust `.constructor.name`
(or any reliance on JS identifier names) surviving a production build —
verify against `npm run build` + `npm run preview`, not just `npm run
dev`, for anything that depends on it.

## Open questions

- **The MEP discipline-detection logic is unverified against real MEP
  data.** If it doesn't work as expected against a real export, MEP
  elements will still show up (correctly grouped under "MEP" discipline,
  using the generic type-based category label like "Pipes" or "Ducts")
  but won't split further into Plumbing/Fire/HVAC/Electrical the way
  architecture/structure categories already do reliably. Test with a
  real Revit MEP export before relying on the sub-discipline split.
- The category type-name table is not exhaustive against IFC's full
  schema — a real export could contain a physical element type not in
  the lookup table, which would currently be silently excluded from the
  panel (safer than showing a bogus category, but means that element
  stays permanently visible/uncontrollable via this panel).
