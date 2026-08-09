# Feature: full admin dashboard

> Part of [`features/`](README.md). Phase 3. Status: **scoped in detail,
> not started.** Deliberately deferred past Phase 2's initial `/admin` —
> see [`analytics-and-admin-dashboard.md`](analytics-and-admin-dashboard.md)
> for what's already built (view analytics, the passcode gate).

## Summary

Phase 2 shipped `/admin` as a read-only stats page — view counts, last
viewed, average time on page, one row per project. This feature turns it
into an actual project management console: create, edit, and delete
projects and their models without touching the public upload form or
SQL directly, richer analytics (per-visit history, CSV export, a chart),
and a storage-usage tracker. Scoped across several conversations with
the owner (2026-08-09) once the read-only version shipped and the
obvious next question came up: "now that I can see the numbers, why
can't I also manage the projects from here?"

## User story

As the architect, I want `/admin` to be the one place I manage
everything — adding new projects, updating a design's model when it
changes, cleaning up old ones, and seeing real usage — instead of using
the public upload form for creation and having no way at all to edit or
remove something once it exists.

## Requirements

**Project management**
- Create a project directly from `/admin` (same fields the public
  upload form has).
- Edit a project's name/description after creation.
- Set, change, or remove a project's passcode after creation — today a
  passcode can only ever be set once, at creation.
- Delete a project (and its uploaded files) — with a confirmation step,
  since this isn't undoable.
- Duplicate a project as a starting point for a similar one.
- "Preview as client" — open a project exactly as a client would, from
  within admin.
- Status tags (e.g. Active / Sent to client / Archived) to organize a
  growing list.
- Search, sort (by date/most-viewed), and bulk-select projects for
  delete/export.

**Model management** (within a project)
- Add a new model to an existing project, or add several at once,
  without recreating the whole project.
- Replace a model's file (swap in a revised design).
- Rename a model, change its scale preset, remove it.
- Reorder models (drag up/down) — `project_models.sort_order` already
  exists in the schema for this, just has no UI yet.
- A short note per model (e.g. "final", "client requested changes").

**Analytics, upgraded**
- Per-visit history, not just the aggregate numbers already shown — a
  real list of individual views with timestamp and duration.
- A simple views-per-day chart per project.
- Sort the project list by most/least viewed.
- Export one project's history, or everything, as CSV.

**Storage tracker**
- "X GB of Y GB used" with a progress bar, so the owner can see usage
  against their Supabase plan's storage limit at a glance.

## Technical approach

**New admin-gated RPCs, following the existing pattern exactly**: every
write this feature needs (create/edit/delete a project, add/edit/
delete/reorder a model) goes through a new `SECURITY DEFINER` RPC that
takes `p_passcode` and re-verifies it via `verify_admin_passcode()`
before doing anything — the same shape `get_admin_stats()` already
uses. None of this can lean on `project_models`' existing anon INSERT
policy (that policy only covers the public upload flow's *creation*
path; there's no anon UPDATE/DELETE policy on either `projects` or
`project_models` today, deliberately, so an admin-only write path needs
its own explicitly-gated functions rather than a broader RLS policy that
would let anyone with the anon key edit/delete any project).

**A real question worth deciding when this gets built**: once creation
also works from `/admin`, does the public upload form (open to anyone
holding the anon key — a known Phase 1 gap, see
[`../roadmap/decisions.md`](../roadmap/decisions.md)) still need to
exist at all, or does project creation move behind the admin passcode
entirely? Not deciding now — revisit once this is actually being built.

**Deleting a project must also delete its storage files**, not just the
database rows — `project_models.model_url`/`ifc_url` point into the
`project-files` Supabase Storage bucket; a DB-only delete would leave
orphaned files accumulating forever (directly relevant to the storage
tracker below).

**Storage tracker**: `storage.objects` isn't otherwise readable by the
anon role, so this needs its own `SECURITY DEFINER` RPC (passcode-gated,
same pattern) summing object sizes for the `project-files` bucket. The
"out of Y GB" denominator is whatever the owner's actual Supabase plan's
storage limit is — not something this app can know on its own; needs a
real number from the owner (or Supabase's own API, if it exposes plan
limits) once this is built, not guessed.

**Analytics history/CSV**: `get_admin_stats()` already aggregates
`project_views` per project; per-visit history needs a second RPC
(`get_admin_view_history(p_passcode, p_project_id)`) returning raw rows
instead of aggregates. CSV export itself is pure client-side formatting
of data already fetched — no new backend needed for that part.

## Open questions

- Exact edit-mode UX for model management (a modal per model vs. an
  inline "bulk edit" table for the whole project at once) — not decided,
  revisit when this starts.
- Whether to keep a version history when a model file is replaced (so a
  bad re-upload can be rolled back) vs. simple overwrite — flagged as a
  possible "later" addition, not in this feature's initial scope.
- The real storage-plan limit for the progress bar's denominator — needs
  a number from the owner, not assumed.
- Whether project creation should move behind the admin passcode
  entirely once this ships — see Technical approach above.
- Not otherwise detailed further — revisit and flesh out exact RPC
  signatures/schema changes when this phase actually starts, rather than
  over-specifying now.
