# Where things stand right now

> Part of [`history/`](README.md). Unlike the rest of this folder, this
> file is meant to be *overwritten* each session to reflect current state
> — not appended to. Kept in sync with
> [`../roadmap/decisions.md`](../roadmap/decisions.md) for the authoritative
> live list of open questions.

Last updated: **2026-08-09**, end of Session 5. **Supabase is live and
the app is running against a real backend for the first time.** Phase 1
is fully proven end-to-end (Session 4). Phase 2 is in progress: five
features shipped this session (multiple models, passcode links,
levels/rooms navigation, category/discipline visibility, model lighting),
real live usage found and fixed five real bugs along the way.

- **`main` and PR #2 still run two different apps.** Gemini's simpler
  paste-a-URL version is live on `main`/`architect-ar.vercel.app`. This
  project's fuller build is on PR #2, which has its own live Vercel
  preview. Formally still unreconciled, but all new work continues on
  PR #2 — treat it as the active direction. See
  [`sessions/2026-08-07-session-03.md`](sessions/2026-08-07-session-03.md).
- **Phase 1 (the MVP) is fully built and confirmed working end-to-end on
  real data** — upload, shareable link, AR placement, and tap-to-inspect
  all tested live on a genuine Revit-exported building. See
  [`sessions/2026-08-08-session-04.md`](sessions/2026-08-08-session-04.md).
