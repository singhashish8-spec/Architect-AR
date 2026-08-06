# Release process

> Part of [`engineering/`](README.md). How and when to cut a versioned
> release, and where its documentation lives — every AI assistant or
> developer follows this exactly, the same discipline as the rest of this
> section.

## Where release docs live

[`../releases/`](../releases/README.md) — **one file per version**, named
`vMAJOR.MINOR.PATCH.md` (e.g. `v0.1.0.md`), indexed in
[`../releases/README.md`](../releases/README.md). Same reasoning as
`history/sessions/` being a folder instead of one file: a release log that
gets appended to forever eventually becomes unreadable. It does **not**
live inside `history/` — see "Relationship to `history/sessions/`" below
for why they're different things kept apart on purpose.

## Versioning scheme

[Semantic Versioning](https://semver.org/) (`MAJOR.MINOR.PATCH`):

- **Start at `0.1.0`** for the first version actually deployed to
  production (see [`deployment.md`](deployment.md)) — likely end of Phase 0
  or early Phase 1, whichever first reaches a live URL a client could open.
- **MINOR bump**: a new user-facing feature ships (e.g. element data
  inspection goes live, or scale presets go live).
- **PATCH bump**: a fix, no new feature.
- **MAJOR bump (`1.0.0` and beyond)**: reserved for when the **product
  owner** considers the app ready for real, unsupervised client use — a
  business call, not a technical milestone. Don't bump MAJOR unilaterally;
  if a session thinks a release feels "1.0-worthy," raise it as a question
  rather than deciding it.

## When to cut a release

Any merge to `main` that **deploys to production** and **changes
user-facing behavior** gets a release entry. Docs-only changes, or work
that hasn't reached `main`/production yet, don't get one — that's what
[`../history/sessions/`](../history/README.md) is for instead.

## What a release file must contain

- **Title**: `# vX.Y.Z — <short name>`, with the date on the line under it.
- **The ask / reason** — what prompted this release: a phase milestone, a
  specific request from the product owner, a bug that needed shipping
  urgently.
- **What's new** — a bullet list, linking to the relevant
  [`../features/`](../features/README.md) spec for detail rather than
  repeating it here.
- **How it works** — brief, user-facing usage notes (or just a link, if a
  feature doc already covers it well).
- **Known limitations** — what's deliberately not included yet, so a client
  or future session doesn't mistake a gap for a bug.
- **Links** — the PR(s)/commit range that shipped it, the git tag, and the
  [`../history/sessions/`](../history/README.md) file(s) where the actual
  work happened.

## Git tagging

Tag the commit on `main` that the release corresponds to:

```
git tag vX.Y.Z
git push origin vX.Y.Z
```

The tag and the release file should always point at the same commit —
don't write the release file speculatively before the tag exists, and
don't tag without a matching release file.

## Relationship to `history/sessions/`

A **session** is a unit of *work* — it may include false starts, decisions,
docs-only changes, exploration that goes nowhere. A **release** is a unit
of *shipped, versioned product*. Many sessions won't produce a release; one
release might span several sessions. Cross-link both ways:

- A release file lists which session(s) did the work.
- A session file that ships a release says so explicitly (see the
  "Shipped this session" pattern already used in
  [`../history/sessions/2026-08-06-session-01.md`](../history/sessions/2026-08-06-session-01.md))
  and links to the new `releases/vX.Y.Z.md`.
