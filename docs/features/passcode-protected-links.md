# Feature: passcode-protected links

> Part of [`features/`](README.md). Phase 2. Status: **built
> (`web/supabase/schema.sql`, `services/projectService.ts`,
> `components/PasscodeGate.tsx`), unverified end-to-end** — needs a real
> test of both the open (no passcode) and protected paths through the
> live app before trusting it (see Open questions).

## Summary

An architect can optionally set a passcode when creating a project. A
link with no passcode set behaves exactly as it always has — anyone with
the link can open it, no extra step. A link with a passcode set shows a
"enter passcode" screen before revealing anything about the project, and
only proceeds to the viewer once the correct passcode is entered.

## User story

As an architect sharing a design with a specific client, I want to
optionally protect that link with a passcode, so that the link alone
isn't enough for it to end up in the wrong hands (forwarded, guessed,
found in browser history on a shared device).

## Requirements

- Passcode is optional and project-wide (one passcode covers every model
  in that project, not per-model) — set once at upload time in a single
  field alongside the project name.
- Leaving it blank means the project is open, matching Phase 1's original
  behavior exactly — no behavior change, no extra click, for anyone not
  using this feature.
- A client hitting a protected link sees a passcode-entry screen, not the
  viewer, the model, or the project's name — nothing about the project is
  revealed before the passcode is accepted.
- A wrong passcode shows "Incorrect passcode. Try again." — the same
  response as if the project didn't exist at all is used at the network
  level (see Technical approach), so a wrong guess can't be used to
  confirm a project id is real.

## Technical approach

**Hashing, not plain text.** The passcode is never stored or transmitted
in plain text past the moment it's set. `projects.passcode_hash` holds a
bcrypt hash (Postgres's `pgcrypto` extension, `crypt(passcode,
gen_salt('bf'))`), computed **inside** a `SECURITY DEFINER` function —
originally `create_project()`, since renamed to `admin_create_project()`
when project creation moved behind the admin passcode (see
[`full-admin-dashboard.md`](full-admin-dashboard.md)) — this is the
*only* way to create a project (there's no direct anon `INSERT` policy
on `projects`), so the hashing step can't be bypassed by inserting a row
directly. A passcode can also be set/changed/removed after creation via
`admin_set_project_passcode()`, added by that same feature.

**Two-step read**, both via `SECURITY DEFINER` functions (same
enumeration-prevention reasoning as the rest of this project's read path
— see [`../roadmap/architecture.md`](../roadmap/architecture.md#sharing-model)):

1. `project_requires_passcode(id)` — a cheap boolean lookup, called first,
   always. Lets `ProjectView.tsx` decide whether to show the passcode gate
   at all, so a passcode-free project never even flashes a gate on
   screen.
2. `get_project(id, passcode)` — unchanged for a passcode-free project
   (`passcode` argument simply unused). For a protected project, this now
   checks the hash server-side with `crypt()` and returns **zero rows**
   on any mismatch — the exact same response shape as an id that doesn't
   exist. The client can't tell "wrong passcode" apart from "no such
   project" from this call alone; `ProjectView.tsx` only shows "incorrect
   passcode" because it already knows (from step 1) that a project does
   exist and does need one.

**What this does *not* protect**: the model/IFC files themselves live in
a public Supabase Storage bucket (`project-files`, `public = true` — see
the note in `schema.sql`). Passcode-gating covers the `get_project()`
lookup — the thing that turns a link into "here's the model URL and its
data" — but the files' storage URLs, if somehow obtained by another
route, aren't independently gated by the passcode check. Acceptable for
Phase 2 (matches this project's existing accepted no-auth posture), worth
revisiting if this ever needs to survive a genuinely adversarial client.

## Open questions

- **Not yet tested against the live app.** Reasoned through carefully and
  passed lint/typecheck/tests/build, but per this project's own standing
  rule, that's not the same as creating one protected and one open
  project through the real form and confirming both the gate and the
  bypass work correctly.
- Whether a passcode should be able to be changed or removed after a
  project is created isn't decided — not requested yet, there's currently
  no "edit an existing project" flow at all for anything.
