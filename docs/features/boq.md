# Feature: Quantity Takeoff (formerly "BOQ")

> Part of [`features/`](README.md). Phase 2/3. Status: **built** (2026-08-11).
> Replaces the earlier count-only Schedule panel outright — see
> [`search-and-schedule.md`](search-and-schedule.md) for that panel's own
> history, which this feature supersedes. Renamed from "Bill of
> Quantities (BOQ)" to "Quantity Takeoff" on 2026-08-11 (owner's own ask,
> after confirming the underlying data was finally working) — see the
> dated section near the bottom for the full scope of that pass. Internal
> file/component/route names (`BoqPanel`, `BoqView`, `ifcBoqDetails.ts`,
> the `/boq` URL segment, `openPanel === 'boq'`, …) were deliberately
> left as-is: renaming every identifier and the URL itself would have
> touched a disproportionate amount of the codebase and broken any
> already-shared `/boq` links, for a rename that's purely user-facing
> wording. Only strings actually shown on screen changed.

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

## 2026-08-11 (later) — Renamed to Quantity Takeoff; schedule-style redesign; formatted Excel export

Once the underlying data was confirmed working live (previous section),
the owner asked for a substantial follow-up pass, in their own words:
rename BOQ to "Quantity Takeoff"; add expand-all/collapse-all; make
every category "look as a detailed schedule" with its "own dedicated
table"; add a per-category toggle for whether it's broken down by level;
make the export mirror whatever that toggle is currently set to; and add
a properly formatted, color-coded, multi-sheet Excel export with a
company/project name header, "ready to present as client will be
reviewing that."

- **Renamed to "Quantity Takeoff" everywhere it's user-visible** — the
  corner button, both page titles, the passcode-gate submit label, the
  CSV file name, and the admin Models tab's link (shortened to just
  "Takeoff" there specifically, matching that link's existing
  `Preview`/`Edit`-length button convention rather than the full phrase).
  See the top-of-file note on what was deliberately *not* renamed
  (internal identifiers, the `/boq` URL) and why.

- **Every category is now its own dedicated schedule table**, titled
  "`<Category> Schedule`" (e.g. "Walls Schedule", "Beams Schedule") —
  the previous plain category name read more like a filter label than a
  real architectural schedule. Each table also gained a running "No."
  index column, matching the numbered-row convention a real Door/Wall
  schedule already uses.

