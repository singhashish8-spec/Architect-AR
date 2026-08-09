# Roadmap — phased build plan

> Part of [`roadmap/`](README.md). Each phase should ship something usable
> on its own — don't build ahead of the current one. The literal,
> commit-sized execution steps for Phase 0 and the start of Phase 1 are in
> [`engineering/build-sequence.md`](../engineering/build-sequence.md).

## Phase 0 — Foundations (repo + decisions)
- Stand up the Vite + React project (`web/` directory in this repo — see
  [`engineering/folder-structure.md`](../engineering/folder-structure.md)).
- Pick the BaaS/storage provider and hosting provider (see
  [`decisions.md`](decisions.md) — defaults already set in
  [`engineering/tech-stack.md`](../engineering/tech-stack.md), confirm or
  override here).
- Resolve the open "second use case" item (see [`decisions.md`](decisions.md)).
- **Leave the existing Android module as-is** — it's revisited in Phase 4,
  not touched now.

## Phase 1 — MVP: the shareable viewer
- Upload a single model (glTF/GLB, + IFC if the source is Revit) → get a
  shareable link.
- Client opens the link on phone or PC: orbit/zoom/pan the model (R3F
  viewer), no install required.
- **Tap/click any element → see its Revit data** (family/type, level,
  material, dimensions) in a side panel. Revit-sourced models only for
  Phase 1; SketchUp/Rhino models get the viewer + AR without the data panel
  until a later evaluation. See
  [`features/element-data-inspection.md`](../features/element-data-inspection.md).
- "View in AR" button on supported phones (Scene Viewer / Quick Look via
  `<model-viewer>`).
- **Scale preset chosen at import** (1:1 through 1:1000, standard
  architectural drawing scales), applied to both the R3F viewer's initial
  framing and locked into the AR handoff (`ar-scale="fixed"`). See
  [`features/model-scale-presets.md`](../features/model-scale-presets.md).
- One model per link — no project/multi-model management yet.
- **Definition of done**: an architect can export a real Revit design, set
  its scale on import, get a link, and a client can see it in AR at the
  correct scale on their own phone *and* tap a wall to see what it actually
  is — without any help.

## Phase 2 — Presentation polish
- Multiple models per project (e.g. different rooms, or design options A/B).
- Branding: architect's logo/colors on the viewer page, per client if
  needed.
- Lighting/environment presets (daylight, evening, studio).
- Optional passcode-per-project.
- Basic analytics: did the client open the link, how long did they look.
- **Element data quality-of-life**: search/filter elements by category or
  property (e.g. "show me every door"), isolate/hide categories, a simple
  schedule/quantity-takeoff view (list form of the same IFC data, not just
  tap-to-inspect).
- If client-side IFC parsing is too slow on real devices, move to the
  server-side pre-processed JSON + glTF pipeline here (see
  [`features/element-data-inspection.md`](../features/element-data-inspection.md)).

## Phase 3 — Interaction & review
- Hotspots/annotations pinned to points on the model ("this wall moves",
  "kitchen island here") — can now be anchored to actual elements, not just
  free-floating points, since picking already exists from Phase 1.
- Walkthrough camera paths (a guided tour instead of free orbit) using
  React Three Fiber.
- Section/clipping planes (cut through the model horizontally/vertically —
  natural fit once element picking + R3F control exist).
- Snapshot/short video export of a view, for sharing outside the link
  (email, WhatsApp).
- **Full admin dashboard** — turns Phase 2's read-only `/admin` stats page
  into a real project management console. **Project + model management
  built and shipped (2026-08-09)**: create/edit/delete/duplicate projects,
  status tags, search/sort, bulk delete, and full model management (add/
  replace/rename/delete/reorder/note) all from `/admin` — project creation
  moved entirely behind the admin passcode, the public upload form is gone.
  **Still open**: richer analytics (per-visit history, CSV export) and a
  storage-usage tracker. Full detail in
  [`features/full-admin-dashboard.md`](../features/full-admin-dashboard.md).

## Phase 4 — Native shell for on-site AR
- Wrap the same web codebase with **Capacitor**, matching the Budget
  Tracker pattern, to produce an actual Android (and optionally iOS) app.
- This is where camera-overlay, on-site AR belongs: standing at the actual
  building site with the phone camera showing the proposed design overlaid
  at real scale — meaningfully different from the Phase 1 "view a link"
  experience, and the reason a native app becomes worth the extra
  maintenance.
- **Custom AR camera view** (our own ARCore/ARKit integration, not the
  Scene Viewer/Quick Look handoff) to support true physical walk-through:
  the phone's motion sensors fused with the camera track your real
  movement and translate it into movement through the anchored model, at
  whatever scale preset that model was imported with — walk around a
  1:1000 master plan placed on the floor like a tabletop model, or walk
  through a 1:1 room-scale interior as if it were built. See
  [`features/ar-walkthrough.md`](../features/ar-walkthrough.md).
- This finally gives the existing bare Android project a real purpose.

## Phase 5 — Deeper CAD integration
- Evaluate direct export plugins per tool (Revit, SketchUp, Rhino) or cloud
  sync (Autodesk Construction Cloud/BIM 360, Trimble Connect) to remove the
  manual export step entirely.
- Only worth it once Phase 1–3 usage proves the manual glTF export step is
  actually the friction point — not before.

## Phase 6 — Collaboration
- Measurement tools inside the viewer (distances, areas) exported back out.
- Clash flags / markup threads for a design review workflow (multiple
  stakeholders commenting on the same model), ideally in **BCF** (BIM
  Collaboration Format — the open standard for exactly this) so issues can
  round-trip back into Revit/Navisworks, not just live in our app.
