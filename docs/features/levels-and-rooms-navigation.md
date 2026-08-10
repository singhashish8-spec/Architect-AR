# Feature: levels and rooms navigation

> Part of [`features/`](README.md). Phase 2. Status: **built
> (`ifc/ifcSpatialTree.ts`, `viewer/ModelViewer.tsx`,
> `components/LevelsPanel.tsx`), verified against real data** — tested
> live in this session against the real Duplex sample (see Technical
> approach), not yet tested by the owner through the live app.

## Summary

A collapsible "Levels & rooms" panel lists every building storey (level)
in the model and, under each, its rooms (IFC spaces) — pulled from the
IFC file's own spatial structure, not guessed from element names. Tapping
a level or room name moves the camera to frame that part of the model,
instead of making the client hunt for it by hand with orbit/zoom.

## User story

As a client looking at a multi-level design, I want to jump straight to
"Level 2" or "Kitchen" from a list, so I don't have to manually rotate
and zoom around a whole building to find the room I actually want to
look at.

## Requirements

- Only appears when the loaded IFC file actually has levels in it — no
  empty panel/button for a model with no IFC file, or an IFC file with no
  spatial structure.
- Levels are listed in the order the IFC file defines them; each level
  shows its own rooms indented underneath.
- Tapping a level frames the camera around everything on that level.
  Tapping a room frames the camera around just that room's contents.
- Available both on the real project viewer (`pages/ProjectView.tsx`) and
  the local device-preview page (`pages/LocalPreview.tsx`) — anywhere
  tap-to-inspect already works, since both come from the same IFC parse.

## Technical approach

**Where the list comes from**: `web-ifc`'s `getSpatialStructure()` (used
via `ifc/ifcSpatialTree.ts`'s `getLevelsAndRooms()`) returns IFC's own
containment tree — `IfcProject → IfcSite → IfcBuilding →
IfcBuildingStorey → IfcSpace → elements`. Levels are `IfcBuildingStorey`
nodes; rooms are their direct `IfcSpace` children. **Verified against the
real Duplex sample by actually running it**, not assumed from
documentation — and that check caught a real bug before it shipped: the
type names on each returned node come back in normal mixed case
(`IfcBuildingStorey`, `IfcSpace`), not the all-uppercase form
(`IFCBUILDINGSTOREY`) the numeric type constants in web-ifc's own
`ifc-schema.d.ts` are *named* with. The first version of this code used
the uppercase form and silently found zero levels every time (no error —
just an empty, correctly-hidden panel). Confirmed the fix against the
real file too: it correctly lists the Duplex's two levels and each
level's real room numbers (A101–A105, B101–B105, etc.).

