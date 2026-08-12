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
| [Client presentation viewer](client-presentation-viewer.md) | 1 | Built, confirmed working end-to-end on a real device with a real Supabase project (2026-08-08) |
| [Element data inspection](element-data-inspection.md) | 1 | Built, confirmed working end-to-end with real data (2026-08-08) — see the feature doc for what's still open |
| [Model scale presets](model-scale-presets.md) | 1 | Built, unverified end-to-end |
| [Multiple models per project](multiple-models-per-project.md) | 2 | Built, unverified end-to-end (no live 2+ model upload test yet) |
| [Passcode-protected links](passcode-protected-links.md) | 2 | Built, unverified end-to-end |
| [Levels and rooms navigation](levels-and-rooms-navigation.md) | 2 | Built, verified against real data (owner hasn't tested live yet) |
| [Category and discipline visibility](category-and-discipline-visibility.md) | 2 | Built; Architecture/Structure verified against real data, MEP discipline detection unverified (no real MEP sample yet) |
| [Model lighting (environment/IBL foundation)](model-lighting.md) | 2 | Built, verified against real data in a real production build |
| [IFC-only upload (auto-converted to a viewable/AR-ready model)](ifc-only-upload.md) | 2 | Built, verified against real data; not yet exercised through a real live Supabase upload |
| [Project share card (QR + link + details, copy/share actions)](project-share-card.md) | 2 | Built, unit-tested; not yet checked against a real live project (no live Supabase credentials in this dev environment) |
| [Text-only branding](text-branding.md) | 2 | Built, verified visually in light and dark mode; waiting on a real logo file to replace it |
| [Lighting presets (daylight/evening/studio)](lighting-presets.md) | 2 | Built, verified against real data in a real production build |
| [Search/filter elements, and schedule/quantity-takeoff view](search-and-schedule.md) | 2 | Search built, verified against real data. The schedule half was superseded 2026-08-11 by [Bill of Quantities](boq.md) |
| [Bill of Quantities (BOQ)](boq.md) | 2/3 | Built (2026-08-11); unit-tested, not yet checked against a real live IFC file's own units/materials |
| [View analytics + admin dashboard](analytics-and-admin-dashboard.md) | 2 | Built, unit-tested, gate UI checked in a real production build; stats not yet checked against a real live Supabase project |
| [Full admin dashboard (project/model management, upgraded analytics, storage tracker)](full-admin-dashboard.md) | 3 | Built and shipped — project/model management (2026-08-09), then richer analytics + storage tracker (2026-08-11) |
| [Large file storage (Cloudflare R2)](large-file-storage.md) | 2/3 | Built (2026-08-12); quality-gate-clean, not yet confirmed with a real end-to-end upload (owner's Cloudflare setup still in progress) |
| [FBX upload with real textures/materials](fbx-upload.md) | 2/3 | Built (2026-08-12); unit-tested against mocked loaders, not yet verified against a real browser or a real textured FBX file (no browser automation available in this session's sandbox) |
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
