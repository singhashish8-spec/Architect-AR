# Where things stand right now

> Part of [`history/`](README.md). Unlike the rest of this folder, this
> file is meant to be *overwritten* each session to reflect current state
> — not appended to. Kept in sync with
> [`../roadmap/decisions.md`](../roadmap/decisions.md) for the authoritative
> live list of open questions.

Last updated: **2026-08-09**, end of Session 5. **Supabase is live and
the app is running against a real backend for the first time.** Phase 1
is fully proven end-to-end (Session 4). **Phase 2 is now fully built** —
twelve features shipped this session in total (multiple models, passcode
links, levels/rooms navigation, category/discipline visibility, model
lighting + presets, IFC-only upload, project share card, text-only
branding, search/filter, schedule/quantity-takeoff, view analytics +
admin dashboard), real live usage found and fixed six real bugs along
the way. Every item from the original Phase 2 scope in
[`../roadmap/phases.md`](../roadmap/phases.md) is done except a real
logo file (deliberately still text-only branding, waiting on the owner).

- **Phase 3's full admin dashboard: project + model management is now
  built and shipped, then reshaped into a real multi-page dashboard the
  same day based on the owner's own feedback after using it.** First
  version: a single `/admin` page with an expandable "Manage" panel per
  project. After trying it, the owner asked for something closer to a
  real product — click a project to open its own page, tabs (Overview/
  Models/Share/Settings), secondary actions behind a ⋮ menu, a minimal
  list with no button row per row — GitHub's repo-list-then-repo-page
  pattern, explicitly. Rebuilt as `/admin` (list) → `/admin/p/:id`
  (a project's own page) → tabs as real nested routes, sharing one
  passcode + project list via React Router's outlet context. The public
  upload form is still gone entirely; `/` still redirects to `/admin`.
  **Still open**: upgraded analytics (per-visit history, CSV export, a
  chart) and a storage-usage tracker — the real storage-plan-limit
  number is still needed from the owner. See
  [`../features/full-admin-dashboard.md`](../features/full-admin-dashboard.md).

- **A real bug on the public viewer page, found in the same round of
  feedback**: the Levels/Categories/Search/Schedule corner buttons
  visibly reshuffled for about a second after a model loaded, since each
  one independently decided it was ready the moment its own slice of IFC
  data finished parsing, and those slices don't all finish at once.
  Fixed by gating all four behind the same single `ifcLoading` flag so
  they appear together. Two other reports from the same feedback
  (a floating circle on the viewer's right edge; a project rename that
  "did nothing") are recorded as open/unconfirmed in the feature doc —
  the circle doesn't match anything in this app's own code (likely a
  phone/browser UI element, not app-level), and the rename flow worked
  correctly when rebuilt against a mocked backend, so a "Saved ✓"
  confirmation was added to the Settings tab regardless.

- **A second round of admin polish, same day, after the owner tried the
  new multi-page dashboard for real**: a Preview link per model, each
  model's own created date and view count (a new nullable `model_id` on
  `project_views`, migration 009), Models tab rows collapsed to
  one-line summaries instead of always-open forms, the admin containers
  actually centered (they had a `max-width` but no `margin: 0 auto` —
  the "eating space on both sides" report turned out to be a real CSS
  bug, not just "too narrow") and widened, and the Share tab's card now
  follows light/dark theme and centers its content instead of always
  being dark (a new `variant="embedded"` on `ProjectShareCard`, the
  viewer's own popup usage untouched). Answered one question outside the
  code: **why the admin dashboard's share links show "vercel.app"/a
  branch name** (a Vercel/DNS setup task — the app now supports
  `VITE_PUBLIC_SITE_URL` to use a clean domain once one exists, but
  getting that domain is the owner's next step). And **fixed a real bug**
  once the owner clarified a rotation-pivot report was about the
  in-app 3D preview, not AR mode (initially mistaken for the same
  Scene Viewer limitation already on record for AR-plane-locking, since
  the two symptoms sound alike): `OrbitControls` in
  `viewer/ModelViewer.tsx` had never been given an explicit `target`, so
  it defaulted to world origin instead of the model's real center — an
  ordinary, fixable bug in this app's own code, not a native-app limit.
  Fixed by auto-framing the camera around the whole model on load and on
  switching models, verified against the real Duplex sample. See
  [`../features/full-admin-dashboard.md`](../features/full-admin-dashboard.md)
  and [`../roadmap/decisions.md`](../roadmap/decisions.md).

- **That pivot fix shipped with its own regression, caught immediately
  from an owner report ("the preview mode screen is getting frozen")**:
  the new auto-frame-on-load logic needed to fire only once a *new*
  model had actually finished loading, tracked with a `sceneVersion`
  counter bumped from the existing `onSceneReady` callback — but that
  callback was a fresh inline arrow function on every render, and now
  that it also updated state (not just a ref), it re-triggered the
  effect that called it every render, which bumped state again, which
  re-rendered, forever — a genuine infinite render loop, not just a
  wasted effect. Fixed by wrapping the callback in `useCallback` with no
  dependencies. Verified against the real Duplex sample specifically for
  *responsiveness* (timed checks and a real button click both
  immediately after load and several seconds later), not just a
  screenshot, since a screenshot alone wouldn't show a frozen page. See
  [`../features/levels-and-rooms-navigation.md`](../features/levels-and-rooms-navigation.md#addendum-2-the-default-view-before-ever-using-jump-to-also-pivoted-around-the-wrong-point).

- **Three new SQL migrations need running on the live Supabase project**,
  in order:
  1. [`006_project_description.sql`](../../web/supabase/migrations/006_project_description.sql)
     — the optional project description used by the share card.
  2. [`007_analytics_and_admin_dashboard.sql`](../../web/supabase/migrations/007_analytics_and_admin_dashboard.sql)
     — view analytics + the `/admin` dashboard. Admin passcode is set to
     `1234` (owner's choice, 2026-08-09) — that's what unlocks `/admin`;
     change it any time by re-running the file's `insert into
     admin_settings` statement with a different value.
  3. [`008_full_admin_dashboard.sql`](../../web/supabase/migrations/008_full_admin_dashboard.sql)
     — project + model management RPCs, the `status`/`note` columns, and
     closes the old public project-creation path. **Run this before using
     the new "New project"/"Manage" buttons in `/admin`** — without it,
     those calls will fail since the RPCs they need won't exist yet.
  Same one-time-upgrade pattern as the earlier migrations this
  session — run each once in the Supabase SQL editor.
- **The old "QR code" panel is now a fuller share card** — QR code,
  project name, an optional description (fillable once at upload time),
  the plain link, "Copy link", "Copy for email" (pastes as a real
  clickable link, not just bare text), a native "Share…" button
  (WhatsApp/Mail/whatever's installed, where the browser supports it),
  and an always-available "Share via WhatsApp" link. See
  [`../features/project-share-card.md`](../features/project-share-card.md).
  Unit-tested; not yet checked against a real live project (no live
  Supabase credentials in this dev environment) — try it once the
  migration above has been run.

- **Uploading a project no longer requires a separately-exported GLB.**
  Given just an IFC file, the app now builds a real, hostable 3D model
  from the IFC's own geometry in-browser at upload time — see
  [`../features/ifc-only-upload.md`](../features/ifc-only-upload.md).
  Real textures still can't come from IFC (a Revit/IFC limitation, not
  something this works around — the free path for real textures is noted
  in the decisions log below), and this hasn't been tested through a real
  live Supabase upload yet (no live credentials in this dev environment).
  **Shipped with a real bug the owner caught testing the live build**:
  tap-to-inspect, jump-to-room, and category hide/show all silently did
  nothing on an IFC-only-uploaded model (they worked fine on a
  manually-supplied GLB) — the auto-generated model's parts were named
  with the wrong form of each element's IFC GlobalId, and only on the
  wrapping group, not the actual clickable mesh. Fixed and re-verified
  with real interactions (a real click opening real BIM data, a real
  jump reframing the camera, a real category hide removing walls from
  view) — see the feature doc for the full story and the standing lesson
  it left.

- **Rest of Phase 2, all built in the same push**:
  - **Text-only branding** — "Hiten Sethi & Associates" / "HSA" styled
    text (navy/indigo) on the upload form and share card only, per the
    owner's own scoping call, waiting on a real logo file. See
    [`../features/text-branding.md`](../features/text-branding.md).
  - **Lighting presets** — Daylight/Evening/Studio picker on top of the
    environment-lighting foundation from earlier this session. See
    [`../features/lighting-presets.md`](../features/lighting-presets.md).
  - **Search/filter + schedule/quantity-takeoff** — a search box and a
    full counts-per-category list, both isolating and framing matches in
    the 3D view on selection ("show me every door" works exactly as the
    original Phase 2 scope described it). See
    [`../features/search-and-schedule.md`](../features/search-and-schedule.md).
    **Shipped with a real bug, caught by the owner testing on an actual
    phone**: the schedule panel was effectively invisible on mobile — not
    just a visual overlap with the top button row (the obvious part),
    but the panel itself was rendered inside the wrong container and its
    `height: 100%` was collapsing to almost nothing on *every* screen
    size, mobile just made it obvious. Fixed by portaling the panel into
    the same full-size container `ElementDataPanel` already uses — see
    the feature doc for the full story and its standing lesson.
    **That portal fix then caused a follow-on bug**: the owner next
    reported the QR/share button "still overlapping" — the portaled
    panel lands as the *last* DOM child of the page's root container,
    after the QR corner, and with no `z-index` set anywhere, default
    paint order let the panel's dark background cover the QR share card
    whenever both were open. Confirmed with a minimal reproduction
    (screenshotted before/after, since the real page needs live Supabase
    credentials this sandbox doesn't have) and fixed by giving every
    corner control an explicit `z-index: 2` and the slide-in panels
    `z-index: 1`, so layering no longer depends on DOM order. See the
    same feature doc.
  - **View analytics + `/admin` dashboard** — records real page views and
    approximate time-on-page automatically, visible only behind a
    separate admin passcode on a new `/admin` route, never on a
    project's own link. See
    [`../features/analytics-and-admin-dashboard.md`](../features/analytics-and-admin-dashboard.md).
  All verified against real data in real production builds except the
  two that need a live Supabase project to fully exercise (the share
  card and the admin dashboard's actual stats) — see each feature doc's
  Open Questions.

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
- **Test levels/rooms navigation, category/discipline visibility, the
  new lighting, IFC-only upload, search/schedule, and the admin
  dashboard on the live app** — all verified in this session's own
  sandbox against the real Duplex sample (or, for the admin dashboard,
  its passcode gate only), not yet by the owner. IFC-only upload and the
  admin dashboard's actual stats specifically haven't been tested
  through a real live Supabase round-trip at all (no live credentials in
  this dev environment).
- **Run `007_analytics_and_admin_dashboard.sql`** to turn on view
  analytics and unlock `/admin` (passcode `1234`, owner's choice).
- **Provide a real logo file** (PNG/SVG, not a chat screenshot) to
  replace the current text-only branding — see
  [`../roadmap/decisions.md`](../roadmap/decisions.md).
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