**"Jump to" a level or room**: a `IfcBuildingStorey`/`IfcSpace` node
itself usually has no mesh of its own in an exported glTF (spatial
containers aren't normally visible geometry) — so framing the camera on
the *room* means framing it on everything the room *contains* instead.
`getLevelsAndRooms()` walks each level/room's full descendant list,
resolves every contained element's GlobalId (via a new
`invertToHyphenatedGlobalIds()` in `ifc/ifcPropertyLookup.ts` — the
reverse of the map tap-to-inspect already builds), and hands that list of
GlobalIds to `ModelViewer`'s new imperative `focusOnGlobalIds()` method
(exposed via `forwardRef`/`useImperativeHandle`, called through a ref
from `ProjectView`/`LocalPreview`). That method traverses the loaded
Three.js scene, matches mesh names against the target GlobalIds using the
**same** `resolveNodeNameToExpressId()` tap-to-inspect already uses (so
it's exporter-convention-agnostic in exactly the same way), computes a
combined bounding box (`THREE.Box3`) over every matching mesh, and moves
the camera + `OrbitControls` target to frame it.

**Verified live, not just unit-tested**: loaded the real Duplex.glb +
Duplex.ifc pair through `/local` in a real browser (Playwright), opened
the panel, confirmed the real level/room names appear, clicked a room
("A102"), and confirmed the camera view visibly changed to frame that
room's actual geometry (wall corners, a door frame) rather than the
far-away default view.

## Addendum: a real scale-relativity bug, found via live testing

The owner tested this live (the panel and real level/room names showed up
correctly) and reported the camera didn't visibly move on tapping a room.
Cause: the camera-framing distance used a fixed `0.5`-unit floor meant
only to guard against a degenerate zero-size bounding box — but
`visualScale()` shrinks the *entire* model's geometry by the scale
preset's ratio, so at 1:100 (what the owner was actually testing with),
every real room's bounding box in scene units is already smaller than
0.5, meaning that floor silently dominated every jump and made them all
land at roughly the same distance regardless of which room was clicked.
Fixed by replacing the floor with a true near-zero epsilon
(`ModelViewer.tsx`). Verified live at 1:100 scale against the real Duplex
sample before calling it fixed: went from the whole building rendering
as a tiny speck (the *pre-jump* default framing is also quite far out at
that scale) to a fully framed, zoomed-in kitchen view — cabinets,
countertops, room detail all clearly visible — after clicking a room.

## Addendum 2: the *default* view, before ever using "jump to", also pivoted around the wrong point

A separate report (2026-08-09, after the admin dashboard redesign): the
owner clarified this wasn't about AR mode (already a confirmed hard
limit, see [`../roadmap/decisions.md`](../roadmap/decisions.md)) but the
in-app 3D preview itself — rotating felt like it was pivoting somewhere
other than the camera/what's on screen, like Twinmotion or Lumion don't.
Real bug, and a plain one once traced: `<OrbitControls>` in
`ModelViewer.tsx` was never given an explicit `target`, so it pivots
around its own default — world origin `(0, 0, 0)` — until something
explicitly moves it. `focusOnGlobalIds()` (this feature's own "jump to")
already did that correctly when used, which is exactly why it was never
caught earlier: as long as you'd clicked a level or room at least once,
rotation felt right afterward. A Revit-exported model is essentially
never centered exactly at the origin (real-world/shared-coordinates
survey points routinely put a building thousands of units away from it),
so *before* ever using "jump to," every rotation pivoted around empty
space nowhere near the visible building.

Fixed by auto-framing the whole model's bounding box the moment it
finishes loading (and again on switching to a different model within a
project) — factored the existing jump-to math out into a shared
`frameCameraOnBox()` helper so both paths move the camera *and* update
`controls.target` together, rather than only the jump-to path doing so.

**A real regression this introduced, caught immediately from an owner
report ("the preview mode screen is getting frozen")**: the new
auto-frame trigger needed to know when a *new* scene had actually
finished loading, not just when `modelUrl` changed (Suspense means the
new GLB isn't ready yet at that exact moment) — so it's driven by a
`sceneVersion` counter bumped from the same `onSceneReady` callback
`Model` already calls once its GLTF resolves. That callback was (and had
always been) written as a fresh inline arrow function on every render;
harmless before, since it only wrote to a ref. Once it also called
`setSceneVersion(...)`, the arrow function's fresh identity every render
kept re-firing `Model`'s effect (which lists it as a dependency), each
firing incremented the counter, each increment triggered another
render, which created another fresh arrow function — a genuine infinite
render loop, not just a wasted extra effect run. Fixed by wrapping it in
`useCallback` with no dependencies (a functional `setState` update, so
it doesn't need `sceneVersion` itself as a dependency either). Verified
against the real Duplex sample, not just typechecking: loaded the
model, confirmed the page kept responding to real clicks (opening the
Lighting panel) both immediately after load and several seconds later,
then confirmed rotating still kept the building centered in frame.

## Open questions

- **Not yet tested by the owner** through the live app — the check above
  was run in this session's own sandbox against the same real sample
  file already used to prove tap-to-inspect, but that's still not the
  same as the owner clicking through it themselves.
- Only picks up the hyphenated-UUID GlobalId form when matching meshes
  (see `invertToHyphenatedGlobalIds()`), matching the one real exporter
  convention verified so far (IfcOpenShell's). An exporter that names
  nodes only after the *compressed* GlobalId form, with no UUID substring
  anywhere in the name, would find zero elements for a room/level jump
  even though ordinary tap-to-inspect would still work for those same
  elements individually. Same category of not-yet-fully-verified
  exporter-convention risk already tracked for tap-to-inspect in
  [`element-data-inspection.md`](element-data-inspection.md) and
  [`../roadmap/decisions.md`](../roadmap/decisions.md).
- Camera framing distance is a fixed multiplier of the matched
  elements' bounding box size — reasonable in testing, but not tuned
  against a wide variety of room sizes/shapes yet.
