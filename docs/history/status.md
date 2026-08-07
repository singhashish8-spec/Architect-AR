# Where things stand right now

> Part of [`history/`](README.md). Unlike the rest of this folder, this
> file is meant to be *overwritten* each session to reflect current state
> — not appended to. Kept in sync with
> [`../roadmap/decisions.md`](../roadmap/decisions.md) for the authoritative
> live list of open questions.

Last updated: **2026-08-06**, end of Session 2 (Phase 1 code, unverified end-to-end).

- **Code**: `web/` now has real Phase 1 functionality written — upload
  flow, Supabase schema, R3F viewer with scale-aware model transform,
  `<model-viewer>` AR handoff, IFC parsing + property lookup, routing.
  All four quality gates (`lint`, `typecheck`, `test` — 12 tests now, up
  from 1, `build`) verified clean locally.
  **Found and fixed four real bugs this session**, none of which would
  have been visible until someone actually tried using the app: a WASM
  path bug that would've broken IFC loading entirely, a Supabase RLS
  interaction that would've made *every* project upload fail, a missing
  Storage bucket that would've made every file upload fail, and a data
  panel that popped up automatically on page load instead of waiting for
  a tap. See
  [`sessions/2026-08-06-session-02.md`](sessions/2026-08-06-session-02.md)
  for the full detail on each.
  **What's still genuinely unverified**: the glTF-node-to-IFC-GlobalId
  correlation and the 1:1-authoring scale assumption — neither can be
  checked without a real Revit export, see
  [`sessions/2026-08-06-session-02.md`](sessions/2026-08-06-session-02.md#whats-built-but-not-verified--read-before-trusting-this-code-end-to-end).
  The Android `app/` module is still just the inherited default template —
  untouched, as planned (Phase 4).
- **Plan**: fully scoped through Phase 1 (MVP), with Phases 2–6 sketched at
  a decision level. See [`../roadmap/`](../roadmap/README.md).
- **Engineering standard**: tech stack (now including `react-router-dom`,
  added in Session 2 — a gap in the original pin), folder structure,
  conventions, and the build sequence are all defined. See
  [`../engineering/`](../engineering/README.md).
- **Feature specs**: written for the features already scoped — see
  [`../features/`](../features/README.md).
- **Released version**: none yet — nothing has shipped to production. See
  [`../releases/`](../releases/README.md) and
  [`../engineering/release-process.md`](../engineering/release-process.md).
- **CI**: `.github/workflows/ci.yml` is on `main` (PR #1 merged in
  Session 1) and confirmed **registered/active** on GitHub — the earlier
  "does GitHub even see this workflow" mystery turned out to be that
  `pull_request`-triggered workflows aren't discovered until the file
  exists on the base branch, not a disabled-Actions setting (that setting
  was already correct). Not yet confirmed to actually complete a run.

## What's still pending / open

- **Blocking a real deploy — needs the owner, not an AI**:
  1. Create the Supabase project (record its URL + anon key), then run
     `web/supabase/schema.sql` against it.
  2. Create the Vercel project (connect to this repo, root directory
     `web/`), with the Supabase env vars set.

  Neither can be done by an AI session — both require the owner's own
  account access. See
  [`sessions/2026-08-06-session-01.md`](sessions/2026-08-06-session-01.md#what-still-needs-the-owner-not-an-ai).
- **First real test once Supabase/Vercel exist**: upload one real
  Revit-exported glTF/GLB + IFC pair and confirm the tap-to-inspect flow
  actually works — this validates (or disproves) the two biggest
  unverified assumptions from Session 2, before building anything further
  on top of them.
- **Unresolved**: the second ("Other") primary use case selected alongside
  "client presentation tool" during roadmap planning — the actual text
  wasn't captured. Needs confirming with the product owner before
  prioritizing anything past Phase 1, in case it changes scope.
- **Not yet tested**: whether client-side IFC parsing (`web-ifc`) is fast
  enough on real mid-range phones — needs profiling before Phase 1 ships;
  fallback is a server-side pre-process (IFC → lighter JSON + glTF).
- **Known, deliberate Phase 1 gap**: the Supabase `projects` table allows
  open `INSERT` from the public anon key (no architect login exists yet).
  Must be closed with real auth before any public launch — see
  `web/supabase/schema.sql` and
  [`../roadmap/decisions.md`](../roadmap/decisions.md).
