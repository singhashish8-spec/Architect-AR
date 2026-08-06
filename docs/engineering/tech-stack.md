# Tech stack (pinned)

> Part of [`engineering/`](README.md). Every item below is a decision, not
> a suggestion — deviating from it is a
> [`../history/`](../history/README.md)-worthy event, not a silent choice.

| Layer | Choice | Why |
|---|---|---|
| Language | **TypeScript**, everywhere (frontend and any backend functions) | This project's data shapes (IFC property sets, glTF scene graphs, scale-preset enums, Supabase rows) are complex enough that type-checking catches real bugs before runtime — worth it even though sibling project Budget Tracker uses plain JS. One language end-to-end (TS on the frontend, TS/Deno for Supabase Edge Functions if a backend function is ever needed) — no context-switching between languages. |
| Framework | **React 19 + Vite** | Matches Budget Tracker's toolchain — conventions and tooling knowledge transfer directly. |
| Package manager | **npm** | Matches Budget Tracker (`package-lock.json`). Don't introduce yarn/pnpm — one lockfile convention across both projects. |
| 3D rendering (AR handoff) | **`@google/model-viewer`** | Web component; loads glTF/GLB, ships "View in AR" → Scene Viewer (Android) / Quick Look (iOS). See [`../roadmap/architecture.md`](../roadmap/architecture.md#frontend-and-viewer-architecture). |
| 3D rendering (custom viewer) | **`three` + `@react-three/fiber` + `@react-three/drei`** | For element picking/raycasting, camera control, section planes — anything `<model-viewer>` doesn't expose. |
| BIM data parsing | **`web-ifc`** (via `@thatopen/components`) | Parses Revit's native IFC export client-side. See [`../features/element-data-inspection.md`](../features/element-data-inspection.md). |
| Routing | **`react-router-dom`** | Needed for the shareable link route (`/p/:projectId`, see [`../features/client-presentation-viewer.md`](../features/client-presentation-viewer.md)). Missed in the original stack pin — added here when Phase 1 actually needed it, rather than left implicit. The standard choice for client-side routing in a Vite + React app; nothing about this project's requirements (a handful of routes, no nested layouts of note) calls for anything heavier. |
| Backend / data | **Supabase** (Postgres + Storage + Auth) | One BaaS covering project metadata, model file storage, and (later) per-client passcodes/auth — no custom server to operate in Phase 1. This is the **default pick**, chosen to unblock a concrete build sequence; confirm or override at Phase 0 kickoff (see [`../roadmap/decisions.md`](../roadmap/decisions.md)). |
| Hosting | **Vercel** | Native Vite support, PR preview deploys out of the box, generous free tier. **Default pick**, same caveat as above. |
| Linting | **ESLint** (`typescript-eslint` + `eslint-plugin-react-hooks`) | Budget Tracker uses `oxlint`; this project uses ESLint instead because the TypeScript-aware rule set (unused vars, exhaustive hooks deps, no-floating-promises for Supabase calls) matters more here than raw lint speed. Documented deviation, not an oversight. |
| Formatting | **Prettier** | Default config, no bikeshedding — runs on save / pre-commit, not something to hand-tune. |
| Testing | **Vitest + React Testing Library** | Native Vite integration (shares Vite's config/transform pipeline, unlike Budget Tracker's plain `node --test`), and RTL is the standard for testing React component behavior (e.g. "tapping an element shows its data panel"). |
| CI | **GitHub Actions** | Lint, type-check, test, build on every PR — see [`quality-gates.md`](quality-gates.md). |
