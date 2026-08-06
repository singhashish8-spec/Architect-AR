# Repository & folder structure

> Part of [`engineering/`](README.md).

Everything lives in **this repo** (`Architect-AR`), not a separate one — a
`web/` directory alongside the existing `app/` (Android) directory, so the
Phase 4 native shell and the web app share one history and one set of docs:

```
Architect-AR/
├── docs/
│   ├── README.md
│   ├── glossary.md
│   ├── roadmap/
│   ├── history/
│   ├── engineering/                 (this section)
│   └── features/
├── app/                             Android module — untouched until Phase 4
├── web/                             ← Phase 0 creates this
│   ├── src/
│   │   ├── components/              Reusable, presentation-only UI pieces
│   │   ├── viewer/                  <model-viewer> wrapper + R3F scene/picking/scale logic
│   │   ├── ifc/                     web-ifc loading, property-set lookup by express ID
│   │   ├── pages/                   Route-level screens (one per URL, e.g. /p/:projectId)
│   │   ├── services/                Supabase client, storage upload/download, project CRUD
│   │   ├── state/                   Shared app state (React context/hooks — no Redux; see conventions.md)
│   │   ├── types/                   Shared TypeScript types (Project, ModelAsset, ScalePreset, IfcElementData)
│   │   ├── hooks/                   Custom hooks not tied to one component
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── public/
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── .env.example                 Documented env vars, no real values (see environment.md)
└── .github/
    └── workflows/
        └── ci.yml                   Lint + typecheck + test + build on every PR
```

## Rules

- **One component per file**, filename matches the exported component
  (`ModelViewer.tsx` exports `ModelViewer`).
- **`viewer/` and `ifc/` are the only places that touch Three.js/web-ifc
  internals directly** — components consume hooks from these, they don't
  reach into raycasting/parsing logic themselves. This is what keeps the
  Phase 3 (annotations, section planes) and Phase 4 (custom AR) work
  additive instead of a rewrite.
- **No file talks to Supabase directly except `services/`** — components
  and pages call functions exported from `services/`, never `supabase-js`
  directly. Keeps a future backend swap (or Phase 5 direct-CAD-integration
  backend) to one layer, not scattered call sites.
