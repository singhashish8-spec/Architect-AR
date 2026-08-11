# Feature: Bill of Quantities (BOQ)

> Part of [`features/`](README.md). Phase 2/3. Status: **built** (2026-08-11).
> Replaces the earlier count-only Schedule panel outright — see
> [`search-and-schedule.md`](search-and-schedule.md) for that panel's own
> history, which this feature supersedes.

## Summary

A detailed, collapsible Bill of Quantities built straight from the same
IFC file already loaded for tap-to-inspect, levels/rooms, and categories —
no separate export, no separate upload. Every classified element gets its
own row: name, level, material(s), and length/area/volume where the
source file actually recorded them, grouped Discipline → Category with
collapsible headers at both levels, a live search, category/element
"Locate" buttons that isolate and frame the camera (reusing the exact
mechanism Search and the old Schedule panel already had), and a CSV
export of every element as its own line.

## User story

As the architect, when I upload an IFC file that already has real BIM
data in it (materials, quantities, levels), I want the client-facing
viewer to show that off as a proper, detailed takeoff — not just a count
of how many walls there are — organized the way a real BOQ is organized
(by discipline, then by category), easy to scan with everything
collapsed, and easy to dig into or export when it isn't.

## What's built

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
