# Where things stand right now

> Part of [`history/`](README.md). Unlike the rest of this folder, this
> file is meant to be *overwritten* each session to reflect current state
> — not appended to. Kept in sync with
> [`../roadmap/decisions.md`](../roadmap/decisions.md) for the authoritative
> live list of open questions.

Last updated: **2026-08-06**, end of Session 1 (Phase 0 execution).

- **Code**: `web/` is a real Vite + React + TypeScript scaffold with the
  full pinned stack installed (`three`, `@react-three/fiber`,
  `@react-three/drei`, `@google/model-viewer`, `web-ifc` +
  `@thatopen/components`, `@supabase/supabase-js`), ESLint + Prettier +
  Vitest configured, the `src/` folder structure in place, and one passing
  smoke test. All four quality gates (`lint`, `typecheck`, `test`, `build`)
  verified clean locally. The Android `app/` module is still just the
  inherited default template — untouched, as planned (Phase 4).
- **Plan**: fully scoped through Phase 1 (MVP), with Phases 2–6 sketched at
  a decision level. See [`../roadmap/`](../roadmap/README.md).
- **Engineering standard**: tech stack, folder structure, conventions, and
  a literal Phase 0 / start-of-Phase-1 build sequence are all defined. See
  [`../engineering/`](../engineering/README.md).
- **Feature specs**: written for the features already scoped — see
  [`../features/`](../features/README.md).
- **Released version**: none yet — nothing has shipped to production. See
  [`../releases/`](../releases/README.md) and
  [`../engineering/release-process.md`](../engineering/release-process.md).
- **CI**: `.github/workflows/ci.yml` is written and correct
  (lint/typecheck/test/build on every PR touching `web/`), but **GitHub
  does not recognize it** — `list_workflows` returns zero and the
  workflow's runs endpoint 404s, which is the signature of GitHub Actions
  being disabled at the repository settings level. This needs the owner to
  enable it (Settings → Actions → General) — see next section.
- **Open PR**: [#1](https://github.com/singhashish8-spec/Architect-AR/pull/1)
  (draft) on `claude/app-crash-camera-access-y74pyp`. Not yet merged.

## What's still pending / open

- **Blocking Phase 0 completion — needs the owner, not an AI**:
  1. Create the Supabase project (record its URL + anon key).
  2. Create the Vercel project (connect to this repo, root directory
     `web/`).
  3. Enable GitHub Actions for this repository (Settings → Actions →
     General) — currently appears disabled; CI is written but GitHub
     won't run it until this is turned on.

  None of these three can be done by an AI session — all three require the
  owner's own account/settings access. See
  [`sessions/2026-08-06-session-01.md`](sessions/2026-08-06-session-01.md#what-still-needs-the-owner-not-an-ai).
  Until they're done: there's no CI enforcement on GitHub, no live
  preview/production deploy, and Phase 1's Supabase-dependent build steps
  (schema, upload flow) are blocked.
- **Unresolved**: the second ("Other") primary use case selected alongside
  "client presentation tool" during roadmap planning — the actual text
  wasn't captured. Needs confirming with the product owner before
  prioritizing anything past Phase 1, in case it changes scope.
- **Not yet tested**: whether client-side IFC parsing (`web-ifc`) is fast
  enough on real mid-range phones — needs profiling before Phase 1 ships;
  fallback is a server-side pre-process (IFC → lighter JSON + glTF).