- **Phase 2 order** (owner's call, 2026-08-09): multiple models per
  project → passcode-protected links → levels/rooms navigation →
  branding (moved last — no usable logo file yet). Lighting presets and
  richer data browsing/search from the original Phase 2 scope are still
  unstarted.
  - **Multiple models per project** — built. See
    [`../features/multiple-models-per-project.md`](../features/multiple-models-per-project.md).
    Not yet re-tested live since the SQL bugs below were fixed.
  - **Passcode-protected links** — built. See
    [`../features/passcode-protected-links.md`](../features/passcode-protected-links.md).
    Same caveat — not yet re-tested live post-fix.
  - **Levels and rooms navigation** — built and verified against real
    data in this session's own sandbox (a real bug in the type-name
    casing assumption was caught and fixed before ever telling the owner
    to test it). See
    [`../features/levels-and-rooms-navigation.md`](../features/levels-and-rooms-navigation.md).
    Not yet tested by the owner on the live app. **A real scale bug was
    found and fixed** — the "jump" distance used a fixed real-world-unit
    floor that silently dominated at any scale other than 1:1, so every
    room jump landed at roughly the same distance regardless of size.
  - **Category and discipline visibility** — built. See
    [`../features/category-and-discipline-visibility.md`](../features/category-and-discipline-visibility.md).
    Architecture/Structure categorization verified live against real
    data (a real bug was found and fixed here too — the first version
    surfaced IFC bookkeeping entities like "PropertySet" as if they were
    physical-element categories). MEP sub-discipline detection
    (Plumbing/Fire/HVAC/etc.) is NOT verified against real MEP data —
    owner's explicit choice to ship now, verify once a real MEP export
    exists.
  - **Confirmed a real technical limit, not a gap**: neither camera
    focus nor hidden categories can carry into "View in AR" — Scene
    Viewer/Quick Look always re-fetch the original, complete, unmodified
    file with no page context passed along (confirmed by reading
    `<model-viewer>`'s own intent-building code). True persistent/filtered
    AR needs the custom AR camera view already scoped for Phase 4.
  - **A significant production-only bug was found and fixed**: the
    category panel worked perfectly in `npm run dev` but was silently
    empty in the real deployed (production/minified) build — reproduced
    by building and serving the production bundle locally, not just
    testing against the dev server. Cause: production minification
    renames `web-ifc`'s dynamically-generated IFC entity classes, so
    `line.constructor.name` (which the category classification relied
    on) returned meaningless mangled names instead of real IFC type
    names. Fixed with `getLineTypeName()`, a WASM-backed lookup immune to
    minification (the same mechanism the levels/rooms feature already
    used, which is exactly why *that* feature was never affected).
    **Standing lesson recorded in the feature doc**: verify anything
    IFC-type-name-dependent against `npm run build` + `npm run preview`,
    not just the dev server.
  - **Levels & rooms UI reworked twice** based on owner feedback: first
    from an always-expanded list (too long to scroll) to a native
    `<select>` dropdown, then from that `<select>` (which opens as a
    jarring full-screen picker on Android) to a small anchored panel
    matching the category panel's own style — both panels now sit side
    by side, top-right, with icon-only buttons on narrow screens and
    icon+label on wider ones (matching GitHub's own responsive header
    button pattern). Every level and discipline is collapsed by default
    now too, opened with a small chevron, and both toggle buttons got
    icons matched to what they do (layers for Levels, filter/funnel for
    Categories).
  - **Model lighting** — built. See
    [`../features/model-lighting.md`](../features/model-lighting.md).
    Added environment lighting so PBR materials (glass, glossy furniture)
    reflect light instead of rendering flat. First attempt (a built-in HDR
    preset fetched from an external CDN) was caught and dropped before
    shipping — verifying it against a real production build showed the
    fetch could hang indefinitely and blank the *entire* model, not just
    the lighting. Shipped a procedural `<Lightformer>`-based environment
    instead: no network dependency at all, verified to visibly improve
    material realism against the real Duplex sample.
  - **Confirmed AR mode's camera/hidden-category limit is a real technical
    ceiling, not a gap**: read `<model-viewer>`'s own Scene Viewer intent
    code directly — it only ever carries `mode`/`file`/display flags, no
    page state — so neither a room-focused camera nor hidden categories
    can carry into AR as things stand. True persistent/filtered AR needs
    the custom AR camera view already scoped for Phase 4.
- **Real live testing surfaced and fixed real bugs, five in total** —
  see [`sessions/2026-08-09-session-05.md`](sessions/2026-08-09-session-05.md)
  for the full story on each:
  1. `vercel.json` missing a SPA-fallback rewrite (`/local` 404'd).
  2. `gen_salt(unknown) does not exist` — pgcrypto lives in Supabase's
     `extensions` schema, not `public`.
  3. `column reference "id" is ambiguous` in `get_project()` — a
     `RETURNS TABLE` output column name collided with a table column.
  4. The "View in AR" button was rendering a full second copy of the
     model in its corner box — fixed by keeping `<model-viewer>` mounted
     off-screen and driving AR from a normal button instead.
  5. Production minification silently broke IFC category classification
     (`line.constructor.name` returned mangled names in the built
     bundle) — fixed with a WASM-backed type-name lookup immune to
     minification; caught by testing against a real production build,
     not just the dev server, which is now this codebase's standing
     practice for anything IFC-type-name-dependent.
  Also added `utils/errorMessage.ts` so future failures show their real
  reason instead of a generic message, and gave the app real visual
  styling for the first time (it had been raw unstyled HTML throughout).
- **Code**: `web/` (PR #2) has upload flow (now multi-model + optional
  passcode), Supabase schema (now `projects` + `project_models` +
  passcode support), R3F viewer with scale-aware model transform and
  camera jump-to, `<model-viewer>` AR handoff, IFC parsing + property
  lookup + spatial-tree navigation, printable QR code export, routing.
  All four quality gates clean — 36 tests, up from 1 at the start of
  Phase 1. The Android `app/` module is still just the inherited default
  template — untouched, as planned (Phase 4).
- **Plan**: fully scoped through Phase 1 (MVP, done) and Phase 2 (in
  progress). See [`../roadmap/`](../roadmap/README.md).
- **Engineering standard, feature specs**: see
  [`../engineering/`](../engineering/README.md) and
  [`../features/`](../features/README.md).
- **Released version**: none yet — nothing has shipped to production. See
  [`../releases/`](../releases/README.md).
- **CI**: confirmed genuinely working — passed on PR #2's latest pushes,
  including a live Vercel preview deployment.

## What's still pending / open

- **Re-test multiple models and passcode-protection live**, now that the
  pgcrypto/ambiguous-id SQL bugs are fixed — create a project with 2+
  models, and separately one with a passcode, through the real upload
  form.
- **Test levels/rooms navigation, category/discipline visibility, and the
  new lighting on the live app** — all verified in this session's own
  sandbox against the real Duplex sample, not yet by the owner.
- **Provide a real logo file** (PNG/SVG, not a chat screenshot) to pick
  branding back up — see [`../roadmap/decisions.md`](../roadmap/decisions.md).
- **Add the Supabase env vars to Vercel's Production environment too**
  (only Preview is configured) — needed before this goes live for real,
  not blocking further testing.
- **Owner's own real export pipeline still untested**: everything proven
  so far has used the public Duplex sample, not the owner's actual
  Revit/SketchUp/Rhino export — a deliberate, deferred choice (owner's
  call, 2026-08-08), not an oversight.
- **Owner decision, still open**: formally reconcile `main` vs. PR #2,
  including whether/how to bring Cloudflare R2 in as the storage layer —
  see [`sessions/2026-08-07-session-03.md`](sessions/2026-08-07-session-03.md)
  and [`../roadmap/decisions.md`](../roadmap/decisions.md).
- **Unresolved**: the second ("Other") primary use case selected alongside
  "client presentation tool" during roadmap planning — the actual text
  wasn't captured.
- **Not yet tested**: whether client-side IFC parsing (`web-ifc`) is fast
  enough on real mid-range phones — fallback is a server-side pre-process
  if needed.
- **Known, deliberate Phase 1 gap**: project creation has no real
  architect login yet — `create_project()`/`project_models` inserts are
  open to anyone holding the public anon key. Must be closed with real
  auth before any public launch — see `web/supabase/schema.sql` and
  [`../roadmap/decisions.md`](../roadmap/decisions.md).
