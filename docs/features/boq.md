# Feature: Bill of Quantities (BOQ)

> Part of [`features/`](README.md). Phase 2/3. Status: **built** (2026-08-11).
> Replaces the earlier count-only Schedule panel outright — see
> [`search-and-schedule.md`](search-and-schedule.md) for that panel's own
> history, which this feature supersedes.

## Summary

A detailed, collapsible Bill of Quantities built straight from the same
IFC file already loaded for tap-to-inspect, levels/rooms, and categories —
no separate export, no separate upload. Every classified element gets its
own row: name, level, material(s), and whichever of length/width/height/
area/volume the source file actually recorded and are relevant to its
category (a wall shows area, a beam shows all four dimensions, a door
just shows a count — see the per-category display profiles below),
grouped Discipline → Category with collapsible headers at both levels, a
live search, category/element "Locate" buttons that isolate and frame
the camera, and a CSV export of every element as its own line (with
every detected dimension, regardless of which columns the on-screen
panel shows). Reachable two ways: the in-viewer "BOQ" corner button, or
a standalone page straight from the admin dashboard that never loads the
3D model at all.

## User story

As the architect, when I upload an IFC file that already has real BIM
data in it (materials, quantities, levels), I want the client-facing
viewer to show that off as a proper, detailed takeoff — not just a count
of how many walls there are — organized the way a real BOQ is organized
(by discipline, then by category), easy to scan with everything
collapsed, and easy to dig into or export when it isn't.

## What's built

