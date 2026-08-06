# Engineering guide — the "how"

> Part of [Architect AR docs](../README.md). [`../roadmap/`](../roadmap/README.md)
> is the *what and why*. [`../history/`](../history/README.md) is the *log*.
> **This section is the standard** — language, tooling, folder structure,
> git workflow, coding conventions, and a literal step-by-step build
> sequence per phase.
>
> **Follow this exactly, regardless of which AI assistant or human is doing
> the work.** The entire point of writing this down is that the next
> session — whether it's this same AI, a different one, or a developer —
> produces code that looks like it came from the same team, not a
> different project each time. If a step here turns out to be wrong once
> real building starts, don't quietly deviate: update the relevant file
> here in the same session and record why in
> [`../history/`](../history/README.md), the same discipline as the rest of
> the docs.

Last updated: **2026-08-06**.

## Contents

1. [`tech-stack.md`](tech-stack.md) — the pinned stack, and why each choice
   (including every deviation from Budget Tracker's stack).
2. [`folder-structure.md`](folder-structure.md) — repo layout and the rules
   behind it.
3. [`conventions.md`](conventions.md) — naming, TypeScript strictness,
   state management, styling, comments, error handling.
4. [`git-workflow.md`](git-workflow.md) — branches, commits, pushes, PRs.
5. [`environment.md`](environment.md) — env vars and secrets handling.
6. [`quality-gates.md`](quality-gates.md) — what must pass before merge.
7. [`deployment.md`](deployment.md) — production, preview, rollback.
8. [`build-sequence.md`](build-sequence.md) — literal, numbered steps for
   Phase 0 and the start of Phase 1.
9. [`definition-of-done.md`](definition-of-done.md) — per-phase done
   criteria.
10. [`release-process.md`](release-process.md) — versioning scheme, when to
    cut a release, what goes in `../releases/`.
