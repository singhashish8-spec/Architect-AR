# Roadmap — open decisions log

> Part of [`roadmap/`](README.md). Keep this current — add a row every time
> a decision gets made or a question gets raised, don't let it go stale.

| Question | Status |
|---|---|
| What was the second ("Other") primary use case selected alongside "client presentation tool"? | **Unresolved** — confirm with product owner |
| How should element data survive Revit export (IFC vs glTF `extras`)? | **Decided: IFC**, parsed client-side with `web-ifc` — see [`architecture.md`](architecture.md#element-data-pipeline-ifc) |
| How fine-grained should per-model scale control be? | **Decided: preset dropdown**, standard architectural scales (1:1–1:1000), set once at import — see [`architecture.md`](architecture.md#model-scale-presets) |
| Should motion-sensor walk-through ship in Phase 1 or Phase 4? | **Decided: Phase 4**, alongside the custom native AR build — see [`phases.md`](phases.md#phase-4--native-shell-for-on-site-ar) |
| BaaS/storage provider (Supabase vs Firebase vs custom) | **Default set: Supabase** (see [`engineering/tech-stack.md`](../engineering/tech-stack.md)) — confirm or override at Phase 0 kickoff |
| Hosting provider (Vercel vs Netlify vs Cloudflare Pages) | **Default set: Vercel** (see [`engineering/tech-stack.md`](../engineering/tech-stack.md)) — confirm or override at Phase 0 kickoff |
| Unlisted-link vs passcode sharing for Phase 1 | Recommended: unlisted for Phase 1, passcode in Phase 2 |
| New repo vs new directory in this repo for the web app | **Decided: same repo**, new `web/` directory — see [`engineering/folder-structure.md`](../engineering/folder-structure.md) |
| Is client-side IFC parsing fast enough on real mid-range phones? | Not yet tested — profile before Phase 1 ships; fallback is server-side pre-processing (see [`features/element-data-inspection.md`](../features/element-data-inspection.md)) |
