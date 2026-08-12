# Where things stand right now

> Part of [`history/`](README.md). Unlike the rest of this folder, this
> file is meant to be *overwritten* each session to reflect current state
> — not appended to. Kept in sync with
> [`../roadmap/decisions.md`](../roadmap/decisions.md) for the authoritative
> live list of open questions.

Last updated: **2026-08-11**, end of [Session 7](sessions/2026-08-11-session-07.md).
The app runs against a live Supabase backend and has been used for real,
by the owner, against their own real project files — not just sample
data. Phase 2 is fully shipped. Phase 3's admin dashboard is fully
built, including analytics and a storage tracker. The Bill of
Quantities (now renamed **Quantity Takeoff**) went through a full real
debugging arc this session and is confirmed working live, then was
redesigned into real per-category schedule tables with a formatted
Excel export and one dashboard-wide company name.

## Right now, in one paragraph

Everything through [Session 5](sessions/2026-08-09-session-05.md) is
covered by its own detailed history there — multiple models per project,
passcode-protected links, levels/rooms navigation, category/discipline
visibility, model lighting, IFC-only upload, a real client share card,
text-only branding, search, the original count-only schedule, and the
first full admin dashboard build, all shipped and live-tested with
several real bugs found and fixed along the way (SPA routing, a Postgres
schema/search-path bug, an ambiguous SQL column, a duplicate-rendered AR
button, a camera-pivot regression that briefly froze the preview page).
[Session 6](sessions/2026-08-10-session-06.md) was a day of polish: four
corner-panel layout bugs found by real clicking, a page that looked
frozen on a real IFC file fixed properly (moved IFC→GLB conversion to a
Web Worker, not just paced on the main thread), and two Phase 3 items
scoped into the roadmap but deliberately left unbuilt (free walk/fly
navigation; camera modes/view presets/a level slicer).
[Session 7](sessions/2026-08-11-session-07.md) closed out the admin
dashboard's last two open items (Analytics tab, storage tracker), then
spent most of the day on the Bill of Quantities — built, reported broken
against a real project, misdiagnosed once, blocked twice by real
environment limits while trying to self-verify, then correctly
diagnosed and fixed, confirmed live, and finally renamed to "Quantity
Takeoff" with a full schedule-style redesign, a formatted multi-sheet
Excel export, and one dashboard-wide company name.

## What's still pending / open

- **Run `supabase/migrations/011_company_branding.sql`** on the live
  Supabase project — the new company-branding header and the Excel
  export's title block will show the "Architect AR" fallback everywhere
  until this runs. See
  [`full-admin-dashboard.md`](../features/full-admin-dashboard.md) and
  [`boq.md`](../features/boq.md).
- **The Excel export has not been opened in a real spreadsheet app** —
  built and unit-tested against the `ExcelJS.Workbook` object directly
  (cell values, sheet names, fills), not yet eyeballed in real Excel/
  Google Sheets/Numbers for real-world formatting. See
  [`boq.md`](../features/boq.md)'s Open questions.
- **Sandboxed headless browser automation is confirmed completely
  unavailable in this dev environment** — don't re-attempt it for future
  live-verification needs; the app's own self-diagnosing "Debug info"
  UI (added this session) is the fallback pattern going forward. See
  [`findings.md`](findings.md).
- **Free walk/fly navigation** and **camera modes/view presets/a level
  slicer** are scoped in [`../roadmap/phases.md`](../roadmap/phases.md)
  but not built.
- **The company branding header was deliberately not added to the 3D
  viewer page** (`pages/ProjectView.tsx`) — it's a full-screen immersive
  viewer with no natural header slot, and the owner's ask was
  specifically about the dashboard and the Quantity Takeoff page.
  Open question whether that should change.
- **A real logo file** (PNG/SVG) is still needed to replace the current
  text-only branding — unchanged since Session 5.
- **`main` and PR #2 still run two different apps** — Gemini's simpler
  paste-a-URL version is live on `main`; this project's fuller build is
  on PR #2. Formally still unreconciled; all new work continues on PR #2.
  See [`sessions/2026-08-07-session-03.md`](sessions/2026-08-07-session-03.md).
- **Known, deliberate gap**: project/model management has no real
  architect login yet — every write goes through an `admin_*()` RPC
  gated by a single shared passcode re-verified server-side, not a real
  per-user auth session. Must be closed before any public launch. See
  `web/supabase/schema.sql` and
  [`../roadmap/decisions.md`](../roadmap/decisions.md).
- **Owner's own real export pipeline still only partially tested** —
  this session's BOQ work was tested against the owner's own real
  structural model for the first time (previous sessions used the public
  Duplex sample); other features (AR handoff, lighting, IFC-only upload)
  are still only proven against the Duplex sample.

## What's built and confirmed working

- **Phase 1 (MVP)**: upload, shareable link, AR placement, tap-to-inspect
  — confirmed end-to-end on a real Revit export. See
  [`sessions/2026-08-08-session-04.md`](sessions/2026-08-08-session-04.md).
- **Phase 2**: multiple models per project, passcode-protected links,
  levels/rooms navigation, category/discipline visibility, model
  lighting + presets, IFC-only upload (now via a Web Worker), a real
  client share card, text-only branding, search/filter. See each
  feature's own doc under [`../features/`](../features/README.md).
- **Phase 3 admin dashboard**: multi-page (list → project page → tabs),
  full project/model CRUD, per-model view stats, an Analytics tab
  (history, chart, CSV export), an account-wide storage usage tracker
  with an owner-editable limit, and now a permanent, editable
  company-branding header on every admin page. See
  [`full-admin-dashboard.md`](../features/full-admin-dashboard.md).
- **Quantity Takeoff** (formerly "Bill of Quantities"): category-specific
  quantities matching how Revit itself organizes a takeoff (walls by
  area, beams by all four dimensions, doors/windows as counts, MEP runs
  by length), level grouping, a standalone page that never touches the
  3D viewer, a CSV export, and a formatted multi-sheet Excel export —
  all confirmed working against the owner's own real project this
  session. See [`boq.md`](../features/boq.md).
- **CI**: confirmed genuinely working, including live Vercel preview
  deployments on every push.

## Every session's own record

| Session | Date | Doc |
|---|---|---|
| 1 | 2026-08-06 | [`sessions/2026-08-06-session-01.md`](sessions/2026-08-06-session-01.md) — roadmap + Phase 0 scaffold |
| 2 | 2026-08-06 | [`sessions/2026-08-06-session-02.md`](sessions/2026-08-06-session-02.md) — Phase 1 code |
| 3 | 2026-08-07 | [`sessions/2026-08-07-session-03.md`](sessions/2026-08-07-session-03.md) — Gemini's divergent push to `main` |
| 4 | 2026-08-08 | [`sessions/2026-08-08-session-04.md`](sessions/2026-08-08-session-04.md) — real IFC sample, BIM correlation fix |
| 5 | 2026-08-09 | [`sessions/2026-08-09-session-05.md`](sessions/2026-08-09-session-05.md) — Supabase live, rest of Phase 2, first admin dashboard |
| 6 | 2026-08-10 | [`sessions/2026-08-10-session-06.md`](sessions/2026-08-10-session-06.md) — corner-panel bug fixes, Web Worker move, roadmap scoping |
| 7 | 2026-08-11 | [`sessions/2026-08-11-session-07.md`](sessions/2026-08-11-session-07.md) — Quantity Takeoff debugging arc, redesign, Excel export, company branding |

See [`findings.md`](findings.md) for cross-session findings worth
remembering beyond the session they happened in.
