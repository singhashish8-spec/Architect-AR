# Feature: full admin dashboard

> Part of [`features/`](README.md). Phase 3. Status: **project + model
> management built and shipped (2026-08-09)** — see
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
admin passcode, owner's explicit call). Scoped across several
conversations with the owner (2026-08-09) once the read-only version
shipped and the obvious next question came up: "now that I can see the
numbers, why can't I also manage the projects from here?"

## User story

As the architect, I want `/admin` to be the one place I manage
everything — adding new projects, updating a design's model when it
changes, cleaning up old ones, and seeing real usage — instead of using
the public upload form for creation and having no way at all to edit or
remove something once it exists.

## What's built

**Project management**
- Create a project directly from `/admin` (same fields the old public
  upload form had) — the public upload form is gone; `/` now redirects
  straight to `/admin`.
- Edit a project's name/description/status after creation.
- Set, change, or remove a project's passcode after creation.
- Delete a project (and its uploaded files), with a confirmation prompt.
- Duplicate a project as a starting point for a similar one — copies the
  underlying model/IFC files to fresh Storage paths rather than
  re-pointing at the originals, so deleting the source later can't break
  the duplicate.
- "Preview" — opens a project exactly as a client would, in a new tab.
  If the project has a passcode, admin sees the same gate a client would
  — there's no special bypass, since the plain-text passcode is never
  stored anywhere to bypass with.
- Status tags (Active / Sent to client / Archived).
- Search (by name), sort (newest first / most viewed), and bulk-select
  for delete.

**Model management** (within a project's management panel)
- Add a new model to an existing project.
- Replace a model's file (swap in a revised design) — a plain file
  input per model, not a special "replace" flow.
- Rename a model, change its scale preset, edit its note.
- Reorder models via "move up"/"move down" buttons (not drag-and-drop —
  simpler, no new dependency, same result for a handful of models per
  project).
- A short free-text note per model (e.g. "final", "client requested
  changes").
- A project always keeps at least one model — the UI blocks deleting
  the last one rather than leaving a project with none.

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

## Technical approach (what shipped)

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

**The admin project list is a card list, not a table** — found via
testing on a real 390px mobile viewport (the same lesson
[`search-and-schedule.md`](search-and-schedule.md)'s schedule-panel bug
left behind): a table with this many columns has no way to reflow on a
phone screen without either clipping content or trapping the expanded
per-project editor inside a narrow horizontally-scrolled region. Cards
stack their fields naturally instead, and the expanded
`AdminProjectEditor` renders at the card's own full width.

## Open questions

- The real storage-plan limit for the progress bar's denominator — still
  needs a number from the owner.
- Exact shape of the analytics history view (a table vs. a chart-first
  layout) — not decided, revisit when that round starts.
- Whether to keep a version history when a model file is replaced (so a
  bad re-upload can be rolled back) vs. the current simple overwrite —
  flagged as a possible "later" addition, not in scope now.
- IFC-only "add model" in the admin editor requires a model file
  alongside the IFC (same as project creation) rather than converting
  IFC → GLB inline the way `ProjectCreateForm.tsx` does for new
  projects — revisit if that turns out to matter in practice.
