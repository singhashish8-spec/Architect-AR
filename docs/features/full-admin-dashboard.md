# Feature: full admin dashboard

> Part of [`features/`](README.md). Phase 3. Status: **project + model
> management built and shipped (2026-08-09), then reshaped into a
> multi-page, GitHub-repo-style dashboard the same day** based on real
> owner feedback after using it — see
> [`analytics-and-admin-dashboard.md`](analytics-and-admin-dashboard.md)
> for what Phase 2 already had (view analytics, the passcode gate).
> **Richer analytics (per-visit history, chart, CSV export) and the
> storage-usage tracker shipped 2026-08-11** — see the dated section
> near the end of this file for what was built and why.

## Summary

Phase 2 shipped `/admin` as a read-only stats page — view counts, last
viewed, average time on page, one row per project. This feature turns it
into an actual project management console: create, edit, and delete
projects and their models without touching SQL directly, with the
public upload form removed entirely (project creation moved behind the
admin passcode, owner's explicit call). First shipped as a single page
with an expandable "Manage" panel per project; after using it for real,
the owner asked for something closer to a real product — click a
project to open its own page, tabs for the different things you'd do
with it, secondary actions tucked behind a menu — and it was rebuilt
into a proper multi-page dashboard the same day.

## User story

As the architect, I want `/admin` to be the one place I manage
everything — adding new projects, updating a design's model when it
changes, cleaning up old ones, and seeing real usage — instead of using
the public upload form for creation and having no way at all to edit or
remove something once it exists. And I want it to feel like a real
product (GitHub's repo list → repo page → tabs), not one long page.

## What's built

**Pages** (`web/src/pages/admin/`):
- `/admin` — `AdminProjectList.tsx`: a minimal list, one row per
  project (name, status tag, view count). Click a row to open it;
  everything else (Preview, Duplicate, Delete) lives behind a ⋮ menu
  (`components/KebabMenu.tsx`) so the list stays calm. Search, a status
  filter, sort (newest/most viewed), and bulk-select-and-delete live in
  a toolbar above the list.
- `/admin/new` — `AdminNewProject.tsx`: its own full page for creating a
  project (wraps `components/ProjectCreateForm.tsx`), not a panel
  squeezed into the list.
- `/admin/p/:projectId` — `AdminProjectPage.tsx`: one project's own
  page. A header (name, status, the same ⋮ menu) plus **real tabs**,
  each its own route so back/forward and reloading a specific tab both
  work as expected:
  - `AdminProjectOverview.tsx` (index) — read-only summary: description,
    stats, created date, whether a passcode is set, and a quick model
    list.
  - `AdminProjectModels.tsx` — add/replace/rename/delete/reorder/note a
    project's models.
  - `AdminProjectAnalytics.tsx` (added 2026-08-11) — per-visit history
    table, a views-per-day chart, and a CSV export for one project.
  - `AdminProjectShare.tsx` — the same `ProjectShareCard` a client sees
    (QR code, copy link, copy for email, WhatsApp), reachable directly
    from admin instead of needing to open the project's own link first.
  - `AdminProjectSettings.tsx` — name/description/status editing, the
    passcode (set/change/remove — explains plainly why the *current*
    passcode can never be shown, only replaced), and a danger-zone
    delete.

**Project management**
- Create, edit (name/description/status), duplicate, and delete a
  project — deleting also removes its uploaded files, and duplicating
  copies the underlying model/IFC files to fresh Storage paths rather
  than re-pointing at the originals, so deleting the source later can't
  break the duplicate.
- Set, change, or remove a project's passcode any time after creation.
- "Preview" opens a project exactly as a client would, in a new tab. If
  the project has a passcode, admin sees the same gate a client would —
  there's no special bypass, since the plain-text passcode is never
  stored anywhere to bypass with (explained directly in the Settings
  tab's copy, after the owner asked why the current passcode isn't just
  shown).
- Status tags (Active / Sent to client / Archived), search, sort,
  bulk-select for delete.
- **A storage usage panel** (added 2026-08-11) at the top of the project
  list — "X of Y used" with a progress bar, account-wide since Storage
  is one bucket shared by every project. The "Y" limit is owner-editable
  right there ("Edit limit") rather than hardcoded, since the real
  number depends on whichever Supabase plan the owner is on.

**Model management**
- Add a model, replace its file, rename it, change its scale, edit its
  note, reorder via "move up"/"move down" buttons (not drag-and-drop —
  simpler, no new dependency, same result for a handful of models per
  project), delete it. A project always keeps at least one model — the
  UI blocks deleting the last one.
- **Rows are collapsed summaries, not always-open edit forms** — name,
  scale, note, created date, and its own view count on one line, with
  "Preview" (opens that specific model via `/p/:id?model=<modelId>`, see
  below) and "Edit" (expands the full form) alongside. Added after the
  owner reported that with several models ("versions") per project
  becoming normal, always showing every field for every one turned into
  a long scroll.
- **Each model has its own view count and created date now**, not just
  the project-wide aggregate — `project_views` gained a nullable
  `model_id` column (set null, not cascade-deleted, if that model is
  later removed, so the project's own total stays accurate).
  `hooks/useProjectViewTracking.ts` now records a fresh view whenever the
  *active* model changes within a session, not just once per page load —
  switching between two design options is a real view of each, in this
  model. Documented tradeoff: a project's total view count can now be
  higher than its number of distinct page loads, since switching models
  in one visit adds more rows.
- **A per-model "Preview" link**: `pages/ProjectView.tsx` now reads an
  optional `?model=<modelId>` query param (falls back to the first model
  if absent or unrecognized) and keeps it in sync (via `replace`, not
  `push`) when someone manually switches models with the in-viewer tab
  switcher — so the current view is always the one that's actually
  shareable/reloadable, and the Models tab can link straight to one
  specific model.

## What's still open (not built)

Nothing from this feature's original scope remains open — see the
2026-08-11 section near the end of this file for the analytics/storage
work that closed out the last two items. Newer, separately-scoped ideas
(version history on model replace, etc.) are tracked in Open questions
below instead.

## Technical approach

**Admin-gated RPCs, `assert_admin()` + one write function per action**
(`web/supabase/migrations/008_full_admin_dashboard.sql`, mirrored in
`schema.sql`): `admin_create_project`, `admin_update_project`,
`admin_set_project_passcode`, `admin_delete_project`, `admin_add_model`,
`admin_update_model`, `admin_delete_model`, `admin_reorder_models`, and
a richer `get_admin_projects` replacing Phase 2's `get_admin_stats`
(same view-analytics numbers, plus description/status/has_passcode and
each project's full models array in one call). Every write function
calls a shared `assert_admin(p_passcode)` helper that **raises** on a
wrong passcode — deliberately different from `verify_admin_passcode()`
(used for reads), which just returns false/empty, since a write RPC's
caller needs a real error to show, not an ambiguous "did that work?".

**Creation moved entirely behind the admin passcode**: the old
`create_project()` RPC and the "anon can insert project_models" policy
are both dropped. `admin_create_project()`/`admin_add_model()` are now
the only way a `projects`/`project_models` row gets created, and both
re-verify the admin passcode server-side. The `project-files` Storage
bucket's own upload policy is still open to the anon role, deliberately
— there's no real per-role Supabase Auth session to scope Storage writes
to, so "admin-ness" here is a passcode check in a Postgres function, not
a Storage-level identity. What's actually gated now is whether a
database row pointing at an uploaded file can be created at all, not
the upload itself.

**Deleting removes Storage files before the database row**, not via raw
SQL against `storage.objects` — deleting rows there directly does not
reliably delete the underlying file bytes on Supabase's hosted storage.
`services/adminService.ts`'s `removeModelFiles()` calls the real Storage
API (`.storage.from(bucket).remove(paths)`) first; the database delete
only runs after that succeeds, so a failed delete leaves the project
fully intact rather than in a half-deleted state.

**`get_admin_projects()` uses two `left join lateral` subqueries, not
one flat double join** — joining `project_models` and `project_views`
directly in the same query would cross-join every model row against
every view row per project, duplicating entries in the `models` jsonb
array once per view as a side effect. Aggregating each relation
separately avoids that.

**Shared state via React Router's outlet context, not a global store**:
`pages/admin/AdminLayout.tsx` owns the admin passcode and the fetched
project list once, and hands both down to every nested route via
`<Outlet context={...} />` / `useOutletContext()` — `AdminProjectList`,
`AdminProjectPage` (which further re-shares its own found project via a
second, narrower context to its own tabs), `AdminNewProject`. Navigating
between the list, a project's page, and its tabs is all client-side
routing (no full page reload), so this state survives the whole visit.
Deliberately **not** persisted to `sessionStorage`/`localStorage` — a
full browser reload re-shows the passcode gate, an accepted tradeoff for
a solo-architect internal tool rather than a real login system.

**The list is a flat row list, not cards or a table** — a table doesn't
reflow on a phone screen without either clipping columns or trapping
content in a horizontally-scrolled region (found the hard way in the
single-page version, see below); a card-per-project design was tried
next and shipped, but the owner then asked for something closer to a
real product's repo list — name, a status pill, a stat, click straight
through. The current `AdminProjectList.module.css` is a plain
`<div>`-per-row flex list with one divider each, closer to a table's
information density without a table's mobile reflow problem.

**The admin containers were never actually centered** — found from the
owner's "we're still eating space on both sides" report. Checking the
CSS as written: `.card` had a `max-width` but no `margin: 0 auto`, so on
a wide screen it flowed to the *left* edge with all the leftover space
on the right only, not split evenly — a real bug, not just "too
narrow." Fixed by adding explicit centering everywhere it was missing,
and widened the list/project-page containers from 900px to 1280px at
the same time (the old 900px value was itself a leftover from the
single-page version's narrower needs).

**The Share tab now has its own `variant="embedded"` on
`ProjectShareCard`** — the default `variant="popup"` (used unchanged by
`ProjectView.tsx`'s own floating corner card) is deliberately always
dark and left-aligned, because it floats over a live 3D viewport
regardless of the visitor's system theme. Sitting inside a normal admin
page instead, that reasoning doesn't apply — the owner reported it
looking dark in light mode with off-center content. `embedded` follows
the surrounding page's own light/dark tokens and centers everything;
the popup usage is untouched.

**An optional `VITE_PUBLIC_SITE_URL`** (`utils/publicUrl.ts`) lets the
admin Share tab's link use a clean configured domain instead of
`window.location.origin` — whatever host the app happens to be running
on right now, which on a Vercel preview deployment embeds the branch
name and isn't something worth a client seeing. This is a code-side
enabler only; actually getting a clean URL still needs the owner to
point a real domain (or Vercel's own production alias) at the
deployment in Vercel's own settings, and set this variable to it — see
Open questions.

**The viewer's own share popup (the corner "Share this project" button
+ QR card on `ProjectView.tsx`) was removed entirely** on the owner's
request, after initially asking to keep it ("the share in view mode can
stay as itis") in an earlier round of feedback — reversing that. Sharing
a project now only happens from the admin Share tab; a client looking at
an already-shared link no longer sees a share button of their own.
`ProjectShareCard`'s `variant="popup"` styling is now dead code (nothing
renders it with that variant anymore, only `"embedded"` is still used by
the Share tab) but was left in place rather than deleted, since removing
an unused prop value is lower-value cleanup than the actual UI change
requested.

## A real regression, found by testing on an actual phone before this shipped

Building the multi-page version, the button row on the *public viewer*
page (`ProjectView.tsx`/`LocalPreview.tsx`, unrelated to `/admin` itself)
came up in the same round of owner feedback: two screenshots from a real
phone, taken moments apart, showed the Levels/Categories/Search/Schedule
buttons in a different order each time. Root cause: each of those four
panels independently decides it has something to show the moment its own
slice of parsed IFC data is ready (`if (data.length === 0) return null`),
and those slices don't all finish at exactly the same instant — so for
roughly a second after a model loads, buttons were popping into the
corner row one at a time, visibly reshuffling how they wrapped. Fixed by
gating all four behind the same `ifcLoading` flag `ifc/useIfcElementData.ts`
already exposes, so they appear together, once, instead of trickling in.
`LightingPresetPanel` doesn't depend on IFC data at all and was left
outside the gate.

## A different bug hiding behind the AR question

The owner's next message clarified: the rotation-pivot complaint wasn't
about AR mode at all (that part "works ok") — it was about the in-app
3D **preview** (before ever tapping "View in AR"), where rotating felt
like it was pivoting around some point set by Revit, not around the
camera/model. Unlike the AR handoff, this viewer is this app's own code
(`viewer/ModelViewer.tsx`, `@react-three/drei`'s `OrbitControls`) —
fully fixable, not a native-app limitation.

**Root cause, confirmed in the code**: `<OrbitControls ref={controlsRef} />`
was never given an explicit `target` — it defaults to world origin
`(0, 0, 0)`. A Revit export is almost never centered exactly at the
origin (real-world/shared-coordinates survey points routinely put a
building thousands of units away from it), so every rotation *before*
ever using "jump to" a level/room (the one existing feature that already
did move `controls.target`) pivoted around empty space nowhere near the
visible geometry.

**Fixed** by auto-framing the camera around the whole model's bounding
box the moment it actually finishes loading — both on first load and on
switching to a different model within a project. `ModelViewer.tsx` now
tracks a `sceneVersion` counter (bumped each time a model's glTF
Suspense boundary actually resolves, not just when `modelUrl` changes —
`modelUrl` changes immediately on a switch, well before the new file has
loaded, so keying off it directly would frame based on stale/absent
scene data); `CameraRig`'s new effect reacts to that counter, computes
`new THREE.Box3().setFromObject(scene)`, and reuses the same framing
math "jump to" already had (extracted into a shared `frameCameraOnBox()`
helper) to move both the camera and `controls.target` there. Verified
against the real Duplex sample via `/local` (no backend needed) in a
real production build: the building now loads centered in frame, and
dragging to rotate keeps it centered and rotating in place instead of
swinging off toward wherever the old default pivot happened to be.

## Richer analytics + storage tracker (shipped 2026-08-11)

The two items this file had been carrying as "still open" since it was
first written. Both closed out in one pass, since they share the same
shape: a new admin-only read RPC, a service function, and a small UI
surface — no new tables, no new dependency.

**Analytics tab** (`AdminProjectAnalytics.tsx`) — a new
`get_project_view_history()` RPC returns the raw `project_views` rows
for one project (timestamp, duration, model name), newest first, capped
at 500. The existing `get_admin_projects()` RPC already aggregates this
into view_count/last_viewed_at/avg_duration_seconds for the Overview
tab — this is the same table, just not pre-summarized, so the new tab
can show:
- A views-per-day bar chart, last 14 days, zero-filled so a quiet
  project shows a flat baseline instead of compressing to only the days
  that had a visit. Hand-drawn SVG-style `div`s, not a chart library —
  matches this codebase's existing no-new-dependency style (the app
  already hand-draws its own icons rather than pulling in an icon set).
- A scrollable history table (sticky header, `max-height` + `overflow-y`
  so a project with hundreds of visits doesn't push the rest of the tab
  off-screen). The model column only renders when a project actually has
  more than one model — with just one, "which model" is never
  interesting.
- A client-side CSV export (`Blob` + object URL + a hidden, clicked `<a>`
  download) — no server involvement, since the already-fetched rows are
  the entire export.

**Storage tracker** (`StorageUsagePanel`, top of `AdminProjectList.tsx`)
— account-wide, not per-project (Storage is one bucket shared by every
project), so it lives on the project list rather than inside a single
project's page, and reads from a new `get_storage_usage()` RPC. That RPC
sums `storage.objects.metadata->>'size'` directly (Supabase's own
Postgres-backed object-metadata table, part of the `storage` schema
every project already has) filtered to the app's `project-files` bucket,
rather than paginating the client-side Storage `list()` API one folder
at a time — a single indexed `SUM` is far cheaper. The open question this
file had been carrying — "what's the real denominator, the owner isn't
sure which Supabase plan they're on" — got resolved by not guessing:
`admin_settings` gained a `storage_limit_bytes` column (defaults to 1
GiB, Supabase's own free-tier allowance, as a starting point, not a
claim about the owner's actual plan), and the panel has an inline "Edit
limit" control (new `admin_set_storage_limit()` RPC, `assert_admin()`-
gated like every other admin write) so the owner can correct it
themselves from the dashboard the moment they know the real number,
instead of this being a hardcoded value someone has to come back and
change in the SQL editor. The bar switches to a warning color at 90%+
usage.

**Migration**: `web/supabase/migrations/010_richer_analytics_and_storage_usage.sql`,
mirrored into `schema.sql` for fresh installs per this repo's existing
convention (additive columns baked directly into their `CREATE TABLE`,
not left as a separate `ALTER`). **Needs to be run once in the live
Supabase SQL editor** before the Analytics tab or storage panel will
work against real data — it wasn't auto-applied.

## Company branding bar (shipped 2026-08-11)

`AdminLayout.tsx` previously rendered no shared chrome at all above
`<Outlet/>` — every `/admin/*` page built its own `<h1>` independently.
It now wraps every admin route in a slim, sticky `CompanyBrandBar`
showing an account-wide company name, click-to-edit in place (no
separate settings page/route — this bar already appears on every admin
page, so it's also the natural place to change the name). Same
`admin_settings` singleton table as `storage_limit_bytes` above gained a
`company_name` column (`get_company_name()` public/no-passcode,
`admin_set_company_name()` passcode-gated) — see
[`boq.md`](boq.md)'s own dated section for the full story, since the
immediate trigger was replacing a local per-browser "Company name" field
the Quantity Takeoff page's Excel export had grown, with this one
shared, dashboard-wide setting instead. Same migration-mirroring
convention as `010_richer_analytics_and_storage_usage.sql` above:
`web/supabase/migrations/011_company_branding.sql`, needs to be run once
in the live Supabase SQL editor.

## Open questions

- Whether to keep a version history when a model file is replaced (so a
  bad re-upload can be rolled back) vs. the current simple overwrite —
  flagged as a possible "later" addition, not in scope now.
- IFC-only "add model" in the Models tab requires a model file alongside
  the IFC (same as project creation) rather than converting IFC → GLB
  inline the way `ProjectCreateForm.tsx` does for new projects — revisit
  if that turns out to matter in practice.
- **A floating circle the owner spotted on the public viewer page's
  right edge in a screenshot** — checked every corner element in this
  app's own code and found nothing that matches (no absolutely-positioned
  circular element docked to a screen edge anywhere in `ProjectView.tsx`
  or its CSS). Best guess: a phone/browser-level floating UI element
  (e.g. Android's "Circle to Search" handle), not something from this
  app — unconfirmed, waiting on the owner to check whether it's
  draggable or shows up on other apps/sites too.
- **A specific "changing the project name did nothing" report** — could
  not reproduce: rebuilt the exact flow (rename → Save details → does
  the list update?) against a mocked backend and it worked correctly.
  Added a visible "Saved ✓" confirmation next to the Settings tab's save
  buttons regardless, in case the original issue was just "did that
  actually work?" uncertainty rather than a real failure to save.
- **A clean, non-branded share URL** — the app itself can now be
  configured to use one (`VITE_PUBLIC_SITE_URL`, see Technical
  approach), but getting an actual clean domain is a Vercel/DNS task,
  not code: either point a real custom domain at the production
  deployment, or use Vercel's own production URL (no branch name in it)
  instead of a branch-preview URL. Not done yet — owner's next step,
  outside this codebase.
