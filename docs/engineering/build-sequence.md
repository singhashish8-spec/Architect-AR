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
12. Define the Supabase schema: a `projects` table (id, name, model file
    URL, IFC file URL, scale preset, created_at) — no migrations framework
    needed yet at this size, just the SQL run once via Supabase's editor,
    committed to `web/supabase/schema.sql` for the record.
13. Build `services/projectService.ts` — CRUD functions wrapping Supabase
    calls, per the "only `services/` talks to Supabase" rule (see
    [`folder-structure.md`](folder-structure.md)).
14. Build the upload flow: a simple page where a glTF/GLB (+ IFC, if
    present) gets uploaded to Supabase Storage and a `projects` row is
    created, with the scale preset chosen from the dropdown (see
    [`../features/model-scale-presets.md`](../features/model-scale-presets.md)).
15. Build `viewer/ModelViewer.tsx` (R3F scene: load the glTF, apply the
    scale preset to initial camera framing).
16. Build `ifc/useIfcElementData.ts` (load + parse the IFC file with
    `web-ifc`, expose a lookup-by-express-ID function — see
    [`../features/element-data-inspection.md`](../features/element-data-inspection.md)).
17. Wire click/tap picking in the R3F scene to that lookup, rendering a
    data panel component.
18. Add the `<model-viewer>` AR handoff alongside the R3F viewer, with
    `ar-scale="fixed"` set from the same scale preset.
19. Build the shareable link page (`pages/ProjectView.tsx`, route
    `/p/:projectId`) that ties all of the above together for a client.
20. Manually test on a real Android phone: upload a real Revit-exported
    model, open the link, confirm AR handoff and tap-to-inspect both work.
21. **Add a new `history/sessions/` entry** — this is Phase 1's "definition
    of done" moment (see [`definition-of-done.md`](definition-of-done.md)),
    worth its own entry.
