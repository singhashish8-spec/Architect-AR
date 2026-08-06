# Architect AR — Product & Technical Roadmap

> **This is the plan.** For the story of how it got this way — every
> session, every decision and why, every finding, what's shipped and what's
> pending — read [`docs/PROJECT_HISTORY.md`](docs/PROJECT_HISTORY.md)
> first, whether you're a human coming back after a break or an AI
> assistant starting a new session with no memory of prior conversations.
> For the literal tech stack, folder structure, git workflow, and
> step-by-step build sequence, read
> [`docs/ENGINEERING_GUIDE.md`](docs/ENGINEERING_GUIDE.md) — that file is
> what turns this plan into the same code regardless of who's building it.
> Keep all three current after every session — this file is *what to build
> next*, the history is *why it's shaped this way*, the engineering guide
> is *how, exactly*. Same discipline as the sibling
> [Budget Tracker](https://github.com/singhashish8-spec/Budget-Tracker)
> repo's `docs/PROJECT_HISTORY.md`, on purpose.

Last updated: **2026-08-06**. Status: **pre-MVP — roadmap only, no product
code written yet.**

> **Change log:** added element-level BIM data inspection (tap a wall/door/
> element in the model, see its Revit data) as a core feature, and the IFC
> export pipeline that makes it possible — see §4.5 and the updated Phase 1/2
> scope below.

---

## 1. What this app is for

Architect AR is a **client presentation tool**. An architect (or interior
designer, or contractor) working in Revit, SketchUp, or Rhino exports a
finished or in-progress design, and Architect AR turns it into something a
client can open on their own phone or laptop — no install, just a link —
to rotate, walk around, and place in real space through AR, without needing
to open or understand the original CAD software.

The core promise: **you export a file, your client gets a link, and what
they see looks like the finished space, not a CAD viewport — and it isn't
just a dumb 3D shape, either.** Tap a wall, a door, a fixture, and it shows
what Revit actually knows about that element (family/type, level, material,
dimensions, cost code, whatever parameters were set). This is what turns the
tool from "a pretty render" into something a client, contractor, or
consultant can actually use to ask "what is this, and what's it made of?"
without opening Revit.

Everything else on this roadmap (measurement, markup, native on-site AR,
direct CAD plugin integration) is a layer on top of that core promise, not
a replacement for it.

> **Open item:** an additional use case was flagged during roadmap
> discussion but not captured in detail (selected as "Other" alongside
> "client presentation tool"). If you're picking this up, confirm with the
> product owner what that second use case was before prioritizing anything
> past Phase 1, in case it changes scope.

---

## 2. Current state of this repository (honest inventory)

As of this roadmap, `main` contains **only the default Android Studio
"Empty Activity (Compose)" template**, renamed to ArchitectAR:

- `MainActivity.kt` renders `Text("Hello Android!")` and nothing else.
- No camera permission, no ARCore, no CameraX, no 3D rendering of any kind.
- 2 commits total: an IDE-generated initial commit and a "chore: initialize
  Android Studio project" commit.
- The README's description of the app ("Professional Augmented Reality
  toolkit for architects...") does not match any code in the repo — that
  copy describes the *intended* product, not anything built yet.

This matters for planning: there is no legacy code to preserve or migrate.
The roadmap below is a clean-slate build, and the existing Android module
is not the foundation for Phase 1 (see §4 — the web app is the foundation;
this Android project is revisited in Phase 4).

---

## 3. Why web-first, not native-first

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

---

## 4. Recommended architecture

### 4.1 Frontend / viewer
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
  - Both surfaces read from the same source model (§4.5) — a client sees
    the R3F inspector by default and can drop into `<model-viewer>`'s AR
    mode with one tap.

### 4.2 Model pipeline (confirmed: export → import)
- Source tools (Revit, SketchUp, Rhino) export to **glTF/GLB** (preferred —
  open, web-native) with **USDZ** generated alongside for the Quick Look/iOS
  path specifically (`<model-viewer>` can auto-generate this, or it's
  exported directly from Rhino/SketchUp where supported).
- Revit additionally exports to **IFC** (native, built into Revit — "Export
  > IFC") as the source for element data — see §4.5. SketchUp/Rhino don't
  carry Revit-style parameter data in the same way, so the data-inspection
  feature is Revit-sourced models first; SketchUp/Rhino models still get
  full geometry + AR viewing, just without a rich property panel until/
  unless there's a similar data source to key off (e.g. SketchUp's
  classifications/dynamic attributes — a later evaluation, not Phase 1/2).
- No plugin or direct-integration work in Phase 1 — this is the fastest
  path to a working v1 and needs no cooperation from Autodesk/Trimble/
  McNeel APIs. Direct exporters/plugins are a Phase 5 option, not a
  prerequisite.

### 4.3 Hosting & storage
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

### 4.4 Sharing model (needs a decision before Phase 1 ships)
Two options, not mutually exclusive long-term:
- **Unlisted link, no login** — fastest to build, matches "just send a
  link"; anyone with the link can view.
- **Per-client access** (simple passcode or magic-link) — slightly more
  build effort, needed if designs are confidential and links might be
  forwarded.

Recommendation: ship unlisted links for Phase 1 (fastest to a working demo),
add optional passcode-per-project in Phase 2 once real client feedback
exists.

### 4.5 Element data pipeline (BIM metadata — decided: IFC)
The requirement: tap an element in the viewer, see what Revit knows about
it. Plain glTF/GLB export strips Revit's parameter data down to geometry
and materials — there's nothing left to show. Two options were weighed;
**IFC was chosen** over hand-rolling custom data into glTF's `extras` field:

- **Revit exports to IFC** (its native, built-in open BIM export — no
  plugin needed) alongside the glTF/GLB export. IFC carries the full
  parameter set: family/type, level, materials, dimensions, quantities,
  classifications, and any shared/project parameters that were set.
- **`web-ifc`** (open source, WASM-based IFC parser — the engine behind the
  former IFC.js project, now maintained as part of **That Open Company**'s
  `@thatopen/components`) parses the IFC file directly in the browser and
  hands geometry to Three.js/React Three Fiber, with each mesh tagged by
  its IFC "express ID."
- On tap/click, look up that express ID against the parsed IFC's property
  sets (`IsDefinedBy` → `IfcPropertySet` relationships) and render them in
  a data panel — no backend query needed, it's all client-side once the
  IFC file is loaded.
- Why not glTF `extras` instead: it would need a **custom Revit export
  script** to manually stuff chosen fields into each node (since standard
  exporters don't), only carries whatever fields that script explicitly
  picked, and re-invents a worse version of a mapping IFC already provides
  for free. IFC costs one extra export step per model; that's cheaper than
  building and maintaining a bespoke exporter.
- Tradeoff to plan around: IFC files can be large, and `web-ifc` parsing
  has a real cost on low-end devices — profile on an actual mid-range phone
  before shipping, and consider a server-side pre-process (IFC → a lighter
  JSON property index + glTF geometry) if client-side parsing proves too
  slow. That pre-process is a Phase 2 optimization, not a Phase 1 blocker.

### 4.6 Model scale (decided: standard architectural preset list, set at import)
Every model gets a scale assigned **once, at import time**, by the
architect uploading it — not a free continuous dial for the client. The
preset list follows standard architectural/engineering drawing scale
convention (ISO 5455 / RIBA), so the dropdown is familiar to anyone who's
read a drawing set, not an arbitrary app-specific choice:

| Preset | Typical use |
|---|---|
| 1:1 | Full-size / life-size walkthrough (a single room or interior fit-out) |
| 1:5, 1:10, 1:20 | Detail views (joinery, staircases, facade details) |
| 1:50, 1:100 | Floor plans — the common "whole building, one level" scale |
| 1:200, 1:500 | Site plans |
| 1:1000 | Master plan / location plan (a whole site or block) |

How this is enforced per surface:
- **`<model-viewer>` AR handoff (Phase 1)**: set `ar-scale="fixed"` so the
  model appears — and stays — at the chosen preset's real-world size in
  Scene Viewer/Quick Look; the client doesn't get a pinch-to-scale override
  that would contradict the architect's chosen scale. This works today with
  no custom AR code, matching the Phase 1 plan.
- **R3F desktop/browser viewer (Phase 1)**: the preset sets the initial
  camera framing/zoom, consistent with the same real-world scale.
- **Custom native AR walk-through (Phase 4, not Phase 1)**: physically
  walking around an anchored model — e.g. pacing around a 1:1000 master
  plan placed on your living-room floor like a giant tabletop model, using
  the phone's motion sensors fused with the camera (ARCore/ARKit
  visual-inertial tracking) for real 6DOF tracking — needs our own AR
  camera view instead of the OS handoff, which is exactly why it's
  deferred to Phase 4's native shell rather than pulled into Phase 1.
  Until then, "View in AR" still works (per the point above), it's just the
  OS's own AR view and gestures, not a custom walk-through.

---

## 5. Phased roadmap

### Phase 0 — Foundations (repo + decisions)
- Stand up the Vite + React project (new `web/` directory or new repo —
  decide during Phase 0, not before).
- Pick the BaaS/storage provider (§4.3) and hosting provider (§4.4).
- Resolve the open "second use case" item from §1.
- **Leave the existing Android module as-is** — it's revisited in Phase 4,
  not touched now.

### Phase 1 — MVP: the shareable viewer
- Upload a single model (glTF/GLB, + IFC if the source is Revit) → get a
  shareable link.
- Client opens the link on phone or PC: orbit/zoom/pan the model (R3F
  viewer, §4.1), no install required.
- **Tap/click any element → see its Revit data** (family/type, level,
  material, dimensions — whatever §4.5's IFC parse surfaces) in a side
  panel. This is Revit-sourced models only for Phase 1; SketchUp/Rhino
  models get the viewer + AR without the data panel until §4.2's later
  evaluation.
- "View in AR" button on supported phones (Scene Viewer / Quick Look via
  `<model-viewer>`).
- **Scale preset chosen at import** (§4.6 — 1:1 through 1:1000, standard
  architectural drawing scales), applied to both the R3F viewer's initial
  framing and locked into the AR handoff (`ar-scale="fixed"`).
- One model per link — no project/multi-model management yet.
- **Definition of done**: an architect can export a real Revit design, set
  its scale on import, get a link, and a client can see it in AR at the
  correct scale on their own phone *and* tap a wall to see what it actually
  is — without any help.

### Phase 2 — Presentation polish
- Multiple models per project (e.g. different rooms, or design options A/B).
- Branding: architect's logo/colors on the viewer page, per client if
  needed.
- Lighting/environment presets (daylight, evening, studio).
- Optional passcode-per-project (§4.4).
- Basic analytics: did the client open the link, how long did they look.
- **Element data quality-of-life**: search/filter elements by category or
  property (e.g. "show me every door"), isolate/hide categories, a simple
  schedule/quantity-takeoff view (list form of the same IFC data, not just
  tap-to-inspect).
- If client-side IFC parsing (§4.5) is too slow on real devices, move to
  the server-side pre-processed JSON + glTF pipeline here.

### Phase 3 — Interaction & review
- Hotspots/annotations pinned to points on the model ("this wall moves",
  "kitchen island here") — can now be anchored to actual elements, not just
  free-floating points, since picking already exists from Phase 1.
- Walkthrough camera paths (a guided tour instead of free orbit) using
  React Three Fiber.
- Section/clipping planes (cut through the model horizontally/vertically —
  natural fit once element picking + R3F control exist).
- Snapshot/short video export of a view, for sharing outside the link
  (email, WhatsApp).

### Phase 4 — Native shell for on-site AR
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
  whatever scale preset (§4.6) that model was imported with — walk around
  a 1:1000 master plan placed on the floor like a tabletop model, or walk
  through a 1:1 room-scale interior as if it were built.
- This finally gives the existing bare Android project (§2) a real purpose.

### Phase 5 — Deeper CAD integration
- Evaluate direct export plugins per tool (Revit, SketchUp, Rhino) or cloud
  sync (Autodesk Construction Cloud/BIM 360, Trimble Connect) to remove the
  manual export step entirely.
- Only worth it once Phase 1–3 usage proves the manual glTF export step is
  actually the friction point — not before.

### Phase 6 — Collaboration
- Measurement tools inside the viewer (distances, areas) exported back out.
- Clash flags / markup threads for a design review workflow (multiple
  stakeholders commenting on the same model), ideally in **BCF** (BIM
  Collaboration Format — the open standard for exactly this) so issues can
  round-trip back into Revit/Navisworks, not just live in our app.

---

## 6. Open decisions log

Keep this section current — add a row every time a decision gets made or a
question gets raised, don't let it go stale.

| Question | Status |
|---|---|
| What was the second ("Other") primary use case selected alongside "client presentation tool"? | **Unresolved** — confirm with product owner |
| How should element data survive Revit export (IFC vs glTF `extras`)? | **Decided: IFC**, parsed client-side with `web-ifc` — see §4.5 |
| How fine-grained should per-model scale control be? | **Decided: preset dropdown**, standard architectural scales (1:1–1:1000), set once at import — see §4.6 |
| Should motion-sensor walk-through ship in Phase 1 or Phase 4? | **Decided: Phase 4**, alongside the custom native AR build — see §4.6 and Phase 4 |
| BaaS/storage provider (Supabase vs Firebase vs custom) | Not yet decided — Phase 0 |
| Hosting provider (Vercel vs Netlify vs Cloudflare Pages) | Not yet decided — Phase 0 |
| Unlisted-link vs passcode sharing for Phase 1 | Recommended: unlisted for Phase 1, passcode in Phase 2 |
| New repo vs new directory in this repo for the web app | Not yet decided — Phase 0 |
| Is client-side IFC parsing fast enough on real mid-range phones? | Not yet tested — profile before Phase 1 ships; fallback is server-side pre-processing (§4.5) |

---

## 7. Additional feature ideas raised, not yet slotted into a phase

Quick-capture list from roadmap discussion — move an item into a numbered
phase above once it's actually prioritized, don't build straight from this
list:

- **Cost/quantity overlay**: since IFC quantities are already parsed for
  the data panel (§4.5), a running "total cost so far" or per-category
  quantity summary is mostly a display feature on data already in hand.
- **Design-option comparison**: two models side-by-side or toggle-able in
  the same viewer, for "Option A vs Option B" client conversations.
- **Role-gated views**: client gets read-only viewing; the architect/
  contractor gets extra layers (cost data, construction notes) the client
  doesn't see, on the same link.
- **On-site element lookup (ties to Phase 4)**: point the phone camera at
  a wall on the actual site and see its spec pulled from the same IFC data
  — the natural extension of Phase 1's tap-to-inspect once there's a native
  AR shell to point a live camera through.
- **Model versioning**: re-upload a revised export and let clients see
  what changed since the last version, instead of only ever seeing the
  latest.

---

## 8. Conventions for anyone working on this repo

- This file is the single source of truth for direction — update it in the
  same session/PR as any shipped milestone, before moving on.
- Don't build ahead of the current phase (e.g. don't start Phase 4's native
  wrapper before Phase 1's viewer is real and in a client's hands) — each
  phase is meant to produce something usable on its own.
- Mirror Budget Tracker's discipline of writing down *why*, not just *what*
  — especially for any decision that reverses something done in that
  sibling project (see §3 for the one deliberate reversal already made).
