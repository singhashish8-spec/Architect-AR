# Roadmap — architecture

> Part of [`roadmap/`](README.md). Covers *why web-first* and the full
> recommended technical architecture. For the literal tech stack/tooling
> pinned from this, see
> [`engineering/tech-stack.md`](../engineering/tech-stack.md). For
> feature-level detail on the two most involved pieces, see
> [`features/element-data-inspection.md`](../features/element-data-inspection.md)
> and
> [`features/model-scale-presets.md`](../features/model-scale-presets.md).

## Why web-first, not native-first

This project's sibling repo, **Budget Tracker**, is the reference for *how*
this team builds apps (Vite + React frontend, wrapped natively via
Capacitor) — but it made one decision that Architect AR should deliberately
**reverse**:

| | Budget Tracker | Architect AR |
|---|---|---|
| Data sensitivity | SMS reads, biometrics, financial history — stays on-device on purpose | A design render — meant to be shared |
| Distribution | Installed APK, Play Store | A link, opened by someone who may never install anything |
| Why hosting a live shell was rejected there | A remotely-loaded page with a bridge to SMS/biometrics bypasses Play Store review of what the app does at runtime | N/A — no sensitive device bridge here |
| Right call | Bundle assets into the APK, ship updates through the store | **Host it live.** A client should never be asked to install an app just to see a design. |

So Architect AR Phase 1 is **a hosted website**, not an APK. Native wrapping
(Capacitor, matching the Budget Tracker pattern) comes back in Phase 4, once
there's a reason that requires it (on-site camera-overlay AR, offline site
visits) — not as the starting point.

## Frontend and viewer architecture

- **React + Vite** — same toolchain as Budget Tracker, so conventions and
  tooling knowledge transfer directly.
- **Two viewer surfaces, not one**, because element-data inspection and
  mobile AR handoff have different technical requirements:
  - **`<model-viewer>`** (Google's web component, built on Three.js) for the
    "view in AR on your phone" path: loads glTF/GLB, ships a built-in
    "View in AR" button that hands off to **Scene Viewer** (Android) and
    **Quick Look** (iOS) — real AR, zero app install, zero native AR code
    on our side. This is a black box we don't get to add custom click
    handlers into, which is fine — its job is the AR handoff, not data
    inspection.
  - **React Three Fiber (Three.js) + `web-ifc`** for the desktop/mobile-
    browser "inspect the model" path: renders the IFC-derived geometry
    ourselves, so we control raycasting/picking — tap or click any element,
    look up its IFC id, show its property sets in a side panel. This is
    also the base to build on for Phase 3's measurement/annotation tools,
    since that needs the same picking infrastructure.
  - Both surfaces read from the same source model — a client sees the R3F
    inspector by default and can drop into `<model-viewer>`'s AR mode with
    one tap.

## Model export pipeline

Confirmed: export → import, not a live plugin/sync integration.

- Source tools (Revit, SketchUp, Rhino) export to **glTF/GLB** (preferred —
  open, web-native) with **USDZ** generated alongside for the Quick Look/iOS
  path specifically (`<model-viewer>` can auto-generate this, or it's
  exported directly from Rhino/SketchUp where supported).
- Revit additionally exports to **IFC** (native, built into Revit — "Export
  > IFC") as the source for element data — see
  [`element-data-inspection.md`](../features/element-data-inspection.md).
  SketchUp/Rhino don't carry Revit-style parameter data in the same way, so
  the data-inspection feature is Revit-sourced models first; SketchUp/Rhino
  models still get full geometry + AR viewing, just without a rich property
  panel until/unless there's a similar data source to key off (e.g.
  SketchUp's classifications/dynamic attributes — a later evaluation, not
  Phase 1/2).
- No plugin or direct-integration work in Phase 1 — this is the fastest
  path to a working v1 and needs no cooperation from Autodesk/Trimble/
  McNeel APIs. Direct exporters/plugins are a Phase 5 option, not a
  prerequisite.

## Hosting and storage

- **Static hosting**: Vercel, Netlify, or Cloudflare Pages — any support
  the Vite build output directly; pick based on which the owner already has
  an account with.
- **Model file storage**: object storage with a public/signed URL per
  model (Cloudflare R2, Supabase Storage, or Firebase Storage — glTF/GLB
  files for architectural interiors can run tens to hundreds of MB, so
  storage cost and CDN delivery matter more than for a typical web app).
- **Project metadata** (project name, which model file, which client, link
  expiry): a small serverless backend or a BaaS (Supabase is a reasonable
  default — Postgres + storage + auth in one place, generous free tier).
  This is intentionally the *only* backend in Phase 1 — no custom server to
  operate.

## Sharing model

Needs a decision before Phase 1 ships. Two options, not mutually exclusive
long-term:
- **Unlisted link, no login** — fastest to build, matches "just send a
  link"; anyone with the link can view.
- **Per-client access** (simple passcode or magic-link) — slightly more
  build effort, needed if designs are confidential and links might be
  forwarded.

Recommendation: ship unlisted links for Phase 1 (fastest to a working demo),
add optional passcode-per-project in Phase 2 once real client feedback
exists.

## Element data pipeline (IFC)

The requirement: tap an element in the viewer, see what Revit knows about
it. Plain glTF/GLB export strips Revit's parameter data down to geometry
and materials — there's nothing left to show. Two options were weighed;
**IFC was chosen** over hand-rolling custom data into glTF's `extras` field.
Full detail, including the tradeoffs and the reasoning against `extras`, is
in [`features/element-data-inspection.md`](../features/element-data-inspection.md).

Summary:
- **Revit exports to IFC** (its native, built-in open BIM export — no
  plugin needed) alongside the glTF/GLB export. IFC carries the full
  parameter set: family/type, level, materials, dimensions, quantities,
  classifications, and any shared/project parameters that were set.
- **`web-ifc`** parses the IFC file directly in the browser and hands
  geometry to Three.js/React Three Fiber, with each mesh tagged by its IFC
  "express ID."
- On tap/click, look up that express ID against the parsed IFC's property
  sets and render them in a data panel — no backend query needed.

## Model scale presets

Every model gets a scale assigned **once, at import time**, by the
architect uploading it — not a free continuous dial for the client. Full
detail, including the preset table and how it's enforced per surface, is in
[`features/model-scale-presets.md`](../features/model-scale-presets.md).

Summary: the preset list follows standard architectural/engineering drawing
scale convention (ISO 5455 / RIBA: 1:1, 1:5, 1:10, 1:20, 1:50, 1:100, 1:200,
1:500, 1:1000). `<model-viewer>`'s AR handoff locks to it
(`ar-scale="fixed"`); the R3F viewer uses it for initial camera framing;
true physical walk-through at that scale (motion-sensor tracking) is
deferred to Phase 4's custom AR build — see
[`phases.md`](phases.md#phase-4--native-shell-for-on-site-ar).
