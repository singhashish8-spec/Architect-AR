# Feature: multiple models per project

> Part of [`features/`](README.md). Phase 2. Status: **built
> (`web/src/pages/UploadProject.tsx`, `ProjectView.tsx`,
> `services/projectService.ts`, `supabase/schema.sql`), unverified
> end-to-end** — needs a real upload of 2+ models through the live app
> before trusting it (see Open questions).

## Summary

One shareable project link can now hold several models instead of exactly
one — e.g. different rooms of the same design, or Design Option A vs
Option B — with a tab-style switcher in the viewer to move between them.
The architect adds as many models as they want at upload time, each with
its own name, glTF/GLB file, optional IFC file, and scale preset.

## User story

As an architect, I want to send a client one link that covers a whole
project's models (say, three room options, or two design alternatives),
rather than sending three separate links, so the client has one place to
compare everything.

## Requirements

- A project has one name and one or more models. At least one model is
  required — there's no such thing as an empty project.
- Each model has its own name (optional at upload — defaults to "Model 1",
  "Model 2", etc. if left blank), its own glTF/GLB file, its own optional
  IFC file, and its own scale preset. Models in the same project can be at
  different scales (e.g. a 1:100 floor plan alongside a 1:1 room
  walkthrough).
- The upload form starts with one model and lets the architect add more
  with a "+ Add another model" button, or remove any but the last one.
- The viewer shows a tab switcher (model names) only when a project has
  more than one model — a single-model project looks exactly as before,
  no empty switcher UI.
- Switching models resets the tap-to-inspect panel — a data panel left
  open from model A shouldn't still be showing after switching to model B.
- The "View in AR" button and the QR code both apply to whichever model is
  currently selected in the switcher (AR) or the project link as a whole
  (QR, which opens the project and lands on the first model — switching
  models is then a client-side action inside the opened link, not a
  separate URL per model).

## Technical approach

**Schema**: `projects` used to hold `model_url`/`ifc_url`/`scale_preset`
directly (Phase 1, one model per project). Phase 2 moves those columns
into a new child table, `project_models`, with a foreign key back to
`projects` and a `sort_order` column so models stay in the order they were
uploaded. See `web/supabase/schema.sql`.

Reads still go through `get_project()`, a `SECURITY DEFINER` RPC (same
enumeration-prevention reasoning as Phase 1 — see
[`../roadmap/architecture.md`](../roadmap/architecture.md#sharing-model))
— now returning the project row joined with a `jsonb` array of its models
in one call, already shaped to match `services/projectService.ts`'s
camelCase types directly, rather than needing a second round-trip per
model.

**Migrating an already-existing Supabase project**: a project created
before this change has data in the old `projects.model_url` shape. Rather
than write a full rollback-safe migration for what is, right now, a single
owner's test data, `web/supabase/migrations/002_multiple_models_per_project.sql`
does a straightforward one-time move: create `project_models`, copy any
existing `projects` row with a `model_url` into it as that project's first
model, then drop the old columns. Run once, by hand, in the SQL editor.

**Frontend**: `UploadProject.tsx` holds an array of in-progress model
drafts (name, files, scale) instead of single fields, uploads each
model's files sequentially at submit time, then calls `createProject()`
with the whole list. `ProjectView.tsx` tracks which model index is
selected and derives the model URL/IFC URL/scale passed into
`ModelViewer`/`ARHandoff`/`useIfcElementData` from that — none of those
three components needed to change, since they already operated on a
single model's data per render; `ProjectView` just re-points them at a
different model on switch.

## Open questions

- **Not yet tested with a real 2+ model upload through the live app.**
  Everything here passed lint/typecheck/tests/build and was reasoned
  through carefully, but (per this project's own standing rule) that's
  not the same as a real end-to-end test — upload a project with at least
  two models and confirm the switcher, AR, and tap-to-inspect all still
  work correctly on each one.
- Whether a client should be able to tell *why* a project has multiple
  models (e.g. a short description per model, not just a name) isn't
  decided — not requested yet, easy to add to `project_models` later if
  wanted.
