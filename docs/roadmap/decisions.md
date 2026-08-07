# Roadmap — open decisions log

> Part of [`roadmap/`](README.md). Keep this current — add a row every time
> a decision gets made or a question gets raised, don't let it go stale.

| Question | Status |
|---|---|
| What was the second ("Other") primary use case selected alongside "client presentation tool"? | **Unresolved** — confirm with product owner |
| How should element data survive Revit export (IFC vs glTF `extras`)? | **Decided: IFC**, parsed client-side with `web-ifc` — see [`architecture.md`](architecture.md#element-data-pipeline-ifc) |
| How fine-grained should per-model scale control be? | **Decided: preset dropdown**, standard architectural scales (1:1–1:1000), set once at import — see [`architecture.md`](architecture.md#model-scale-presets) |
| Should motion-sensor walk-through ship in Phase 1 or Phase 4? | **Decided: Phase 4**, alongside the custom native AR build — see [`phases.md`](phases.md#phase-4--native-shell-for-on-site-ar) |
| BaaS/storage provider (Supabase vs Firebase vs custom) | **Reopened 2026-08-07**: a separate Gemini session set up **Cloudflare R2** for object storage directly, without Supabase. Superseded by the reconciliation decision below — see [`history/sessions/2026-08-07-session-03.md`](../history/sessions/2026-08-07-session-03.md) |
| Hosting provider (Vercel vs Netlify vs Cloudflare Pages) | **Decided and live**: Vercel — set up during the Gemini session (`architect-ar.vercel.app`), connected to `main`. Currently serving Gemini's simpler app, not PR #2 — see reconciliation decision below |
| **Reconcile `main` (Gemini's live, simpler paste-a-URL version on Cloudflare R2) with PR #2 (this project's fuller Phase 1: BIM data, scale presets, shareable links, tests)** | **Unresolved, blocks further building** — see [`history/sessions/2026-08-07-session-03.md`](../history/sessions/2026-08-07-session-03.md) for the full assessment and [`history/status.md`](../history/status.md) |
| Unlisted-link vs passcode sharing for Phase 1 | Recommended: unlisted for Phase 1, passcode in Phase 2 |
| New repo vs new directory in this repo for the web app | **Decided and done**: same repo, `web/` directory — scaffolded in Session 1's Phase 0 execution, see [`engineering/folder-structure.md`](../engineering/folder-structure.md) |
| Is client-side IFC parsing fast enough on real mid-range phones? | Not yet tested — profile before Phase 1 ships; fallback is server-side pre-processing (see [`features/element-data-inspection.md`](../features/element-data-inspection.md)) |
| Who's allowed to create a project (upload a model)? | **Known Phase 1 gap, not decided**: currently open to anyone with the public anon key (no architect login exists yet). Must be closed with real auth before any public launch — see `web/supabase/schema.sql` and [`history/sessions/2026-08-06-session-02.md`](../history/sessions/2026-08-06-session-02.md) |
| Does the glTF exporter used actually preserve each element's IFC GlobalId in the node name? | **Unverified** — the tap-to-inspect feature's correlation between the glTF scene and the IFC data assumes this. Needs testing against a real Revit export before trusting the feature works; see [`features/element-data-inspection.md`](../features/element-data-inspection.md) |
