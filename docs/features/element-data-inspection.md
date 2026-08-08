# Feature: element data inspection

> Part of [`features/`](README.md). Phase 1. Status: **built
> (`web/src/ifc/`), unverified end-to-end** — see the correlation caveat
> below before assuming this actually works.

## Summary

Tap or click any element in the viewer (a wall, a door, a fixture) and see
what Revit actually knows about it — family/type, level, material,
dimensions, and any other parameters that were set — without opening Revit.
This is what turns the tool from "a pretty render" into something a client,
contractor, or consultant can actually use.

## User story

As a client (or contractor, or consultant) viewing a shared model, I want
to tap any element and see its real specification, so that I don't have to
ask the architect or open the original CAD file for basic questions like
"what is this wall made of?"

## Requirements

- Works for Revit-sourced models in Phase 1. SketchUp/Rhino models render
  and support AR viewing but don't get a data panel yet — no equivalent
  data source has been evaluated for them (see Open questions).
- Tapping/clicking an element shows a panel with that element's available
  properties — not just a name, the actual property set.
- No visible network round-trip on tap — the lookup is instant because the
  data was already parsed client-side when the page loaded.
- Elements with no useful data (or that fail to parse) fail gracefully —
  no data panel crash, at minimum shows "no data available" rather than
  breaking the viewer.

## Technical approach

**Decided: IFC, not glTF `extras`.** Full reasoning in
[`../roadmap/architecture.md`](../roadmap/architecture.md#element-data-pipeline-ifc);
summary and feature-specific detail below.

- Revit exports to **IFC** (native, built-in, no plugin) alongside the
  glTF/GLB used for the viewer itself. IFC carries the full parameter set:
  family/type, level, materials, dimensions, quantities, classifications,
  shared/project parameters.
- **`web-ifc`** (WASM-based, client-side) parses the IFC file in the
  browser. Each mesh is tagged with its IFC "express ID."
- On tap/click (React Three Fiber raycasting — see
  [`../roadmap/architecture.md`](../roadmap/architecture.md#frontend-and-viewer-architecture)),
  look up that express ID against the parsed IFC's property sets
  (`IsDefinedBy` → `IfcPropertySet` relationships) and render them in a
  data panel.
- Why not glTF `extras`: would need a bespoke Revit export script (since
  standard exporters don't populate it), only carries whatever fields that
  script explicitly picked, and re-invents a worse version of a mapping IFC
  already provides for free.
- **Performance tradeoff to validate before Phase 1 ships**: IFC files can
  be large, and `web-ifc` parsing has a real cost on low-end devices —
  profile on an actual mid-range phone. If it's too slow, fall back to a
  server-side pre-process (IFC → a lighter JSON property index + glTF
  geometry) — this becomes a Phase 2 task if needed, not a Phase 1 blocker,
  per [`../roadmap/phases.md`](../roadmap/phases.md#phase-2--presentation-polish).

## Open questions

- **Correlation between the glTF scene and the IFC file — partially
  de-risked, not fully proven.** The glTF scene and the IFC file are two
  *separate* exports from Revit. To know which IFC element a clicked glTF
  mesh corresponds to, `viewer/ModelViewer.tsx` reads the clicked mesh's
  `.name` and resolves it against the IFC data via
  `ifc/ifcPropertyLookup.ts`'s `resolveNodeNameToExpressId()`. Tested this
  concretely (not just assumed) using a real Revit-exported IFC sample
  (buildingSMART's "Duplex Apartment" file) converted with IfcOpenShell's
  own open-source glTF exporter — and found IfcOpenShell names nodes using
  the **expanded UUID form** (`product-<uuid>-body`), not the compressed
  IFC GlobalId form `web-ifc` reads directly. Ported the exact
  compress/expand algorithm from IfcOpenShell's own reference
  implementation (`ifc/ifcGuid.ts`, verified against real data) and the
  resolver now handles both forms. See
  [`../history/sessions/2026-08-08-session-04.md`](../history/sessions/2026-08-08-session-04.md)
  for the full story. **Still open**: whether whatever exporter the owner
  actually ends up using (Revit's own built-in IFC/glTF export, or a
  plugin) follows either of these two conventions, or a third one — that
  needs a real test with the owner's real export pipeline. Tracked in
  [`../roadmap/decisions.md`](../roadmap/decisions.md).
- Is client-side IFC parsing fast enough on real mid-range phones? Not yet
  tested — tracked in [`../roadmap/decisions.md`](../roadmap/decisions.md).
- The `web-ifc` calls in `ifc/loadIfcModel.ts` and `ifc/ifcPropertyLookup.ts`
  have never been *run* against a real IFC file, but the method signatures
  and data shapes they rely on were verified directly against the
  installed package's `.d.ts` files and IFC schema (not just memory of the
  API) — see
  [`../history/sessions/2026-08-06-session-02.md`](../history/sessions/2026-08-06-session-02.md#addendum-verified-the-web-ifc-api-calls-against-the-installed-packages-own-source),
  which also caught and fixed a real WASM-path bug this way. Meaningfully
  lower risk than the correlation assumption above, but "never actually
  executed" still stands until a real file is tested.
- Should SketchUp/Rhino models eventually get an equivalent data panel
  (e.g. via SketchUp's classifications/dynamic attributes)? Not evaluated —
  Revit is the only source for this feature in Phase 1/2.
