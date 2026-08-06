# Architect AR — Engineering Guide

> **This is the "how."** [`ROADMAP.md`](../ROADMAP.md) is the *what and
> why* (architecture, phases). [`PROJECT_HISTORY.md`](PROJECT_HISTORY.md)
> is the *log* (what happened, session by session). **This file is the
> standard** — language, tooling, folder structure, git workflow, coding
> conventions, and a literal step-by-step build sequence per phase.
>
> **Follow this file exactly, regardless of which AI assistant or human is
> doing the work.** The entire point of writing this down is that the next
> session — whether it's this same AI, a different one, or a developer —
> produces code that looks like it came from the same team, not a
> different project each time. If a step here turns out to be wrong once
> real building starts, don't quietly deviate: update this file in the
> same session (§8) and record why in `PROJECT_HISTORY.md`, the same
> discipline as the other two docs.

Last updated: **2026-08-06**.

---

## Table of contents

1. [Tech stack (pinned)](#1-tech-stack-pinned)
2. [Repository & folder structure](#2-repository--folder-structure)
3. [Coding conventions](#3-coding-conventions)
4. [Git workflow — branches, commits, pushes, PRs](#4-git-workflow--branches-commits-pushes-prs)
5. [Environment variables & secrets](#5-environment-variables--secrets)
6. [Quality gates — what must pass before merge](#6-quality-gates--what-must-pass-before-merge)
7. [Deployment](#7-deployment)
8. [Step-by-step build sequence](#8-step-by-step-build-sequence)
9. [Definition of done, per phase](#9-definition-of-done-per-phase)
10. [Keeping the three docs in sync](#10-keeping-the-three-docs-in-sync)

---

## 1. Tech stack (pinned)

Every item below is a decision, not a suggestion — deviating from it is a
`PROJECT_HISTORY.md`-worthy event, not a silent choice.

| Layer | Choice | Why |
|---|---|---|
| Language | **TypeScript**, everywhere (frontend and any backend functions) | This project's data shapes (IFC property sets, glTF scene graphs, scale-preset enums, Supabase rows) are complex enough that type-checking catches real bugs before runtime — worth it even though sibling project Budget Tracker uses plain JS. One language end-to-end (TS on the frontend, TS/Deno for Supabase Edge Functions if a backend function is ever needed) — no context-switching between languages. |
| Framework | **React 19 + Vite** | Matches Budget Tracker's toolchain — conventions and tooling knowledge transfer directly. |
| Package manager | **npm** | Matches Budget Tracker (`package-lock.json`). Don't introduce yarn/pnpm — one lockfile convention across both projects. |
| 3D rendering (AR handoff) | **`@google/model-viewer`** | Web component; loads glTF/GLB, ships "View in AR" → Scene Viewer (Android) / Quick Look (iOS). See `ROADMAP.md` §4.1. |
| 3D rendering (custom viewer) | **`three` + `@react-three/fiber` + `@react-three/drei`** | For element picking/raycasting, camera control, section planes — anything `<model-viewer>` doesn't expose. See `ROADMAP.md` §4.1. |
| BIM data parsing | **`web-ifc`** (via `@thatopen/components`) | Parses Revit's native IFC export client-side. See `ROADMAP.md` §4.5. |
| Backend / data | **Supabase** (Postgres + Storage + Auth) | One BaaS covering project metadata, model file storage, and (later) per-client passcodes/auth — no custom server to operate in Phase 1. This is the **default pick**, chosen here to unblock a concrete build sequence; confirm or override at Phase 0 kickoff (see `ROADMAP.md` §6 open decisions log). |
| Hosting | **Vercel** | Native Vite support, PR preview deploys out of the box, generous free tier. **Default pick**, same caveat as above — confirm/override at Phase 0. |
| Linting | **ESLint** (`typescript-eslint` + `eslint-plugin-react-hooks`) | Budget Tracker uses `oxlint`; this project uses ESLint instead because the TypeScript-aware rule set (unused vars, exhaustive hooks deps, no-floating-promises for Supabase calls) matters more here than raw lint speed. Documented deviation, not an oversight. |
| Formatting | **Prettier** | Default config, no bikeshedding — runs on save / pre-commit, not something to hand-tune. |
| Testing | **Vitest + React Testing Library** | Native Vite integration (shares Vite's config/transform pipeline, unlike Budget Tracker's plain `node --test`), and RTL is the standard for testing React component behavior (e.g. "tapping an element shows its data panel"). |
| CI | **GitHub Actions** | Lint, type-check, test, build on every PR — see §6. |

---

## 2. Repository & folder structure

Everything lives in **this repo** (`Architect-AR`), not a separate one — a
`web/` directory alongside the existing `app/` (Android) directory, so the
Phase 4 native shell and the web app share one history and one set of
docs:

```
Architect-AR/
├── ROADMAP.md
├── docs/
│   ├── PROJECT_HISTORY.md
│   └── ENGINEERING_GUIDE.md        (this file)
├── app/                             Android module — untouched until Phase 4
├── web/                             ← Phase 0 creates this
│   ├── src/
│   │   ├── components/              Reusable, presentation-only UI pieces
│   │   ├── viewer/                  <model-viewer> wrapper + R3F scene/picking/scale logic
│   │   ├── ifc/                     web-ifc loading, property-set lookup by express ID
│   │   ├── pages/                   Route-level screens (one per URL, e.g. /p/:projectId)
│   │   ├── services/                Supabase client, storage upload/download, project CRUD
│   │   ├── state/                   Shared app state (React context/hooks — no Redux; see §3)
│   │   ├── types/                   Shared TypeScript types (Project, ModelAsset, ScalePreset, IfcElementData)
│   │   ├── hooks/                   Custom hooks not tied to one component
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── public/
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── .env.example                 Documented env vars, no real values (see §5)
└── .github/
    └── workflows/
        └── ci.yml                   Lint + typecheck + test + build on every PR
```

Rules:
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

---

## 3. Coding conventions

- **Components**: `PascalCase` filenames and export names
  (`ScalePresetSelector.tsx`).
- **Hooks**: `camelCase`, prefixed `use` (`useIfcElementData.ts`).
- **Non-component modules** (services, utils, types): `camelCase`
  filenames (`projectService.ts`), except `types/` files which may be
  named after the domain concept (`Project.ts`).
- **TypeScript**: `strict: true` in `tsconfig.json`, no exceptions. No
  `any` — if a type is genuinely unknown (e.g. raw IFC property values),
  model it as `unknown` and narrow it, don't silence the checker.
- **State management**: React Context + hooks for shared state (current
  project, selected element, active scale preset). No Redux/Zustand/etc.
  unless a real cross-cutting need appears that Context can't handle —
  don't add a state library speculatively.
- **Styling**: co-located CSS Modules (`ComponentName.module.css`) per
  component. No CSS-in-JS runtime library, no global stylesheet sprawl
  beyond a small `index.css` for resets/tokens.
- **Comments**: same policy as this project's docs — write down *why*,
  never *what*. A comment explaining a non-obvious IFC quirk or a Scene
  Viewer platform gotcha is welcome; a comment restating what the next
  line of code does is not.
- **No premature abstraction**: don't build a plugin system, a generic
  "renderer interface," or config-driven anything until a second concrete
  use case actually needs it. Three similar lines beats a speculative
  abstraction — same standard the rest of this project holds to.
- **Error handling**: only at real boundaries — user input, the Supabase
  network calls, IFC/glTF file parsing (files can be malformed). Don't
  wrap internal function calls in try/catch "just in case."

---

## 4. Git workflow — branches, commits, pushes, PRs

- **Branch naming**: `feature/<short-name>` for new work,
  `fix/<short-name>` for bug fixes, matching whatever the task actually is.
  AI-assisted sessions (like this one) get an auto-generated branch name
  from the harness (e.g. `claude/...`) — that's fine, it's still one
  feature/fix per branch, same rule.
- **One logical unit of work per commit.** Not "one commit per session" —
  if a session builds the IFC loader *and* the scale-preset selector,
  that's two commits, so history stays legible and revertable
  independently.
- **Commit messages**: imperative mood, explain *why* in the body when the
  *what* isn't obvious from the diff (`git log` in this repo so far is the
  reference style — follow it).
- **Push after every commit** (or every small batch, at most a few commits
  behind) — **do not let uncommitted work sit through something risky.**
  This is a direct lesson from `PROJECT_HISTORY.md` §4: the reason this
  whole roadmap exists is that local, uncommitted AR/camera work was lost
  to a crash before it reached GitHub. Don't repeat that pattern — push
  early, push often.
- **PRs**: opened as draft, one per branch, following the repo's
  `PULL_REQUEST_TEMPLATE` if one exists by the time it's needed. Merge only
  after CI is green (§6). Never push straight to `main`.
- **Never force-push `main`**, never `--no-verify`, never skip CI to land
  something faster — if CI is red, fix it or explain why in the PR, don't
  route around it.

---

## 5. Environment variables & secrets

Mirrors Budget Tracker's rule exactly: **no API keys or secrets shipped to
the client.** Since this app is a *hosted website* (not a bundled APK), this
matters even more here — anything in client-side code is visible to anyone
who opens dev tools on the live site.

- `web/.env.example` documents every variable by name with a placeholder,
  committed to the repo. `web/.env.local` (gitignored) holds real values
  locally; the hosting provider's dashboard holds them in production.
- **Client-safe** (Supabase's anon key is designed to be public, gated by
  Row Level Security policies — not a secret in the traditional sense, but
  still only ever read from env, never hardcoded):
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
- **Never client-side**: any Supabase *service role* key, any future
  AI/API-parsing backend key (if Phase 5+ ever needs one — same rule
  Budget Tracker's `aiExtract.js` follows: a backend endpoint holds the
  real key, the client only ever calls that endpoint).

---

## 6. Quality gates — what must pass before merge

Enforced via `.github/workflows/ci.yml` (created in Phase 0, §8), running
on every PR:

1. `npm run lint` — ESLint, zero warnings tolerated on changed files.
2. `npm run typecheck` — `tsc --noEmit`, zero errors.
3. `npm test` — Vitest, all tests pass.
4. `npm run build` — production build must succeed.

Locally, run all four before pushing — CI catching something you could
have caught in 30 seconds locally is wasted round-trip time.

---

## 7. Deployment

- **Production**: pushes to `main` auto-deploy via Vercel's GitHub
  integration (connect the repo once during Phase 0 setup).
- **Preview**: every PR gets its own preview URL from Vercel automatically
  — use it to sanity-check a change (does the AR button actually work on a
  real phone?) before merging, not just CI green.
- **Rollback**: Vercel keeps every deployment addressable — redeploy a
  previous one from its dashboard if `main` ships something broken. No
  custom rollback tooling needed at this scale.
- **Model file storage** (Supabase Storage) is separate from code
  deployment — uploading a new model doesn't require a redeploy.

---

## 8. Step-by-step build sequence

Literal, in order. Each numbered step is small enough to be one commit
(§4). This is Phase 0 and the start of Phase 1 from `ROADMAP.md`, made
executable.

### Phase 0
1. Create Supabase project (dashboard, manual step — record the project
   URL and anon key somewhere the next session can find, e.g. a note in
   `PROJECT_HISTORY.md`'s session entry, **never the keys themselves**).
2. Create Vercel project, connect it to this GitHub repo, set the root
   directory to `web/`.
3. Scaffold the Vite project: `npm create vite@latest web -- --template react-ts`.
4. Install dependencies: `three`, `@react-three/fiber`, `@react-three/drei`,
   `@google/model-viewer`, `web-ifc`/`@thatopen/components`,
   `@supabase/supabase-js`.
5. Install dev dependencies: ESLint + `typescript-eslint` +
   `eslint-plugin-react-hooks`, Prettier, Vitest + `@testing-library/react`.
6. Set up the folder structure from §2 (empty directories with a `.gitkeep`
   or a first real file each, whichever comes first naturally).
7. Write `.env.example` (§5), configure `.gitignore` for `.env.local`.
8. Write `.github/workflows/ci.yml` running the four checks from §6.
9. Confirm `npm run dev`, `npm run build`, `npm run lint`,
   `npm run typecheck`, `npm test` all run clean on the empty scaffold.
10. Push, open a PR, confirm CI is green and the Vercel preview deploys.
11. **Update `PROJECT_HISTORY.md`** with this session's entry before
    moving to Phase 1.

### Phase 1 (start)
12. Define the Supabase schema: a `projects` table (id, name, model file
    URL, IFC file URL, scale preset, created_at) — no migrations framework
    needed yet at this size, just the SQL run once via Supabase's editor,
    committed to `web/supabase/schema.sql` for the record.
13. Build `services/projectService.ts` — CRUD functions wrapping Supabase
    calls, per the "only `services/` talks to Supabase" rule (§2).
14. Build the upload flow: a simple page where a glTF/GLB (+ IFC, if
    present) gets uploaded to Supabase Storage and a `projects` row is
    created, with the scale preset chosen from the dropdown (§2 in
    `ROADMAP.md`).
15. Build `viewer/ModelViewer.tsx` (R3F scene: load the glTF, apply the
    scale preset to initial camera framing).
16. Build `ifc/useIfcElementData.ts` (load + parse the IFC file with
    `web-ifc`, expose a lookup-by-express-ID function).
17. Wire click/tap picking in the R3F scene to that lookup, rendering a
    data panel component.
18. Add the `<model-viewer>` AR handoff alongside the R3F viewer, with
    `ar-scale="fixed"` set from the same scale preset.
19. Build the shareable link page (`pages/ProjectView.tsx`, route
    `/p/:projectId`) that ties all of the above together for a client.
20. Manually test on a real Android phone: upload a real Revit-exported
    model, open the link, confirm AR handoff and tap-to-inspect both work.
21. **Update `PROJECT_HISTORY.md`** — this is Phase 1's "definition of
    done" moment (§9below), worth its own session entry.

---

## 9. Definition of done, per phase

- **Phase 0**: an empty-but-real Vite+TS+React app builds, lints,
  type-checks, and deploys to a live Vercel URL via CI — before any product
  feature exists. If this isn't true, nothing after it should start.
- **Phase 1**: an architect can upload a real Revit export (glTF/GLB + IFC)
  with a chosen scale preset, get a link, and a client can open that link
  on their own phone, view it in AR at the correct scale, and tap an
  element to see its Revit data — all without help. (Same wording as
  `ROADMAP.md`'s Phase 1 definition of done — kept identical on purpose.)
- **Phases 2+**: definition of done is whatever that phase's bullet list in
  `ROADMAP.md` says, until this file gets a matching step-by-step section
  for it (add one when that phase starts, don't write it speculatively now).

---

## 10. Keeping the three docs in sync

- `ROADMAP.md` changes → check whether §1 (tech stack) or §8 (build
  sequence) here need updating to match.
- A step in §8 turns out wrong once real building starts → fix it here,
  in the same session, and note why in `PROJECT_HISTORY.md`.
- A new phase starts → add its step-by-step sequence to §8 before writing
  its first line of code, not after.
- This file, `ROADMAP.md`, and `PROJECT_HISTORY.md` should never
  contradict each other. If they do, that's a bug in the docs — fix it
  immediately, don't leave it for later.
