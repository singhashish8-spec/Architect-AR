# Roadmap — what & why

> Part of [Architect AR docs](../README.md). This section is the product
> and architecture picture. See [`architecture.md`](architecture.md) for
> the reasoning behind each technical choice, [`phases.md`](phases.md) for
> the build order, [`decisions.md`](decisions.md) for what's still
> undecided, and [`backlog.md`](backlog.md) for ideas not yet scheduled.

Last updated: **2026-08-06**. Status: **pre-MVP — roadmap only, no product
code written yet.**

## What this app is for

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
a replacement for it. See [`features/`](../features/README.md) for detailed
specs of individual features as they get scoped.

> **Open item:** an additional use case was flagged during roadmap
> discussion but not captured in detail (selected as "Other" alongside
> "client presentation tool"). If you're picking this up, confirm with the
> product owner what that second use case was before prioritizing anything
> past Phase 1, in case it changes scope. Tracked in
> [`decisions.md`](decisions.md).

## Current state of this repository (honest inventory)

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
The roadmap is a clean-slate build, and the existing Android module is not
the foundation for Phase 1 (see [`architecture.md`](architecture.md) — the
web app is the foundation; this Android project is revisited in Phase 4).

Full story of how this was found: see
[`../history/findings.md`](../history/findings.md).
