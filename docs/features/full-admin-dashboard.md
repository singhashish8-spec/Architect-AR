# Feature: full admin dashboard

> Part of [`features/`](README.md). Phase 3. Status: **project + model
> management built and shipped (2026-08-09), then reshaped into a
> multi-page, GitHub-repo-style dashboard the same day** based on real
> owner feedback after using it — see
> [`analytics-and-admin-dashboard.md`](analytics-and-admin-dashboard.md)
> for what Phase 2 already had (view analytics, the passcode gate).
> **Still open**: richer analytics (per-visit history, CSV export, a
> chart) and the storage-usage tracker — see Open questions below.

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

**Model management**
- Add a model, replace its file, rename it, change its scale, edit its
  note, reorder via "move up"/"move down" buttons (not drag-and-drop —
  simpler, no new dependency, same result for a handful of models per
  project), delete it. A project always keeps at least one model — the
  UI blocks deleting the last one.

## What's still open (not built)

**Analytics, upgraded**
- Per-visit history, not just the aggregate numbers already shown — a
  real list of individual views with timestamp and duration.
- A simple views-per-day chart per project.
- Export one project's history, or everything, as CSV.

**Storage tracker**
- "X GB of Y GB used" with a progress bar. Needs a real number from the
  owner for the "out of Y GB" denominator — not something this app can
  know on its own. Not yet provided (owner said "not sure/other" when
  asked which Supabase plan they're on) — ask again, or point to
  Supabase's own project settings page, when this gets built.

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

## Open questions

- The real storage-plan limit for the progress bar's denominator — still
  needs a number from the owner.
- Exact shape of the analytics history view (a table vs. a chart-first
  layout) — not decided, revisit when that round starts.
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
