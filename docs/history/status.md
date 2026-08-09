# Where things stand right now

> Part of [`history/`](README.md). Unlike the rest of this folder, this
> file is meant to be *overwritten* each session to reflect current state
> — not appended to. Kept in sync with
> [`../roadmap/decisions.md`](../roadmap/decisions.md) for the authoritative
> live list of open questions.

Last updated: **2026-08-08**, end of Session 4. **The full Phase 1
pipeline is now confirmed working end-to-end on real data** — real
Supabase-backed upload, a real shareable link, AR placement, and
tap-to-inspect all tested live by the owner on a genuine Revit-exported
building, not a generic sample or a unit test alone.

- **`main` and PR #2 still run two different apps.** Gemini's simpler
  paste-a-URL version is live on `main`/`architect-ar.vercel.app`. This
  project's fuller Phase 1 build is on PR #2, which also now has its own
  live Vercel preview. Formally still unreconciled, but all new work
  continues on PR #2 — treat it as the active direction. See
  [`sessions/2026-08-07-session-03.md`](sessions/2026-08-07-session-03.md).
- **Supabase is now live and connected.** The owner created a Supabase
  project, ran `web/supabase/schema.sql`, and added
  `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` to Vercel's **Preview**
  environment (Production still needs the same two vars — see pending
  list below).
- **Full real end-to-end test, done and confirmed**: the owner uploaded a
  genuine Revit-exported IFC sample (buildingSMART's "Duplex Apartment,"
  converted to glTF with the independent open-source IfcOpenShell
  toolkit) through PR #2's actual upload form — not `/local`, not a
  synthetic test — and got back a real `/p/<id>` shareable link. On that
  link: the model placed correctly in AR on a real phone, and
  tap-to-inspect returned real IFC data (level, elevation, dimensions,
  etc.). This closes out the single biggest open risk the project has had
  since Session 2.
- **Three real bugs found and fixed along the way this session**, all
  verified against real data/config rather than guessed:
  1. **BIM correlation logic** — the original code assumed glTF node
     names always contained the compressed IFC GlobalId; a real exporter
     (IfcOpenShell) actually uses an expanded-UUID form instead. Fixed by
     porting IfcOpenShell's own compress/expand algorithm
     (`web/src/ifc/ifcGuid.ts`) and making the resolver
     (`resolveNodeNameToExpressId()`) try both forms.
  2. **Vercel routing** — `web/` had no `vercel.json` SPA-fallback
     rewrite, so any client-side route besides the bare `/` (like
     `/local`) 404'd when hit directly. Fixed with a catch-all rewrite.
  3. **IFC placeholder values** — the data panel showed junk rows like
     `SerialNumber: SerialNumber`. Confirmed via direct inspection with
     `ifcopenshell` that this is Revit's own exporter writing an unfilled
     field's name as its placeholder value, not a bug in our lookup.
     Added `hasMeaningfulValue()` to filter these out.
  See [`findings.md`](findings.md) for the full story on each, and
  [`sessions/2026-08-08-session-04.md`](sessions/2026-08-08-session-04.md)
  for the session narrative.
- **Also fixed**: the "View in AR" button was getting partially hidden
  behind the phone browser's own toolbar (a `100vh`-on-mobile sizing
  issue). Fixed with `100dvh` + a safe-area-inset offset.
- **Confirmed and explained, not a bug**: tap-to-inspect only works in
  the in-browser 3D view, not inside the native AR camera view (Scene
  Viewer/Quick Look) reached via "View in AR" — that handoff goes to a
  separate OS-level app with no access to our page or its data. Making AR
  itself interactive needs a custom-built AR camera view, already scoped
  for Phase 4 — see
  [`../features/ar-walkthrough.md`](../features/ar-walkthrough.md).
- **Fixed the AR button rendering a second copy of the model**: it was a
  full `<model-viewer ar>` sized to fill its corner box, which always
  renders its own complete 3D scene — a second, redundant render of the
  building, not an icon. Now kept off-screen (only used to call
  `activateAR()`) behind a normal styled button.
- **Gave the app real visual styling for the first time** — every page
  had been raw unstyled HTML. Added light/dark-aware design tokens
  (`src/index.css`) and a shared card/form stylesheet, with matching
  polish on `ProjectView`'s floating AR/QR controls.
- **Code**: `web/` (PR #2) has upload flow, Supabase schema, R3F viewer
  with scale-aware model transform, `<model-viewer>` AR handoff, IFC
  parsing + property lookup (handling two node-naming conventions and
  filtering placeholder values), printable QR code export, routing. All
  four quality gates clean — 24 tests, up from 1 at the start of Phase 1.
  The Android `app/` module is still just the inherited default template
  — untouched, as planned (Phase 4).
- **Plan**: fully scoped through Phase 1 (MVP), with Phase 4's AR
  walkthrough now also covering the print-anchored/QR-triggered vision.
  See [`../roadmap/`](../roadmap/README.md).
- **Engineering standard, feature specs**: see
  [`../engineering/`](../engineering/README.md) and
  [`../features/`](../features/README.md).
- **Released version**: none yet — nothing has shipped to production. See
  [`../releases/`](../releases/README.md).
- **CI**: confirmed genuinely working — passed on PR #2's latest pushes,
  including a live Vercel preview deployment.

- **Phase 2 started**: owner shared HSA branding (logo pending an actual
  file/exact color) and asked to close out the rest of Phase 2 —
  passcode-protected links, multiple models per project, and lighting
  presets, in that priority order after branding. **Multiple models per
  project is built** (`project_models` table, tab switcher in the
  viewer) — see
  [`../features/multiple-models-per-project.md`](../features/multiple-models-per-project.md).
  Not yet live-tested with a real 2+ model upload, and the owner's
  existing Supabase project needs the one-time migration script run
  (`web/supabase/migrations/002_multiple_models_per_project.sql`) before
  this works against their live database.

## What's still pending / open

- **Add the same Supabase env vars to Vercel's Production environment**
  (only Preview is configured so far) — needed before this goes live for
  real, not blocking further testing right now.
- **Owner's own real export pipeline still untested**: everything proven
  so far has used the public Duplex sample, not the owner's actual
  Revit/SketchUp/Rhino export. That's the one remaining "does this work
  with MY files" question — the mechanism is now proven, but not against
  the owner's specific tools.
- **Owner decision, still open**: formally reconcile `main` vs. PR #2,
  including whether/how to bring Cloudflare R2 in as the storage layer
  instead of (or alongside) Supabase Storage — see
  [`sessions/2026-08-07-session-03.md`](sessions/2026-08-07-session-03.md)
  and [`../roadmap/decisions.md`](../roadmap/decisions.md).
- **Unresolved**: the second ("Other") primary use case selected alongside
  "client presentation tool" during roadmap planning — the actual text
  wasn't captured.
- **Not yet tested**: whether client-side IFC parsing (`web-ifc`) is fast
  enough on real mid-range phones — fallback is a server-side pre-process
  if needed.
- **Known, deliberate Phase 1 gap**: the Supabase `projects` table allows
  open `INSERT` from the public anon key (no architect login exists yet).
  Must be closed with real auth before any public launch — see
  `web/supabase/schema.sql` and
  [`../roadmap/decisions.md`](../roadmap/decisions.md).
