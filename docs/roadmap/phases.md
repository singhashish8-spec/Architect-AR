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
  property (e.g. "show me every door"), isolate/hide categories, and a
  full **Bill of Quantities** (list form of the same IFC data, not just
  tap-to-inspect) — shipped as a simple count-only Schedule view first,
  then upgraded 2026-08-11 into a genuinely detailed BOQ (per-element
  material and quantities, collapsible Discipline/Category headers,
  search, CSV export). See [`features/boq.md`](../features/boq.md).
- If client-side IFC parsing is too slow on real devices, move to the
  server-side pre-processed JSON + glTF pipeline here (see
  [`features/element-data-inspection.md`](../features/element-data-inspection.md)).
- **GLB compression** (proposed 2026-08-15, not built) — Draco geometry
  compression and texture resizing/re-encoding added to the existing
  client-side `viewer/fbxToGlb.ts`/`ifc/ifcToGlb.ts` conversion, to
  shrink every upload/download and speed up viewer load and AR
  performance on a client's phone. Independent of Phase 5's pyRevit
  idea below — would help the current fully-manual upload flow too, not
  just a future automated one. See
  [`decisions.md`](decisions.md).

## Phase 3 — Interaction & review
- Hotspots/annotations pinned to points on the model ("this wall moves",
  "kitchen island here") — can now be anchored to actual elements, not just
  free-floating points, since picking already exists from Phase 1.
- Walkthrough camera paths (a guided tour instead of free orbit) using
  React Three Fiber.
- **Free walk/fly navigation** (scoped 2026-08-10, not built yet) —
  Twinmotion-style first-person movement as an alternative to orbiting:
  a **fly/drone mode** (free movement along the camera's own look
  direction, no ground constraint) first, then a **walk mode** on top
  of it (locked to a ground height; real collision against the model's
  geometry is a further follow-up, not needed for a first version). A
  speed control (slow/normal/fast, scaled by the same `visualScale()`
  factor the scale presets already use) applies to both. Desktop:
  WASD/arrow keys + drag-to-look, consistent with how orbiting already
  works. Phone: a dual virtual joystick (left thumb moves, right thumb
  looks) — the standard mobile pattern for this kind of navigation.
  Needs an explicit mode switcher (Orbit/Walk/Fly) and an easy way back
  to orbit, since the corner buttons are already fairly full on a phone
  screen. See [`levels-and-rooms-navigation.md`](../features/levels-and-rooms-navigation.md)
  for the existing `centerPivotOnCamera()` "look around from here"
  control this would build alongside.
- **Camera modes, view presets, and a level slicer** (scoped 2026-08-10,
  not built yet) — a **perspective/orthographic camera toggle** plus
  standard **view presets** (Isometric, Plan/Top, Front, Side), matching
  what an architect already expects from Revit/Forma. Switching camera
  types needs care: perspective vs orthographic zoom behave differently
  in Three.js (dolly distance vs view-frustum size), so the swap has to
  feel seamless, not jarring. A **level slicer** in the Levels panel —
  toggle a level, everything above it disappears — is a horizontal
  clipping plane anchored to each level's own elevation (already known
  from `ifcSpatialTree.ts`'s parsed data), and combines with Plan/Top
  view to produce an actual Revit-style floor plan, which is the more
  useful end result than either piece alone. Also **two separate camera
  sliders**: **zoom** (dolly distance) and **field of view** (wide-angle
  ↔ telephoto lens feel — genuinely different from zoom, since FOV
  changes perspective distortion/converging lines, not just how close
  the camera sits). This is a more specific, scoped version of the
  generic "section/clipping planes" idea below — the level slicer is
  that same clipping-plane mechanism, just driven by level data the app
  already has instead of a freeform draggable plane.
- Section/clipping planes (cut through the model horizontally/vertically —
  natural fit once element picking + R3F control exist; see the level
  slicer above for the level-driven version of this already scoped).
- Snapshot/short video export of a view, for sharing outside the link
  (email, WhatsApp).
- **Full admin dashboard** — turns Phase 2's read-only `/admin` stats page
  into a real project management console. **Project + model management
  built and shipped (2026-08-09)**: create/edit/delete/duplicate projects,
  status tags, search/sort, bulk delete, and full model management (add/
  replace/rename/delete/reorder/note) all from `/admin` — project creation
  moved entirely behind the admin passcode, the public upload form is gone.
  **Richer analytics and the storage-usage tracker shipped (2026-08-11)**:
  a per-project Analytics tab (visit history table, views-per-day chart,
  CSV export) and an account-wide storage usage panel (progress bar,
  owner-editable limit) on the project list. Full detail in
  [`features/full-admin-dashboard.md`](../features/full-admin-dashboard.md).
  **Location/OS/browser breakdown proposed 2026-08-15** (found while
  reviewing a competitor's analytics feature set, see
  [`decisions.md`](decisions.md)) — not built yet, but cheap: Vercel
  already attaches the visitor's country/city to every request at the
  edge for free, and OS/browser just needs the standard `User-Agent`
  header parsed, both already arriving with every request today, unused.
