# Feature: IFC-only upload (auto-converted to a viewable/AR-ready model)

> Part of [`features/`](README.md). Phase 2. Status: **built, and now
> verified with real interactions** (a real click, a real jump-to-room, a
> real category hide) against the real Duplex sample in `/local`, after a
> real bug in the first version was caught by the owner testing the live
> build — see "A second real bug" below — not just the earlier structural
> check (the exported file's node names existing and looking plausible),
> which had missed it. Still not yet exercised through a real live
> Supabase upload (no live credentials in this environment); functionally
> identical to the existing GLB upload path once the GLB exists, so the
> same live-tested upload/storage code path applies unchanged.

## Summary

Uploading a project no longer requires a separately-exported GLB/glTF
file. Given just an IFC file, the app builds a real, hostable 3D model
straight from the IFC's own geometry, in the browser, at upload time —
no external plugin or intermediate export step needed. The GLB field is
now optional; a model needs either a GLB, an IFC file, or both.

## User story

As an architect who wants to skip installing and running a separate
Revit-to-glTF export plugin for every project, I want to upload just the
IFC file (Revit's own native, plugin-free export) and have the app build
the 3D view and AR-ready file itself.

## Why this can't fully replace a real textured GLB

Real Revit materials (wood grain, brick, real glass) never survive into
an IFC file — confirmed directly: Autodesk's own IFC exporter doesn't
support material texture mapping because no BIM standard body has
defined how it should be represented, even though the underlying IFC4
schema theoretically has a slot for it. Revit's other native export
(FBX) has the identical gap. So an IFC-only upload is always flat-colored
geometry, same ceiling as an untextured GLB — real material realism still
needs the plugin/Twinmotion pipeline noted in
[`../roadmap/decisions.md`](../roadmap/decisions.md). This feature
removes a step (no exporter plugin needed) at that cost, and is meant as
the "just get something real up quickly" path, not a replacement for a
properly-textured export when that matters for a client presentation.

## Technical approach

**Why AR still needs a real GLB regardless**: `<model-viewer>`'s Scene
Viewer/Quick Look AR handoff was already confirmed (see
[`element-data-inspection.md`](element-data-inspection.md)) to require a
real, hosted glTF/USDZ file URL — it cannot hand off IFC directly. So
"skip the GLB" means *skip the human having to supply one*, not skip it
existing at all: this feature builds one automatically and uploads it to
the same storage bucket a manually-supplied GLB would go to, so every
downstream piece of the app (the on-screen viewer, "View in AR",
tap-to-inspect, category hide/show, levels/rooms jump-to) keeps working
completely unchanged — none of that code was touched.

**Geometry extraction** (`ifc/ifcToGlb.ts`): `web-ifc` (already a
dependency, previously only used for metadata) can also load real
geometry via `LoadAllGeometry()`/`GetGeometry()`, not just BIM data.
Verified directly against the real Duplex sample with a standalone Node
script before writing any app code:
- The vertex buffer interleaves position (3 floats) and normal (3
  floats) per vertex — confirmed by inspecting the actual first 12
  values of a real geometry's buffer, not assumed from convention alone.
- `flatTransformation` (a flat 16-number array per placed geometry) is
  column-major — confirmed by checking which index range holds a
  known-nonzero translation (indices 12–14, not 3/7/11) — exactly the
  layout `THREE.Matrix4.fromArray()` expects directly, no reordering
  needed.
- Each placed geometry carries its own flat RGBA `color` (0–1 range) —
  17 distinct real colors across the Duplex sample, not a uniform
  placeholder.

**Naming nodes so the rest of the app "just works"**: each generated
element gets a `THREE.Group` (for its geometry) whose *children* are the
actual `THREE.Mesh` instances (one per placed geometry) — both the group
and every mesh child are named with the element's IFC GlobalId, in the
**hyphenated-UUID form** (e.g. `9808fd7f-dc48-478e-9217-628e833d410f`),
via `ifcGuid.ts`'s `expandIfcGuid()`/`hyphenateUuid()`. See "A second
real bug" below for why it's this form and not the raw compressed one,
and why both the group *and* its mesh children need the name, not just
the group.

**Export**: the resulting `THREE.Group` scene is handed to
`three-stdlib`'s `GLTFExporter` (`parseAsync(..., { binary: true })`),
already an installed dependency via `three-stdlib` (used elsewhere for
`OrbitControls`). Produces a real `.glb` `Blob`, wrapped as a `File` and
uploaded through the exact same `uploadModelFile()` a manually-supplied
GLB goes through.

**Progress bar, not a spinner**: `LoadAllGeometry()`'s mesh list has a
real, known count up front, so conversion progress is reported as real
"N of total" numbers per mesh (`components/ConversionProgressBar.tsx`),
across three phases (reading the IFC file, building shapes, finishing
up) — not a fake indefinite spinner. Matters because a real building's
worth of geometry is a noticeably slower operation than parsing IFC for
metadata alone (which is all this app did with IFC before this feature).

## A real bug, found before shipping

`web-ifc`'s own `.d.ts` declares `FlatMesh.delete(): void`, and the
conversion loop called it to free WASM memory after each element (mirroring
the equally-real `IfcGeometry.delete()`, confirmed to genuinely exist).
Running the actual conversion against the real Duplex sample threw `s.delete
is not a function` (production, minified) and aborted immediately. Checked
directly: `Object.keys(flatMesh)` on a real `FlatMesh` returned by
`LoadAllGeometry()` is just `['geometries', 'expressID']` —
`typeof flatMesh.delete` is `'undefined'` at runtime, despite the type
declaration. The `.d.ts` doesn't match the real object. Fixed by simply not
calling it — `IfcGeometry.delete()` (a different type, from `GetGeometry()`)
is still called, since that one is real. Caught by testing against the real
Duplex file before ever shipping this, not assumed from the type
declarations.

## A second real bug, found by the owner testing the live build

Shipped with a real defect: tap-to-inspect, levels/rooms jump-to, and
category hide/show all silently did nothing on an IFC-only-uploaded
model, while the same features worked fine on a manually-supplied GLB.
Confirmed and diagnosed with temporary debug logging against the real
Duplex sample rather than guessing from the code, since the earlier
verification this session (capturing the generated GLB's node names and
confirming they were real GlobalIds) had checked *that a name existed*,
not *which form it was in* or *which object it was attached to* — both
turned out to be wrong:

1. **Wrong GlobalId form.** The original code named each group with the
   raw *compressed* IFC GlobalId (e.g. `2O2Fr$t4X7Zf8NOew3FK4F`, straight
   off `GetLine()`). But `ifcSpatialTree.ts`'s levels/rooms feature and
   `ifcCategories.ts`'s category feature both hand out identifiers via
   `ifcPropertyLookup.ts`'s `invertToHyphenatedGlobalIds()` — which
   deliberately only stores the **hyphenated-UUID** form (chosen
   originally to match IfcOpenShell's own glTF node-naming convention,
   see `ifcGuid.ts`). A compressed-form node name never matches a
   hyphenated-form target set, so `resolveNodeNameToExpressId()` came
   back "no match" for every element, every time — jump-to-room silently
   found nothing to frame, and hide-by-category silently hid nothing.
2. **Wrong object.** Only the wrapping `THREE.Group` was named, not its
   mesh children. A raycast click always hits the actual `THREE.Mesh`
   (`event.object` in `ModelViewer.tsx`'s `handleClick`), never its
   parent group — confirmed directly: a real click's `event.object.name`
   came back as GLTFLoader's own auto-generated `"mesh_18"`, while
   `event.object.parent?.name` had the correct GlobalId one level up.
   Tap-to-inspect read the wrong object's (empty) name and silently did
   nothing.

Fixed by converting to the hyphenated form in `ifcToGlb.ts` (reusing
`expandIfcGuid()`/`hyphenateUuid()`, with a fallback to the compressed
form for the rare malformed GlobalId that fails to expand — the same
defensive pattern `buildGlobalIdIndex()` already has), and setting that
same name on every mesh, not just its wrapping group. Re-verified against
the real Duplex sample after the fix: a real click now opens a real BIM
data panel (confirmed real property data, e.g. "Basic Wall:Exterior -
Brick on Block", `IfcWallStandardCase`, `LoadBearing: false`, etc.), a
real jump-to-room visibly reframes the camera, and unchecking "Walls"
visibly removes the walls from view.

**Standing lesson**: capturing a generated file's node *names* and
confirming they look like real identifiers isn't enough — also confirm
they're in the *specific form* and attached to the *specific object* the
consuming code actually expects, ideally by exercising the real
interaction (a real click, a real jump, a real hide) rather than just
inspecting the exported data structure.

## What was NOT changed

`ModelViewer.tsx`, `ARHandoff.tsx`, `useIfcElementData.ts`,
`ifcPropertyLookup.ts`, `LevelsPanel.tsx`, `CategoryPanel.tsx` — none of
these were touched. They all just consume a GLB URL + IFC URL exactly as
before; this feature only changes *where the GLB comes from*.

## Open questions

- **Not yet tested through a real Supabase upload** — this environment
  has no live Supabase credentials. The conversion + storage-upload code
  path is identical to the already-live-tested manual-GLB path once the
  GLB blob exists, but the owner should confirm a real end-to-end IFC-only
  upload once testing live.
- **Conversion time on a real, large building is unverified.** Only
  tested against the small/medium Duplex sample (224 elements, 728
  placed geometries, converts in well under a second in this
  environment). A real multi-story building could be meaningfully
  slower — the progress bar exists specifically because of this
  uncertainty, but no real large-file timing has been measured yet.
- Same open MEP/real-export caveats as the rest of this project's IFC
  handling — see [`category-and-discipline-visibility.md`](category-and-discipline-visibility.md)
  and [`../roadmap/decisions.md`](../roadmap/decisions.md).