**Grouped by level too, not just discipline/category (owner's ask, 2026-08-11)**
Each category now has a third tier underneath it: its own elements
broken down by level (e.g. "Walls: 57" → "Level 1: 30", "Level 2: 27"),
with the same collapsible-header, count-badge, and "Locate" pattern as
the discipline/category tiers above it. Levels sort by their actual
position in the building (bottom to top), not alphabetically — level
*names* like "T/FDN", "Level 1", "Roof" don't sort correctly as plain
strings, so `ifc/ifcBoqDetails.ts` now also records each element's
`levelIndex` (its level's position in the same bottom-to-top array
`ifc/ifcSpatialTree.ts` already produces for the Levels panel) alongside
its level name, and `utils/boqData.ts` sorts on that instead. An element
with no containing storey at all groups under "No level", sorted last.
The per-element table dropped its own "Level" column once level became
the group header instead — showing it twice would be redundant.

**A real gap in the quantity/material detection (owner's report, 2026-08-11)**
After the first version shipped, the owner's own structural model
showed almost nothing — most categories had no length/area/volume and
no material at all, only the Rooms category correctly showed its area.
Two real fixes went into `ifc/ifcQuantities.ts`:
- `getPropertySets()` is now called with `includeTypeProperties: true`
  (web-ifc's own 4th argument, previously omitted). Some exporters
  place a family/type's own quantities and parameters on the *type*
  object (`IfcElementType`, via `IfcRelDefinesByType`) rather than
  repeating them on every instance — e.g. a standard steel section's
  profile dimensions defined once on its type — and without this flag
  those never surfaced for any instance of that type.
- **A fallback to regular Pset properties**, not just proper `Qto_*`
  quantity sets. Not every exporter puts dimensional data in a quantity
  set at all — some carry a beam/column's own cross-section Width/Height
  as plain numeric *parameters* instead (a family's own "Width"/
  "Height", or engineering shorthand "b"/"h"). `getElementData()`
  already read these for tap-to-inspect; this module never had. Only a
  property whose name is already one of the known
  Length/Width/Height/Area/Volume names is ever treated as a quantity
  candidate this way — never a guess that some arbitrary numeric
  property is secretly a dimension.

**The actual root cause, found via a live retest (2026-08-11)** — the
owner tapped a real wall directly in the 3D viewer (tap-to-inspect, a
completely different code path from the BOQ) and its property panel
showed `Length`, `Width`, `Area`, `Volume`, and `Unconnected Height` all
present with real values. That proved the data genuinely exists and is
named exactly what this module already looks for — so the BOQ's own
extraction had a real bug, not a source-data gap. The likely cause:
`getElementData()` (tap-to-inspect) has always called
`getPropertySets(modelId, expressId, true)` — 3 args — and that call
demonstrably works; the BOQ's own 4-arg version (`includeTypeProperties`,
added above) was silently returning nothing, most likely because that
argument isn't safe against every build of web-ifc this app runs
against, and the existing `try`/`catch` swallowed whatever it threw
without a trace. Fixed by trying the fuller 4-arg call first (still
useful when it works) and falling back to the exact 3-arg call already
proven to work if it throws, for both `getPropertySets()` and
`getMaterialsProperties()`. Also added `Unconnected Height` — Revit's
own name for a wall's height parameter, not "Height" — to the known
height names, found from that same real property list.

**Per-category display profiles + Width/Height (owner's correction, 2026-08-11)**
The first version showed the same Length/Area/Volume columns for every
category, which the owner pointed out isn't how a real BOQ reads (a
door's volume is never useful; a wall's area matters far more than its
count). Two changes:
- **Width and Height are now their own detected dimensions**, not folded
  into "Length" — `ifc/ifcQuantities.ts` pulls them out of the Qto
  quantity set by name (IFC stores them as `IfcQuantityLength` too, just
  named `Width`/`Height` instead of `Length`), the same way Revit's own
  quantities work.
- **`utils/boqQuantityProfiles.ts`** maps each category to which
  quantities actually matter for it, and both the panel and the
  standalone page only show those columns: Walls → area/length/height,
  Beams/Columns → length/width/height/volume, Railings → length/height,
  Doors/Windows/Furniture/most MEP fittings → count only (no dimension
  columns at all), MEP runs (pipes/ducts/cabling) → length. An
  unrecognized category falls back to length/area/volume rather than
  showing nothing. Only length/area/volume are ever *totaled* into a
  category badge — summing "the total height of 20 doors" isn't a real
  quantity, matching how Revit's own schedules never total those either.
  The CSV export is unaffected by this — every detected dimension goes
  into the spreadsheet regardless of which columns the on-screen panel
  chose to hide for that category.

**A standalone page, not just the in-viewer panel (owner's correction, 2026-08-11)**
The admin Models tab's "BOQ" link originally deep-linked into
`pages/ProjectView.tsx` (the full 3D viewer) with the panel pre-opened.
The owner's actual ask: clicking it should go straight to the
quantities, without loading the 3D model at all. Now it opens
`pages/BoqView.tsx` at `/p/:projectId/boq?model=:modelId` — a page that
calls `useIfcElementData()` for the model's IFC data only (never
touches `modelUrl`/the GLB pipeline, so it's genuinely lighter to load,
not just visually simpler) and renders the BOQ immediately, no
open/close toggle needed since showing the BOQ is this page's entire
purpose. A "Open 3D viewer →" link goes the other way for anyone who
does want to see the model. The two entry points now share their actual
rendering: `components/BoqContent.tsx` holds the tree/search/CSV-export
logic, used by both the in-viewer `BoqPanel.tsx` (lazy-loads on open,
locate buttons isolate+frame the camera) and the standalone
`BoqView.tsx` (loads immediately, no locate buttons since there's no
viewer to frame anything in — `BoqContent`'s `onIsolate`/`onJumpTo`
props are optional for exactly this reason).

- **Two levels of collapsible headers.** Discipline (Architecture /
  Structure / MEP) at the top, Category (Walls, Doors, Windows, …)
  nested underneath — both collapsed by default so the panel opens calm
  regardless of how large the model is, not overwhelmed with every
  element visible at once.
- **Per-element detail**, once a category is expanded: name, level,
  material(s) (comma-joined if more than one), and length/area/volume —
  each shown as "—" rather than a misleading 0 when the source file
  never recorded that particular value for that element.
- **Per-category totals** as small badges on the category header itself
  (count, plus total area/volume if any element in it has them) — and a
  whole-model total at the top of the panel.
- **Search** across name, category, level, and material, live as you
  type. A category whose own name matches keeps every element in it
  (typing "doors" behaves like before); a category that matches only
  because some of its elements do gets narrowed down to just those
  (typing a material name like "oak" surfaces just the oak-faced doors).
  Matching sections auto-expand while a search is active, independent of
  whatever the user had manually expanded/collapsed.
- **"Locate"** on a category header isolates and frames every element in
  it (same isolate/jump mechanism Search and the old Schedule already
  used); a small target icon (⌖) on each element row does the same for
  just that one element — new, the old Schedule panel could only ever
  isolate a whole category at a time.
- **Export CSV** — every element as its own row (Discipline, Category,
  Name, Type, Level, Material, Length, Area, Volume), built client-side
  from the same data already on screen, same `Blob` + object-URL +
  hidden-`<a>`-click pattern the admin Analytics tab's CSV export uses
  (see [`full-admin-dashboard.md`](full-admin-dashboard.md)).
- **Reachable from the admin Models tab, not just from inside the
  viewer.** Each model row that has an IFC file gets its own "BOQ" link
  next to its existing "Preview" link (`AdminProjectModels.tsx`) —
  opens the standalone `/p/<id>/boq?model=<modelId>` page directly, not
  the 3D viewer. See the dated section below for how this link's target
  changed after the owner's own correction.
- **Lazy-loaded, cached, and paced.** Unlike levels/categories (computed
  automatically the moment a model finishes parsing), the BOQ's detail
  data is only actually fetched the first time the panel is opened — see
  Technical approach for why — and cached after that, so reopening it
  later in the same session is instant. A progress line ("Reading
  materials and quantities… 120 of 480 elements") shows while the first
  load is in flight.

## Technical approach

**Where the extra data comes from.** `ifc/ifcPropertyLookup.ts`'s
`getElementData()` (used for tap-to-inspect) already calls
`api.properties.getPropertySets(modelId, expressId, true)` per element,
but only ever reads each returned set's `HasProperties` (regular
`Pset_*` values) — `Qto_*` quantity sets come back in that very same
array, under `Quantities` instead, and were silently being dropped. A
new `ifc/ifcQuantities.ts` reads that field: an `IfcElementQuantity`'s
`Quantities` array holds `IfcQuantityLength`/`Area`/`Volume` objects,
told apart by which value field is actually present (`LengthValue`/
`AreaValue`/`VolumeValue`), since these are plain nested objects with no
`expressID` of their own to type-check via the usual
`GetNameFromTypeCode()` route the rest of this module uses. A model can
carry more than one quantity of the same kind (e.g. a wall's `Length`
vs. its `Perimeter`) — a small priority list per kind (e.g.
`NetSideArea` before `GrossSideArea` before a generic `Area`) picks the
one an architect doing a real takeoff would expect, falling back to
whichever was found first if none of the preferred names match.

**Materials** come from a different relationship entirely
(`IfcRelAssociatesMaterial`), fetched via web-ifc's own
`getMaterialsProperties()` helper. The returned shapes vary — a plain
`IfcMaterial` carries its own `Name`; anything layered
(`IfcMaterialLayerSet`/`-Usage`) or composite
(`IfcMaterialConstituentSet`, `IfcMaterialList`) nests the real
material(s) one or two levels down — so `collectMaterialNames()` walks
the handful of nesting keys real exporters actually use, never throwing:
a shape it doesn't recognize just contributes no name, not a broken row.

**Units.** Qto quantities are stored in whatever length unit the source
file itself declared — Revit's metric templates commonly use either
millimetres or metres, a US Imperial template exports in feet — so
showing them unconverted would be wrong for any file that isn't already
in metres. New `ifc/ifcUnits.ts`'s `getLengthUnitScaleToMeters()` reads
`IfcProject.UnitsInContext` once per model and resolves a single scale
factor to metres, handling both a plain (optionally prefixed) SI unit
and a conversion-based unit defined in terms of one (e.g. `FOOT` = 0.3048
× `METRE`). Falls back to 1 (assume already metres) if the unit
declaration can't be found or parsed, rather than failing the whole
panel over one unresolved unit.

**Why this isn't computed automatically like levels/categories are.**
Each element costs two extra WASM calls (`getPropertySets` +
`getMaterialsProperties`) on top of what parsing already does — fine for
a few hundred elements, real and visible time for a genuinely large
building. `ifc/ifcBoqDetails.ts`'s `buildBoqDetails()` is only ever
called from `useIfcElementData.ts`'s `getBoqDetails()`, itself only
called the first time `components/BoqPanel.tsx` actually opens (and
cached — a `useRef`-held promise, not React state, so a second call
mid-flight shares the same in-flight build instead of starting another
one). The bulk loop yields back to the main thread every 25 elements
(`await new Promise((resolve) => setTimeout(resolve, 0))`) — the same
pacing `ifc/ifcToGlb.ts`'s own per-element geometry loop uses — so the
tab stays responsive while this runs, unlike the single opaque
`LoadAllGeometry()` WASM call that pacing alone couldn't fix for IFC→GLB
conversion (see [`ifc-only-upload.md`](ifc-only-upload.md)): these are
many small property calls, not one call that can't be interrupted no
matter how it's paced, so yielding between them genuinely works here.

**Referential stability.** `getBoqDetails` is wrapped in `useCallback`
with an empty dependency array (it only ever touches refs, never
closed-over state) so `BoqPanel.tsx` can safely list it in its own
load-on-open effect's dependency array. Without this, a fresh function
identity on every render of the parent page would either need to be
left out of that array (an `exhaustive-deps` violation) or would re-fire
the effect on every unrelated re-render — the same "inline callback +
effect dependency + state update" shape that caused the camera-pivot
freeze regression documented in
[`levels-and-rooms-navigation.md`](levels-and-rooms-navigation.md),
fixed here the same way before it ever shipped.

**Level lookup.** Reuses `ifc/ifcSpatialTree.ts`'s existing
`getLevelsAndRooms()` output directly — a level's own `elementGlobalIds`
already includes every element on every room on that level (including
the room-with-no-own-elements fallback already documented there), so a
plain "which level's set contains this globalId" scan is enough; no
separate IFC query needed.

## Open questions / known limitations

- **Still pending a live retest**: the 4-arg/3-arg fallback fix above
  (see the dated section) is a strong, well-evidenced fix for the exact
  failure the owner's live retest surfaced, but hasn't been re-confirmed
  against their real project since shipping. Needs one more reload to
  close the loop.
- **Not verified against a real IFC file's actual unit declaration or
  material structure** — no live IFC sample is available in this
  session's sandbox. Both `ifcUnits.ts` and the material-extraction half
  of `ifcQuantities.ts` were built directly from the IFC4 schema's own
  definitions and covered with unit tests against constructed mock data,
  same "spec-first, flag as unverified" situation already documented for
  `ifcCategories.ts`'s MEP system-discipline detection. Needs a retest
  against a real export, ideally more than one (a Revit metric export
  and a US Imperial one, if available) to confirm the unit conversion in
  particular lands correctly.
- **Quantities and materials are exactly as complete as the source
  file's own export** — an IFC exported without Qto property sets (some
  non-Revit tools, or Revit exports with quantity export turned off)
  will show "—" for every length/area/volume; an element with no
  material association shows nothing in that column. This isn't a bug in
  this feature, but worth explaining to a client who asks why some rows
  look sparser than others.
- **The quantity-name priority lists are a reasonable default, not a
  configurable one.** If a real export's Qto naming turns out to
  disagree with what an architect actually wants surfaced (e.g. prefers
  `GrossFloorArea` over `NetFloorArea` for a specific category), there's
  no per-project override yet — would need real usage to know if this
  ever actually matters in practice.
- **Search and Locate share the same `hiddenGlobalIds` slot** the
  Categories panel and the Levels/Search panels already share — same
  "most-recently-changed action wins" tradeoff already documented in
  [`search-and-schedule.md`](search-and-schedule.md)'s Open questions,
  unchanged by this feature.