- **AR viewing on Meta Quest and Apple Vision Pro, not just phones**
  (proposed 2026-08-15, not built) — today's AR handoff only reaches
  Android (Scene Viewer) and iPhone/iPad (Quick Look, via a USDZ file).
  Vision Pro shares the same Quick Look mechanism as iPhone/iPad, so a
  USDZ already being generated for iOS may partly work there with little
  extra code — worth testing before assuming new work. Quest has no such
  shortcut and would need **WebXR** — a browser API for requesting an
  immersive AR/VR session directly from JavaScript, which `three.js`
  (already this app's own viewer library) has built-in support for.
  Real use case: design review with a room full of stakeholders on
  headsets, not just one client on their phone. See
  [`decisions.md`](decisions.md).

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

## Phase 5 — Deeper CAD integration, and real-world site capture
- Evaluate direct export plugins per tool (Revit, SketchUp, Rhino) or cloud
  sync (Autodesk Construction Cloud/BIM 360, Trimble Connect) to remove the
  manual export step entirely.
- Only worth it once Phase 1–3 usage proves the manual glTF export step is
  actually the friction point — not before.
- **A lightweight 360°-photo walkthrough mode** (proposed 2026-08-15, not
  built — found while reviewing a competitor's product suite, see
  [`decisions.md`](decisions.md)) — a *companion* to the full 3D model
  pipeline, not a replacement: a single 360° (equirectangular) photo
  mapped onto the inside of a sphere in three.js, camera at the center,
  so looking around reads as "standing in the space." Genuinely simple
  to build (simpler than the existing BIM viewer) and needs no special
  capture equipment — any 360° camera, or some phone panorama apps,
  produce a usable file. Real use case: fast, cheap documentation of an
  **existing site's current condition** before a renovation project,
  something the precise-geometry pipeline isn't suited for.
- **Gaussian Splatting for existing-site capture** (proposed 2026-08-15,
  not built — a real, current (2023+) technique, not a competitor's
  invention) — turns a short walk-around phone video of a real space
  into a photorealistic 3D scene (millions of small colored translucent
  "blobs" instead of triangles), handling reflective/transparent/fine
  detail better than ordinary photogrammetry. Capture itself is easy
  (just a phone video); the real cost is **reconstruction**, which needs
  genuine GPU compute — not something a browser or a small server does,
  the same category of "needs new infrastructure" as the background-
  conversion-service idea above, either via a paid hosted splatting
  service or a self-hosted GPU pipeline. Once a splat file exists,
  open-source three.js-compatible splat viewers exist and would slot
  into the existing viewer reasonably cleanly — it's the reconstruction
  step, not the viewing step, that's the real undertaking. See
  [`decisions.md`](decisions.md).
- **pyRevit extension for one-click export + upload** (proposed
  2026-08-15, discussed, not built or formally scoped) — this is the
  concrete version of "direct export plugin" above, specific to Revit:
  a pyRevit ribbon button triggers native FBX + IFC export automatically,
  then hands the files straight into an embedded browser panel (WebView2)
  showing this app's own upload page, so the existing browser-based
  upload flow just runs with no manual file-picking. A real, separate
  software project (Python + C#/.NET, not part of this web app's own
  codebase) — see [`decisions.md`](decisions.md) for the full discussion,
  including why it doesn't need this app's code to change at all.
- Autodesk Platform Services (APS, formerly "Forge") — feeding a
  Navisworks NWC or Revit file directly to Autodesk's own cloud
  translation service, instead of a manual FBX+IFC export — **researched
  2026-08-15, decided not to pursue for now**: no glTF/GLB output for any
  source format (only Autodesk's own proprietary SVF/SVF2, needing their
  own Viewer SDK), unconfirmed pricing after Autodesk's December 2025
  billing overhaul, and unconfirmed texture/property fidelity for NWC
  specifically. See [`decisions.md`](decisions.md) for the full
  research findings before revisiting this.

## Phase 6 — Collaboration
- Measurement tools inside the viewer (distances, areas) exported back out.
- Clash flags / markup threads for a design review workflow (multiple
  stakeholders commenting on the same model), ideally in **BCF** (BIM
  Collaboration Format — the open standard for exactly this) so issues can
  round-trip back into Revit/Navisworks, not just live in our app.
- **Real-time multi-user collaboration in the viewer** (proposed
  2026-08-15, not scoped) — an architect and a client, or several
  architects, reviewing the same model live together (shared camera/
  cursor/selection state), not just each opening the same static share
  link independently. Distinct from the clash-flag/markup-thread idea
  above, which is asynchronous (comments left for later), not live. See
  [`decisions.md`](decisions.md).
