# Where things stand right now

> Part of [`history/`](README.md). Unlike the rest of this folder, this
> file is meant to be *overwritten* each session to reflect current state
> — not appended to. Kept in sync with
> [`../roadmap/decisions.md`](../roadmap/decisions.md) for the authoritative
> live list of open questions.

Last updated: **2026-08-08**, end of Session 4 (real bug found & fixed in BIM correlation logic; a second real bug found & fixed in Vercel routing).

- **`main` and PR #2 still run two different apps.** Gemini's simpler
  paste-a-URL version is live on `main`/`architect-ar.vercel.app`. This
  project's fuller Phase 1 build is on PR #2, which also now has its own
  live Vercel preview (auto-deployed, confirmed working — see
  [`sessions/2026-08-07-session-03.md`](sessions/2026-08-07-session-03.md)).
  Formally still unreconciled, but all new work continues on PR #2 — treat
  it as the active direction.
- **Real, positive AR test happened**: the owner tested the *simple*
  version live on a real phone using the Khronos `DamagedHelmet.glb`
  sample — model loaded, AR placement worked. Confirms the core
  `<model-viewer>` → phone-AR handoff works end-to-end on real hardware.
  Does **not** confirm BIM tap-to-inspect (that feature doesn't exist in
  the version tested).
- **A real bug was found and fixed in the BIM correlation logic** — the
  single biggest open risk in the project. Verified using a genuine
  Revit-exported IFC sample (buildingSMART's "Duplex Apartment" file,
  converted to glTF with the independent open-source IfcOpenShell
  toolkit, not our own code) that a real exporter names glTF nodes using
  the *expanded UUID* form, not the compressed IFC GlobalId form our code
  originally assumed exclusively. Fixed by porting IfcOpenShell's own
  reference compress/expand algorithm (`web/src/ifc/ifcGuid.ts`) and
  making the correlation resolver try both forms
  (`resolveNodeNameToExpressId()` in `ifcPropertyLookup.ts`). All of this
  verified with real extracted data, not invented test fixtures. See
  [`sessions/2026-08-08-session-04.md`](sessions/2026-08-08-session-04.md).
  **Still not proven**: whether the owner's actual export pipeline
  (whatever Revit/SketchUp/Rhino setup they end up using) follows either
  of the two now-supported conventions, or a third one — that still needs
  a real end-to-end test.
- **Code**: `web/` (PR #2) has upload flow, Supabase schema, R3F viewer
  with scale-aware model transform, `<model-viewer>` AR handoff, IFC
  parsing + property lookup (now handling two node-naming conventions),
  printable QR code export, routing. All four quality gates clean — 20
  tests now, up from 1 at the start of Phase 1. The Android `app/` module
  is still just the inherited default template — untouched, as planned
  (Phase 4).
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

- **A second real bug was found and fixed, this time in deployment
  config**: the owner tried to test the BIM correlation fix by navigating
  straight to PR #2's `/local` page on the live Vercel preview and got a
  `404`. Cause: `web/` had no `vercel.json` SPA-fallback rewrite, so any
  client-side route besides the bare `/` 404'd when hit directly (in-app
  navigation worked fine — only direct/bookmarked links to `/local` or
  `/p/:projectId` were affected). Fixed, all four quality gates re-verified
  clean, pushed as `e1abda1`. See
  [`findings.md`](findings.md#finding-pr-2s-vercel-preview-404s-on-any-route-but--session-4).
  **Not yet re-tested by the owner** — the actual BIM tap-to-inspect test
  (upload `Duplex.glb` + `Duplex.ifc` on `/local`) is still unconfirmed.

## What's still pending / open

- **Confirm the BIM tap-to-inspect test now that `/local` loads**: the
  owner still needs to actually tap an element on `/local` with the
  `Duplex.glb`/`Duplex.ifc` pair and confirm real IFC data appears — this
  is the first live confirmation of this session's correlation fix.
- **First real end-to-end test, once Supabase exists**: upload one real
  Revit-exported glTF/GLB + IFC pair (the owner's own export, not a public
  sample) through PR #2's actual upload flow, and confirm tap-to-inspect
  works. This is the one thing that finally answers "does this work with
  MY pipeline" — everything else has been de-risked as much as possible
  without it.
- **Owner decision, still open**: formally reconcile `main` vs. PR #2 (see
  [`sessions/2026-08-07-session-03.md`](sessions/2026-08-07-session-03.md)
  and [`../roadmap/decisions.md`](../roadmap/decisions.md)).
- **Needs the owner, not an AI**: create the Supabase project (or decide
  to bring in Cloudflare R2 instead, per the reconciliation decision) —
  see
  [`sessions/2026-08-06-session-01.md`](sessions/2026-08-06-session-01.md#what-still-needs-the-owner-not-an-ai).
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
