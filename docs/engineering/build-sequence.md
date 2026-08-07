# Step-by-step build sequence

> Part of [`engineering/`](README.md). Literal, in order. Each numbered
> step is small enough to be one commit (see
> [`git-workflow.md`](git-workflow.md)). This is
> [`../roadmap/phases.md`](../roadmap/phases.md)'s Phase 0 and the start of
> Phase 1, made executable.

## Phase 0
1. Create Supabase project (dashboard, manual step — record the project
   URL and anon key somewhere the next session can find, e.g. a note in
   the next `history/sessions/` entry, **never the keys themselves**).
2. Create Vercel project, connect it to this GitHub repo, set the root
   directory to `web/`.
3. Scaffold the Vite project: `npm create vite@latest web -- --template react-ts`.
4. Install dependencies: `three`, `@react-three/fiber`, `@react-three/drei`,
   `@google/model-viewer`, `web-ifc`/`@thatopen/components`,
   `@supabase/supabase-js`.
5. Install dev dependencies: ESLint + `typescript-eslint` +
   `eslint-plugin-react-hooks`, Prettier, Vitest + `@testing-library/react`.
6. Set up the folder structure from
   [`folder-structure.md`](folder-structure.md) (empty directories with a
   `.gitkeep` or a first real file each, whichever comes first naturally).
7. Write `.env.example` (see [`environment.md`](environment.md)), configure
   `.gitignore` for `.env.local`.
8. Write `.github/workflows/ci.yml` running the four checks from
   [`quality-gates.md`](quality-gates.md).
9. Confirm `npm run dev`, `npm run build`, `npm run lint`,
   `npm run typecheck`, `npm test` all run clean on the empty scaffold.
10. Push, open a PR, confirm CI is green and the Vercel preview deploys.
11. **Add a new `history/sessions/` entry** for this session before moving
    to Phase 1.

## Phase 1 (start)

Steps 12–19 were built in
[Session 2](../history/sessions/2026-08-06-session-02.md), **ahead of**
Supabase/Vercel existing (writing the code doesn't need live credentials,
only running it does) — flagged `✅ written` rather than `✅ done`, since
none of it has run against real data yet. Step 20 is the actual
verification and is still fully open.

12. ✅ written — Supabase schema (`projects` table + RLS +
    `get_project()` RPC) at `web/supabase/schema.sql`. Not yet run against
    a real Supabase project.
13. ✅ written — `services/projectService.ts`.
14. ✅ written — `pages/UploadProject.tsx`.
15. ✅ written — `viewer/ModelViewer.tsx`. Note: applies the scale preset
    as an actual model transform (`visualScale()`), not just camera
    framing — see
    [`../features/model-scale-presets.md`](../features/model-scale-presets.md)
    for why that distinction matters.
16. ✅ written — `ifc/useIfcElementData.ts` (+ `ifc/loadIfcModel.ts`,
    `ifc/ifcPropertyLookup.ts`). Unverified against a real IFC file — see
    [`../features/element-data-inspection.md`](../features/element-data-inspection.md).
17. ✅ written — picking wired in `viewer/ModelViewer.tsx`, rendering
    `components/ElementDataPanel.tsx`.
18. ✅ written — `viewer/ARHandoff.tsx`.
19. ✅ written — `pages/ProjectView.tsx`.
20. **Not done — the actual verification step.** Requires the Supabase
    project + a real Android phone, neither of which exist yet (see
    [`../history/status.md`](../history/status.md)). This is where the
    biggest unverified assumption — whether the glTF exporter used
    preserves each element's IFC GlobalId in its node name — actually gets
    tested. Do this before building anything further on top of steps
    12–19.
21. **Add a new `history/sessions/` entry** — this is Phase 1's "definition
    of done" moment (see [`definition-of-done.md`](definition-of-done.md)),
    once step 20 actually passes.