- **Default display is now one flat table per category with its own
  Level column**, not the old always-grouped-by-level accordion. This
  is what a schedule normally looks like in practice (a "Door Schedule"
  lists every door with its own Level cell, it doesn't nest into
  per-level mini-tables) — and it satisfies "every element will have
  their dedicated table" more literally than the old nested accordion
  did. A new **per-category "Group by level" checkbox** (next to that
  category's own Locate button) switches to the old behavior instead —
  a bolded level-name band before each level's own rows, no Level
  column since it's now implied by the band. Only rendered when a
  category actually spans more than one level (`BoqCategoryGroup.levels
  .length > 1`) — a single-level category has nothing meaningful to
  toggle. State lives in a `Set<categoryKey>` in `BoqContent.tsx`
  (`groupByLevel`), keyed by the same `boqCategoryKey(discipline,
  category)` helper (moved into `utils/boqData.ts` so `BoqContent.tsx`
  and the new `utils/boqExcel.ts` share one definition instead of
  keying the same state two different ways by accident). The row
  markup itself (index/name/level/material/metrics/Locate/Debug, plus
  the on-demand debug expansion) was factored into a shared
  `ScheduleTable` component so the flat and grouped renderings never
  have to duplicate that markup.

- **Expand all / Collapse all** — two buttons in the toolbar that set
  (or clear) every discipline/category/level's own expand-state `Set`
  at once, computed from the full tree (`allKeys()` in
  `BoqContent.tsx`), not just whatever's currently visible under a
  search filter. Disabled only in the sense that they're a visual no-op
  while actively searching (search already force-expands everything —
  see the existing `searching || expanded...has(...)` pattern), same as
  every other toggle already behaves under search.

- **Export now mirrors the on-screen toggle state, not one fixed
  shape** — the owner's own ask: "whatever the final changes is seen
  after all those toggle for each element... the export will look
  same." The CSV export (`buildBoqCsv`) stays as it was: one flat row
  per element across the whole model, since CSV has no real way to
  express a level-grouping band anyway. The new **Excel export**
  (`utils/boqExcel.ts`) is where this actually shows: each category's
  worksheet is grouped-by-level or flat depending on that same
  `groupByLevel` state at the moment "Export Excel" was clicked, passed
  in as a `(categoryKey) => boolean` lookup rather than copied state.

- **New formatted, multi-sheet Excel export** (`utils/boqExcel.ts`,
  via [exceljs](https://github.com/exceljs/exceljs) — the only
  JS library in this ecosystem with real cell styling, fills, merged
  cells, and multi-sheet support that also has a browser build; SheetJS's
  free tier doesn't do styling at all). Structure:
  - A **Summary sheet** first: company/project/model/date title block,
    then every category's own count + totals in one table, each row
    tinted with its discipline's own accent color.
  - **One worksheet per category**, sheet name sanitized (Excel forbids
    `: \ / ? * [ ]` in a sheet name and caps it at 31 characters) and
    disambiguated against collisions after truncation
    (`sheetName()`). Each sheet repeats the same title block, a bold
    header row filled with that category's discipline color (frozen via
    `sheet.views`), alternating row banding, right-aligned number cells
    with real Excel number formats (`0.00`, `0.000` for volume — not
    just text), and a bold totals row (only for the metrics this app
    ever sums — see `SUMMABLE_METRICS`) with a top border.
  - **Discipline color coding**: Architecture (blue), Structure
    (terracotta/brown), MEP (teal) — used for each sheet's header fill,
    its Excel tab color, and the Summary sheet's row tint, so flipping
    between tabs gives the same "which discipline is this" cue a real
    drawing set's own color-coded sheets would.
  - **Company name** has no home in the `projects` table — adding one
    felt like overkill for a single cosmetic export label, so it's a
    plain text input on the Quantity Takeoff page itself
    (`localStorage`-backed, key `architect-ar:company-name`), remembered
    per-browser once typed in rather than requiring a DB migration.
  - **Lazy-loaded**: exceljs pulls in ~75 npm packages and produces a
    ~930 KB (256 KB gzipped) chunk on its own — a plain top-level
    `import` would have put that in every visitor's main bundle whether
    they ever export anything or not. `buildAndDownloadBoqExcel()` only
    ever does `await import('exceljs')` inside the click handler, so
    Vite splits it into its own chunk, fetched only when "Export Excel"
    is actually clicked (confirmed in the production build output:
    `exceljs.min-*.js` shows up as a separate chunk, not folded into
    `index-*.js`).
  - `buildBoqWorkbook()` is exported separately from
    `buildAndDownloadBoqExcel()` specifically so tests
    (`boqExcel.test.ts`) can inspect the resulting `ExcelJS.Workbook`
    object directly (cell values, sheet names, header contents) instead
    of having to intercept a `Blob` download through `URL
    .createObjectURL`.

## 2026-08-11 (later still) — Company branding comes from the dashboard, not a per-export text field

The owner's follow-up, verbatim: "I don't want a separate input for
company... it has to be the same company from my dashboard... also add a
permanent header of company branding on all the page of dashboard and
now and that same reflects on now page and Excel too." Read as: one
company name for the whole account, set once in the admin dashboard, not
typed per export — and shown as a real header, not just fed silently
into the Excel file.

- **New account-wide setting**: `admin_settings` (the existing singleton
  table backing the admin passcode and storage limit) gained a
  `company_name` column — see
  `web/supabase/migrations/011_company_branding.sql`, mirrored into
  `schema.sql` for fresh installs per this repo's existing convention
  (same pattern `full-admin-dashboard.md` documents for
  `storage_limit_bytes`). **Needs to be run once in the live Supabase
  SQL editor** before the branding bar or Excel export will show a real
  name instead of the "Architect AR" fallback — it wasn't auto-applied.
  Reading it (`get_company_name()`) is deliberately public, no passcode
  argument — unlike every other column on `admin_settings`
  (`passcode_hash`, `storage_limit_bytes`), a company name isn't
  sensitive, and the client-facing Quantity Takeoff page needs to show
  it without asking a visitor to unlock anything. Writing it
  (`admin_set_company_name`) is passcode-gated like every other
  `admin_*` write.
- **Removed** the local, per-browser "Company name" text field
  `BoqContent.tsx` grew in the previous pass (`localStorage`-backed) —
  that's exactly the "separate input" the owner didn't want.
  `BoqContent` now just takes `companyName` as a prop from whichever
  page renders it.
- **A permanent branding bar on every `/admin/*` page**
  (`pages/admin/AdminLayout.tsx`, new `AdminLayout.module.css`) — a
  sticky bar above the routed page content (`AdminLayout` wraps every
  admin route via `<Outlet/>`, which previously rendered no shared chrome
  at all; each page built its own `<h1>` independently). Click-to-edit
  in place (`CompanyBrandBar`) rather than a separate settings
  page/route: the bar already appears on every admin page, so it's also
  the most natural place to change the name, and one inline text field
  didn't seem to justify a whole new route.
- **Same branding on the client-facing Quantity Takeoff page**
  (`pages/BoqView.tsx`) and the in-viewer overlay
  (`components/BoqPanel.tsx`) — both read the same public
  `get_company_name()` RPC via a new `hooks/useCompanyName.ts` (a
  read-only counterpart to `AdminLayout`'s own read/write handling,
  since only the admin dashboard ever needs to change it). The 3D viewer
  page itself (`pages/ProjectView.tsx`) was deliberately left alone —
  it's a full-screen immersive viewer with floating corner buttons, not
  a page with a natural header slot, and the owner's own ask was
  specifically about the dashboard and the Quantity Takeoff page.
- **Excel export** (`utils/boqExcel.ts`) needed no changes at all here —
  it already took `companyName` as part of its `BoqExcelMeta`, sourced
  from whatever `BoqContent` was given. Only the *source* of that value
  changed, from a local text field to this shared setting.

## Open questions / known limitations

- **The Excel export is unverified in a real spreadsheet app** (2026-08-11)
  — built and unit-tested against the `ExcelJS.Workbook` object directly
  (cell values, sheet names, fills), which confirms the file is
  structurally correct, but no one has yet opened the actual downloaded
  `.xlsx` in real Excel/Google Sheets/Numbers to eyeball the formatting,
  colors, and column widths the way a client actually would. Worth a
  quick manual check before relying on it for a real client presentation.
- **Corrected root-cause fix, still pending a live retest (2026-08-11,
  later same day)**: the original 4-arg/3-arg fallback (previous
  paragraph) only ever tried the 3-arg call inside a `catch` block, on
  the assumption that a bad `includeTypeProperties`/`includeTypeMaterials`
  argument would throw. A per-row debug sample against a real wall
  (`143478`, already proven via tap-to-inspect to carry real Length/
  Width/Area/Material data) disproved that: the debug output showed zero
  property sets and zero materials found, with **no primary or fallback
  error at all** — proving the 4-arg call was resolving successfully with
  an empty array, not throwing. `getPropertySetsWithFallback()`/
  `getMaterialsPropertiesWithFallback()` in `ifc/ifcQuantities.ts` now
  fall back to the proven-working 3-arg call whenever the 4-arg call
  comes back empty, whether or not it threw. Covered by new unit tests
  (`ifcQuantities.test.ts`) for the "succeeds but empty" case
  specifically, not just the "throws" case already covered. **Confirmed
  fixed** (2026-08-11, live retest): wall `143478`'s row now shows real
  Length/Height/Area/Material values, and the whole model totals
  239 elements, 1,927.04 m² total area, 1,412.46 m³ total volume.
- **A "Debug info" disclosure was added to the BOQ page itself**
  (`BoqContent.tsx`, 2026-08-11) — a collapsed `<details>` block showing
  the very first element's own raw data: how many property sets were
  found, every property/quantity name actually seen in them (not just
  the ones this app recognizes), how many material definitions were
  found, and the raw error text from the 4-arg/3-arg fallback calls if
  either one failed. Built specifically because this session's own
  debugging hit a wall no local tooling could get through: this app's
  live deployment sits behind Vercel's preview-deployment SSO
  protection, and the owner is on a phone with no practical DevTools
  access — screenshots of tap-to-inspect were the only way to see real
  data at all. This makes the app self-diagnosing for that exact
  situation going forward, not just this one report.
- **Per-row debug, not just the first element (2026-08-11, same day)**
  — a live retest showed the top-level debug sample landing on a
  genuinely-sparse element (a furring wall with zero property sets, not
  a bug) while a *different*, already-proven-rich wall was still blank
  in the BOQ. The single "sample the first element" snapshot couldn't
  answer "why is *this* one still blank" for anyone but the very first
  row. Added a small "Debug" button on every element row
  (`ifc/useIfcElementData.ts`'s new `debugBoqElement(expressId, name)`,
  which reruns `getElementBoqData()` fresh for that one element) that
  expands the same debug fields inline, for whichever specific element
  someone is actually confused about. Originally an 🛈 icon glyph, but a
  real Android phone test the same day showed it rendering as a blank
  "tofu" box, so it was switched to a plain text label — matching this
  codebase's existing convention (`.locateButton`) of text over
  icon-only buttons. That same phone test also caught the button being
  effectively untappable (`padding: 0` on a small-font text button in a
  dense table row gives it a hit area no bigger than the text's own thin
  bounding box) — fixed with generous padding and a compensating
  negative margin so the tap target grows without visibly growing the
  row; the existing per-row Locate button had the identical risk and got
  the same fix for consistency. `toggleRowDebug()` also gained a
  try/catch around the fetch so a rejected `debugBoqElement()` call
  leaves the row showing "Could not load debug data for this element."
  instead of stuck on "Loading…" forever.
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
