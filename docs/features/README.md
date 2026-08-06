# Features

> Part of [Architect AR docs](../README.md). One file per major feature,
> written once that feature is scoped enough to build — not speculatively
> ahead of that. A feature spec is more detailed than its mention in
> [`../roadmap/phases.md`](../roadmap/phases.md): it's the concrete
> behavior, requirements, and technical approach for *that one feature*,
> in one place, so whoever builds it (or tests it) doesn't have to
> reconstruct it from roadmap discussion.

## Index

| Feature | Phase | Status |
|---|---|---|
| [Client presentation viewer](client-presentation-viewer.md) | 1 | Scoped, not built |
| [Element data inspection](element-data-inspection.md) | 1 | Scoped, not built |
| [Model scale presets](model-scale-presets.md) | 1 | Scoped, not built |
| [AR walkthrough (motion-sensor)](ar-walkthrough.md) | 4 | Scoped, not started |

## Template for a new feature spec

When a feature gets scoped enough to build, give it a file here with:

- **Status** — one of: scoped / in progress / shipped / deferred.
- **Summary** — one paragraph, what it does and for whom.
- **User story** — "As a(n) ___, I want to ___, so that ___."
- **Requirements** — concrete, testable bullets.
- **Technical approach** — link to the relevant
  [`../roadmap/architecture.md`](../roadmap/architecture.md) section rather
  than repeating it; add feature-specific detail (edge cases, data shapes,
  library APIs used) that the architecture doc doesn't need.
- **Open questions** — anything still unresolved specific to this feature;
  cross-link to [`../roadmap/decisions.md`](../roadmap/decisions.md) if
  it's a project-wide decision, keep it here if it's feature-local.
