# Feature: view analytics + admin dashboard

> Part of [`features/`](README.md). Phase 2. Status: **built, unit-tested,
> and the admin passcode gate checked visually against a real production
> build** — the actual stats (view counts, durations) have not been
> checked against a real live Supabase project (no live credentials in
> this dev environment) — see Open questions.

## Summary

"Did the client open the link, how long did they look" — recorded
automatically for every real project view, visible **only** on a new
`/admin` route behind a single shared admin passcode. Nobody who only
has a project's own shareable link can see its view stats; this was an
explicit requirement from the owner (a prior proposal — showing stats
inline on the project page itself — was turned down specifically because
anyone with the link could then see them too).

## User story

As the architect, I want to know whether a client actually opened the
link I sent them and roughly how long they spent looking, without that
information being visible to the client themselves or to anyone else who
gets hold of the link.

## Requirements

- A view is recorded automatically the moment a project actually,
  successfully loads (not while still checking for a passcode gate, and
  not counted at all if a wrong passcode is entered).
- Approximate time-on-page is tracked for as long as the tab stays open
  and visible.
- `/admin` shows every project with: view count, when it was last
  viewed, and average time on page — gated by one shared admin passcode,
  set once via SQL (see Technical approach), completely separate from
  any individual project's own passcode.
- No view data is reachable from a project's own link or passcode —
  only through `/admin`.

## Technical approach

**New table, `project_views`** (one row per real view) — see
`web/supabase/migrations/007_analytics_and_admin_dashboard.sql` for the
exact SQL to run. No `SELECT` policy at all (same enumeration-prevention
reasoning `projects`/`project_models` already use): reads only ever go
through `get_admin_stats()`, a `SECURITY DEFINER` RPC gated by the admin
passcode.

**Duration tracking, not via `sendBeacon`**: the obvious approach —
record a final duration in a `navigator.sendBeacon` call when the tab
closes — doesn't actually work here: `sendBeacon` can't carry the
`apikey`/`Authorization` headers a Supabase REST/RPC call needs, so
there's no way to make an authenticated call at the exact moment of page
close. Instead, `hooks/useProjectViewTracking.ts` records one view on
load, then sends a duration update every 20 seconds while
`document.visibilityState === 'visible'` — an approximation, not an
exact number, but simple, reliable, and doesn't depend on catching an
unload event that browsers don't guarantee will even fire.

**Single shared admin passcode, not per-user accounts**: this is a
solo-architect tool with no real login system yet (a known, deliberate
Phase 1 gap — see [`../roadmap/decisions.md`](../roadmap/decisions.md)).
Rather than build real auth just for this one dashboard, `admin_settings`
is a single-row table (enforced via a boolean primary key that must be
`true`) holding one bcrypt-hashed passcode, same hashing approach project
passcodes already use. Passcode is set to `1234` (owner's choice,
2026-08-09) — change it any time by re-running the `insert into
admin_settings` statement in the migration with a different value.

**`PasscodeGate.tsx` reused, not duplicated**: it already took an
`onSubmit` callback and handled the wrong-passcode UI; gained optional
`title`/`description`/`submitLabel` props (defaulting to the original
per-project copy, so `ProjectView.tsx`'s existing usage is unaffected) so
`AdminDashboard.tsx` could reuse the exact same form with admin-specific
copy instead of building a second one.

## Open questions

- **Not yet tested against a real live Supabase project.** No live
  credentials in this dev environment. The admin passcode gate's UI was
  confirmed rendering correctly in a real production build; the actual
  recording/reading of stats through a real database round-trip has
  not been exercised. Once the migration is run, try opening a real
  project link, waiting a bit, then checking `/admin` with the real
  passcode.
- **Duration is approximate**, not exact — see the `sendBeacon`
  limitation above. Someone who opens a link and closes the tab within
  the first 20 seconds gets no duration recorded at all (excluded from
  the average via `nullif(duration_seconds, 0)` in `get_admin_stats()`,
  rather than dragging it toward zero).
- **The admin passcode is a single shared secret**, not tied to any
  account — anyone who has it can see stats for every project. Fine for
  a solo-architect tool; would need real per-user accounts if this ever
  needs to support multiple architects who shouldn't see each other's
  numbers.
