# Architect AR — Documentation

Start here. Docs are organized by category so each piece of information has
one home and stays a reasonable size as the project grows — rather than a
handful of ever-growing single files.

## Reading order for a new (or returning) session

1. **[`roadmap/`](roadmap/README.md)** — what this app is, what to build,
   and why. Start here for the product/architecture picture.
2. **[`history/`](history/README.md)** — every session, every decision and
   why, every finding, current status. Read this for the *story* of how
   the plan above came to be, and what's actually shipped vs. still open.
3. **[`engineering/`](engineering/README.md)** — the literal standard:
   tech stack, folder structure, git workflow, conventions, and a
   step-by-step build sequence. Follow this exactly, regardless of which
   AI assistant or developer is doing the work.
4. **[`features/`](features/README.md)** — one spec per major feature,
   written once that feature is scoped enough to build.
5. **[`glossary.md`](glossary.md)** — every domain term (IFC, glTF,
   web-ifc, ARCore, etc.) in one place.

## Folder map

| Folder | Answers | Update it when |
|---|---|---|
| `roadmap/` | What are we building, in what order, and why? | The plan or an architecture decision changes. |
| `history/` | What happened, when, and why? Where do things stand right now? | Every session, before moving on. |
| `engineering/` | How, exactly, do we build it — stack, conventions, workflow? | The standard changes, or a build step turns out wrong. |
| `features/` | What does this one feature actually do, in detail? | A feature gets scoped, or its behavior changes. |

## How to keep these docs current

- **Update the relevant file(s) in the same session** that produces a
  decision, a shipped change, or a finding — not "later." A docs folder
  that isn't kept current isn't worth having.
- **Every session gets its own new file** in `history/sessions/`, never
  appended to one shared growing file — that's the whole reason history is
  a folder and not a single file. (Compare the sibling
  [Budget Tracker](https://github.com/singhashish8-spec/Budget-Tracker)
  repo's single-file `docs/PROJECT_HISTORY.md` — 858+ lines and growing,
  from one project alone.)
- **Cross-link, don't duplicate.** If two docs need the same fact, one
  states it and the other links to it. Content living in two places drifts
  out of sync.
- **Don't build ahead of the current phase** (see
  [`roadmap/phases.md`](roadmap/phases.md)) — each phase should ship
  something usable on its own.
- **Write down *why*, not just *what***, especially for any decision that
  reverses a pattern from the sibling Budget Tracker project.
- **Ask, don't guess** on anything only the product owner can decide.
