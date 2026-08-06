# Where things stand right now

> Part of [`history/`](README.md). Unlike the rest of this folder, this
> file is meant to be *overwritten* each session to reflect current state
> — not appended to. Kept in sync with
> [`../roadmap/decisions.md`](../roadmap/decisions.md) for the authoritative
> live list of open questions.

Last updated: **2026-08-06**, end of Session 1.

- **Code**: none, beyond the inherited default Android Studio template
  (`app/src/main/java/com/singhashish/architectar/MainActivity.kt` — a
  Compose "Hello Android!" screen, nothing else).
- **Plan**: fully scoped through Phase 1 (MVP), with Phases 2–6 sketched at
  a decision level. See [`../roadmap/`](../roadmap/README.md).
- **Engineering standard**: tech stack, folder structure, conventions, and
  a literal Phase 0 / start-of-Phase-1 build sequence are all defined. See
  [`../engineering/`](../engineering/README.md). The next session can start
  executing `engineering/build-sequence.md` step 1 directly.
- **Feature specs**: written for the features already scoped — see
  [`../features/`](../features/README.md).
- **Open PR**: [#1](https://github.com/singhashish8-spec/Architect-AR/pull/1)
  (draft) on `claude/app-crash-camera-access-y74pyp`, containing all docs.
  Not yet merged.
- **Nothing has been built, deployed, or tested** — Phase 0 (stand up the
  actual Vite + React project) has not started.

## What's still pending / open

- **Unresolved**: the second ("Other") primary use case selected alongside
  "client presentation tool" during roadmap planning — the actual text
  wasn't captured. Needs confirming with the product owner before
  prioritizing anything past Phase 1, in case it changes scope.
- **Not yet confirmed**: BaaS/storage provider and hosting provider —
  defaults are set (Supabase, Vercel) but not yet confirmed by the owner;
  new-repo-vs-new-directory is decided (same repo, `web/` directory). All
  tracked in [`../roadmap/decisions.md`](../roadmap/decisions.md).
- **Not yet tested**: whether client-side IFC parsing (`web-ifc`) is fast
  enough on real mid-range phones — needs profiling before Phase 1 ships;
  fallback is a server-side pre-process (IFC → lighter JSON + glTF).
- **Not started**: Phase 0 itself (standing up the actual project).
