# Architect AR — Product & Technical Roadmap

> **Read this first if you're picking up this project** — as a human coming
> back after a break, or an AI assistant starting a new session with no
> memory of prior conversations. It explains what this app is meant to
> become, why the architecture below was chosen over the alternatives, and
> what to build in what order. Keep it updated after every milestone ships,
> the same way `docs/PROJECT_HISTORY.md` is kept current in the
> [Budget Tracker](https://github.com/singhashish8-spec/Budget-Tracker) repo
> — these two projects share an owner and a working style, and this file
> follows that project's convention on purpose.

Last updated: **2026-08-06**. Status: **pre-MVP — roadmap only, no product
code written yet.**

---

## 1. What this app is for

Architect AR is a **client presentation tool**. An architect (or interior
designer, or contractor) working in Revit, SketchUp, or Rhino exports a
finished or in-progress design, and Architect AR turns it into something a
client can open on their own phone or laptop — no install, just a link —
to rotate, walk around, and place in real space through AR, without needing
to open or understand the original CAD software.

The core promise: **you export a file, your client gets a link, and what
they see looks like the finished space, not a CAD viewport.**

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
- **`<model-viewer>`** (Google's web component, built on Three.js) for the
  core 3D + AR experience:
  - Loads glTF/GLB directly, no custom renderer to build or maintain.
  - Ships a built-in "View in AR" button: hands off to **Scene Viewer** on
    Android and **Quick Look** on iOS — real AR, on the client's own phone,
    with zero app install and zero native AR code on our side.
  - Handles orbit/zoom/pan, lighting presets, and poster/loading states out
    of the box.
  - When custom interaction outgrows `<model-viewer>` (measurement tools,
    walkthrough camera paths, annotations — Phase 3+), the escape hatch is
    **React Three Fiber** (Three.js) using the same glTF assets, not a
    rewrite.

### 4.2 Model pipeline (confirmed: export → import)
- Source tools (Revit, SketchUp, Rhino) export to **glTF/GLB** (preferred —
  open, web-native) with **USDZ** generated alongside for the Quick Look/iOS
  path specifically (`<model-viewer>` can auto-generate this, or it's
  exported directly from Rhino/SketchUp where supported).
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
- Upload a single glTF/GLB model → get a shareable link.
- Client opens the link on phone or PC: orbit/zoom/pan the model, no
  install required.
- "View in AR" button on supported phones (Scene Viewer / Quick Look).
- One model per link — no project/multi-model management yet.
- **Definition of done**: an architect can export a real design from
  SketchUp/Rhino/Revit, get a link, and a client can see it in AR on their
  own phone without any help.

### Phase 2 — Presentation polish
- Multiple models per project (e.g. different rooms, or design options A/B).
- Branding: architect's logo/colors on the viewer page, per client if
  needed.
- Lighting/environment presets (daylight, evening, studio).
- Optional passcode-per-project (§4.4).
- Basic analytics: did the client open the link, how long did they look.

### Phase 3 — Interaction & review
- Hotspots/annotations pinned to points on the model ("this wall moves",
  "kitchen island here").
- Walkthrough camera paths (a guided tour instead of free orbit) using
  React Three Fiber.
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
  stakeholders commenting on the same model).

---

## 6. Open decisions log

Keep this section current — add a row every time a decision gets made or a
question gets raised, don't let it go stale.

| Question | Status |
|---|---|
| What was the second ("Other") primary use case selected alongside "client presentation tool"? | **Unresolved** — confirm with product owner |
| BaaS/storage provider (Supabase vs Firebase vs custom) | Not yet decided — Phase 0 |
| Hosting provider (Vercel vs Netlify vs Cloudflare Pages) | Not yet decided — Phase 0 |
| Unlisted-link vs passcode sharing for Phase 1 | Recommended: unlisted for Phase 1, passcode in Phase 2 |
| New repo vs new directory in this repo for the web app | Not yet decided — Phase 0 |

---

## 7. Conventions for anyone working on this repo

- This file is the single source of truth for direction — update it in the
  same session/PR as any shipped milestone, before moving on.
- Don't build ahead of the current phase (e.g. don't start Phase 4's native
  wrapper before Phase 1's viewer is real and in a client's hands) — each
  phase is meant to produce something usable on its own.
- Mirror Budget Tracker's discipline of writing down *why*, not just *what*
  — especially for any decision that reverses something done in that
  sibling project (see §3 for the one deliberate reversal already made).
