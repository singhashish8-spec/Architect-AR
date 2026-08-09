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
