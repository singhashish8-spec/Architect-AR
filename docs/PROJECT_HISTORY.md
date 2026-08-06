# Architect AR — Project History & Guide

> **This is the one file to read to catch up on this project.** If you are a
> human returning after a break, or an AI assistant starting a brand-new chat
> session with no memory of previous conversations, read this file top to
> bottom before doing anything else. It explains what the app is meant to
> be, every session of work that's happened on it, every decision made and
> why, every finding (including things that turned out to be broken or
> missing), what's currently shipped, and what's still open.
>
> This mirrors the sibling repo
> [Budget Tracker](https://github.com/singhashish8-spec/Budget-Tracker)'s
> `docs/PROJECT_HISTORY.md` on purpose — same owner, same discipline: **keep
> this file current.** Whenever a session produces a decision, a shipped
> change, or a notable finding, add an entry below *in that same session*,
> before moving on. A history file that isn't kept current isn't worth
> having — the point is that anyone (or any AI) can drop into this project
> cold and know exactly where things stand without re-asking questions
> that were already answered.
>
> The living plan (what to build, in what order, and why) lives in
> [`ROADMAP.md`](../ROADMAP.md) at the repo root — that file is the
> *current state of the plan*; this file is the *record of how it got that
> way*. Update both together when a session changes the plan.

Last updated: **2026-08-06**, end of Session 1.

---

## Table of contents

1. [What this app is, in plain English](#1-what-this-app-is-in-plain-english)
2. [How this project is being built](#2-how-this-project-is-being-built)
3. [Complete session history](#3-complete-session-history)
4. [Notable findings and how they changed the plan](#4-notable-findings-and-how-they-changed-the-plan)
5. [Where things stand right now](#5-where-things-stand-right-now)
6. [What's still pending / open](#6-whats-still-pending--open)
7. [Rules of the road — conventions for this project](#7-rules-of-the-road--conventions-for-this-project)
8. [Glossary](#8-glossary)

---

## 1. What this app is, in plain English

Architect AR is a **client presentation tool** for architects (and interior
designers, contractors) who work in Revit, SketchUp, or Rhino. The
architect exports a design; a client opens a link on their own phone or
laptop — no install — and can rotate, walk around, view it in AR on their
phone, and **tap any element (a wall, a door, a fixture) to see what Revit
actually knows about it** (family/type, level, material, dimensions).

Full detail — architecture, tech stack, phased build plan — lives in
[`ROADMAP.md`](../ROADMAP.md). This file is the narrative of how that plan
came to be and stays accurate as work happens; read the roadmap for *what*
to build next, read this file for *why* it's shaped that way.

---

## 2. How this project is being built

This project is being planned and built through conversation with an AI
assistant (Claude, via Claude Code), the same working style as Budget
Tracker. Each work session:

- Investigates or builds something concrete.
- Surfaces decisions that only the product owner can make (architecture
  tradeoffs, scope calls) and asks rather than guessing.
- Records the outcome here, and updates `ROADMAP.md` if the plan changed.
- Commits and pushes to the project's designated branch, opening/updating a
  pull request rather than pushing straight to `main`.

---

## 3. Complete session history

### Session 1 — 2026-08-06

**Starting point.** The product owner reported that the installed app
crashed immediately after accepting the camera permission prompt, even
after updates, and asked for a full bug-finding pass. The app had been
built through Android Studio's Gemini assistant.

**Investigation.** Cloned and read the entire repository. Found:
- `main` contained exactly 2 commits — an IDE-generated "Initial commit"
  and "chore: initialize Android Studio project" — both just the default
  Android Studio **Empty Activity (Compose) template**, renamed to
  ArchitectAR.
- `MainActivity.kt` rendered `Text("Hello Android!")` and nothing else.
- **No camera permission in the manifest, no ARCore, no CameraX, no AR or
  3D code of any kind anywhere in the repo.**
- The README's product description ("Professional Augmented Reality
  toolkit...") didn't match any code present — it described the intended
  product, not anything built.

**Conclusion reported to owner:** the crash could not be reproduced or
diagnosed from this repository, because the app that's pushed to GitHub
never asks for camera access at all. The AR/camera build the owner saw
crash locally in Android Studio was never committed — most likely local,
uncommitted work. See [§4](#4-notable-findings-and-how-they-changed-the-plan)
for how this reframed the whole task.

**Given that, the owner redirected the ask**: rather than chase
undiagnosable local code, build a full roadmap for the product from
scratch, informed by the owner's real-world tools (Revit, SketchUp, Rhino)
and by the sibling **Budget Tracker** project's build pattern (Vite + React
wrapped in Capacitor). Read `Budget-Tracker`'s `README.md` and
`docs/PROJECT_HISTORY.md` for that reference.

**Decisions made this session, in order:**

1. **Primary use case: client presentation tool** (plus one additional use
   case selected as "Other" during a multi-choice question, whose text
   wasn't captured — still open, see §6).
2. **Model pipeline: export-then-import**, not a direct plugin/live-sync
   integration, for Phase 1 — fastest path to a working product, no
   dependency on Autodesk/Trimble/McNeel API access.
3. **Web-first, not native-first** — reversing Budget Tracker's own
   pattern on purpose. Budget Tracker bundles everything into the APK and
   never hosts a live shell, because it bridges to SMS/biometrics and a
   remote shell would dodge Play Store review of that. Architect AR has the
   opposite requirement: a client needs to open a link with zero install,
   so it's hosted live (Vercel/Netlify/Cloudflare Pages), not shipped as an
   APK. Native wrapping returns in Phase 4, once there's a reason that
   needs it (see below).
4. **Viewer stack**: `<model-viewer>` (Google's web component) for the
   one-tap "View in AR" handoff to the phone's built-in AR (Scene
   Viewer/Quick Look) — and separately, **React Three Fiber** for a
   custom-controlled viewer, because element tap-to-inspect needs raycasting
   `<model-viewer>` doesn't expose.
5. **Element data pipeline: IFC, not glTF `extras`.** Plain glTF/GLB export
   strips all of Revit's parameter data. Weighed stuffing custom data into
   glTF's `extras` field (needs a bespoke Revit export script, only carries
   hand-picked fields) against Revit's native IFC export (built-in, no
   plugin, carries the full parameter set) parsed client-side with
   `web-ifc` (open-source WASM IFC parser, the engine behind the former
   IFC.js project). **Chose IFC** — see `ROADMAP.md` §4.5 for the full
   reasoning.
6. **Model scale: preset dropdown, not a free slider**, using standard
   architectural drawing scales (1:1 through 1:1000, ISO 5455/RIBA
   convention: 1:1, 1:5, 1:10, 1:20, 1:50, 1:100, 1:200, 1:500, 1:1000),
   chosen once by the architect at import — "everything has to be as per
   architectural standards" (owner's words). Enforced via
   `<model-viewer>`'s `ar-scale="fixed"` in Phase 1.
7. **Motion-sensor walk-through: Phase 4, not Phase 1.** True physical
   walking through an anchored model (phone motion sensors fused with the
   camera, real 6DOF tracking) needs a custom-built ARCore/ARKit camera
   view, not the OS's handoff AR — deferred to Phase 4's native shell
   rather than pulled forward, keeping Phase 1 to a viewer + AR handoff +
   data panel, no custom native AR code yet.
8. **This history file** — requested explicitly by the owner, modeled on
   Budget Tracker's `docs/PROJECT_HISTORY.md`, so any future session (human
   or AI) can pick this project up without re-deriving the above.
9. **A third doc, `docs/ENGINEERING_GUIDE.md`** — requested by the owner so
   that *any* future AI assistant (not specifically this one) follows the
   same standard for every step, not just the same plan. This pinned the
   remaining open technical decisions to concrete defaults rather than
   leaving them open, specifically so the guide is actually literal enough
   to follow:
   - **TypeScript**, not JavaScript, across the whole stack — a deliberate
     deviation from Budget Tracker's plain JS, justified by this project's
     more complex data shapes (IFC property sets, glTF scene graphs, scale
     enums).
   - **Web app lives in this same repo**, in a new `web/` directory
     alongside the existing `app/` (Android) directory — not a separate
     repo — so the Phase 4 native shell and the web app share one history.
   - **ESLint** (not Budget Tracker's `oxlint`) and **Vitest** (not
     Budget Tracker's `node --test`) — both deviations justified in
     `ENGINEERING_GUIDE.md` §1 by TypeScript-aware linting and native Vite
     test integration respectively.
   - **Supabase (BaaS) + Vercel (hosting)** set as the *default* picks for
     the previously-open "BaaS/hosting provider" decision, so the Phase 0
     build sequence has something concrete to execute — explicitly
     flagged as overridable at Phase 0 kickoff, not a closed decision.
   - A literal, numbered **step-by-step build sequence** for Phase 0 and
     the start of Phase 1 (`ENGINEERING_GUIDE.md` §8), turning
     `ROADMAP.md`'s bullet-point phases into commit-sized, executable
     steps.

**Shipped this session:**
- `ROADMAP.md` — full architecture, phased plan (0–6), open decisions log,
  feature backlog.
- `docs/PROJECT_HISTORY.md` — this file.
- `docs/ENGINEERING_GUIDE.md` — tech stack, folder structure, coding
  conventions, git workflow, environment/secrets handling, CI quality
  gates, deployment, and a step-by-step build sequence through the start
  of Phase 1.
- `README.md` updated to point to all three docs, in reading order.
- All on branch `claude/app-crash-camera-access-y74pyp`, PR
  [#1](https://github.com/singhashish8-spec/Architect-AR/pull/1) (draft).
- **No product code was written this session** — no app exists yet beyond
  the default template inherited from Android Studio.

---

## 4. Notable findings and how they changed the plan

### Finding: the reported crash isn't reproducible from this repo (Session 1)
**What was found:** the repository contains no camera or AR code at all —
just the unmodified default Android Studio template. The crash the owner
saw locally cannot be diagnosed from what's on GitHub.

**Why it happened (most likely):** work done through Android Studio's
Gemini assistant locally was run and tested on-device but never committed
or pushed before the crash occurred, so it never made it into version
control.

**Impact on the plan:** rather than chase a bug in code that doesn't exist
here, the task became "build the roadmap for what should exist," starting
clean. This is *why* Session 1 produced a roadmap instead of a bug fix —
not a scope-creep accident, a direct consequence of this finding.

**Standing lesson for anyone working on this repo:** commit and push local
work *before* testing something risky (like a first camera-permission
flow) on-device, specifically so a crash doesn't take uncommitted work down
with it. Nothing in the current plan depends on Android Studio-only local
state — everything Phase 0 onward should be built and pushed incrementally
for exactly this reason.

---

## 5. Where things stand right now

- **Code**: none, beyond the inherited default Android Studio template
  (`app/src/main/java/com/singhashish/architectar/MainActivity.kt` — a
  Compose "Hello Android!" screen, nothing else).
- **Plan**: fully scoped through Phase 1 (MVP), with Phases 2–6 sketched at
  a decision level. See `ROADMAP.md`.
- **Engineering standard**: tech stack, folder structure, conventions, and
  a literal Phase 0 / start-of-Phase-1 build sequence are all defined. See
  `docs/ENGINEERING_GUIDE.md`. The next session can start executing
  `ENGINEERING_GUIDE.md` §8 step 1 directly.
- **Open PR**: [#1](https://github.com/singhashish8-spec/Architect-AR/pull/1)
  (draft) on `claude/app-crash-camera-access-y74pyp`, containing all three
  docs. Not yet merged.
- **Nothing has been built, deployed, or tested** — Phase 0 (stand up the
  actual Vite + React project) has not started.

---

## 6. What's still pending / open

Kept in sync with `ROADMAP.md` §6 (Open decisions log) — check there for
the authoritative live list. As of end of Session 1:

- **Unresolved**: the second ("Other") primary use case selected alongside
  "client presentation tool" during roadmap planning — the actual text
  wasn't captured. Needs confirming with the product owner before
  prioritizing anything past Phase 1, in case it changes scope.
- **Not yet decided**: BaaS/storage provider, hosting provider, new-repo-
  vs-new-directory for the web app — all Phase 0 decisions.
- **Not yet tested**: whether client-side IFC parsing (`web-ifc`) is fast
  enough on real mid-range phones — needs profiling before Phase 1 ships;
  fallback is a server-side pre-process (IFC → lighter JSON + glTF).
- **Not started**: Phase 0 itself (standing up the actual project).

---

## 7. Rules of the road — conventions for this project

- **Update this file every session**, before moving on — add an entry to
  §3, and if a finding changed the plan, add it to §4 too. This file is
  only useful if it stays true; a stale history file is worse than none.
- **Update `ROADMAP.md` in the same session** if a decision changes scope,
  architecture, or phase ordering — the two files must never drift apart.
- **Write down *why*, not just *what***, especially for any decision that
  reverses a pattern from the sibling Budget Tracker project (the web-first
  vs. bundled-APK reversal in Session 1 is the template for this).
- **Don't build ahead of the current phase** — each phase in `ROADMAP.md`
  is meant to ship something usable on its own; skipping ahead (e.g.
  starting Phase 4's custom AR before Phase 1's viewer exists) breaks that.
- **Commit and push incrementally**, especially before testing anything
  risky on-device — Session 1's whole starting problem was uncommitted
  local work getting lost to a crash. Don't repeat that.
- **Ask, don't guess**, on anything only the product owner can decide
  (architecture tradeoffs, scope, priorities) — every decision in §3 above
  was surfaced as an explicit question first.

---

## 8. Glossary

- **glTF / GLB** — an open, web-native 3D file format (GLB is the
  single-file binary packaging of glTF). What `<model-viewer>` and
  Three.js/React Three Fiber render.
- **USDZ** — Apple's AR file format; needed for the "View in AR" handoff
  to work on iOS (Quick Look).
- **IFC** (Industry Foundation Classes) — an open BIM data format. Unlike
  glTF, it carries full building-element data: family/type, level,
  materials, dimensions, quantities, classifications. Revit exports to it
  natively.
- **`web-ifc`** — an open-source, WASM-based library that parses IFC files
  directly in a web browser (the engine behind the former IFC.js project,
  now part of That Open Company's `@thatopen/components`).
- **`<model-viewer>`** — a web component from Google, built on Three.js,
  that renders a glTF/GLB model and provides a built-in "View in AR" button
  handing off to the phone's own AR viewer.
- **React Three Fiber (R3F)** — a React renderer for Three.js; used here
  wherever custom control is needed beyond what `<model-viewer>` exposes
  (element picking/raycasting, custom camera paths, section planes).
- **Scene Viewer / Quick Look** — the built-in AR viewers on Android and
  iOS respectively, launched by `<model-viewer>`'s "View in AR" button.
  Handles camera pass-through and world tracking without any custom AR code
  from this project — until Phase 4's custom AR camera view replaces it for
  the walk-through feature specifically.
- **ARCore / ARKit** — Google's and Apple's native AR frameworks,
  respectively. Fuse the camera with the phone's motion sensors
  (accelerometer, gyroscope) for real-world 6DOF position tracking
  (visual-inertial odometry). What Scene Viewer/Quick Look use internally,
  and what Phase 4's custom AR build will use directly.
- **BCF** (BIM Collaboration Format) — an open standard for design-review
  issues/markup tied to specific model elements, able to round-trip into
  tools like Revit/Navisworks. Earmarked for Phase 6.
- **Capacitor** — the framework used (in both this project's Phase 4 plan
  and in Budget Tracker today) to wrap a web app (React/Vite) into a native
  Android/iOS app shell.
