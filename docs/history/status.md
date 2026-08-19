# Where things stand right now

> Part of [`history/`](README.md). Unlike the rest of this folder, this
> file is meant to be *overwritten* each session to reflect current state
> — not appended to. Kept in sync with
> [`../roadmap/decisions.md`](../roadmap/decisions.md) for the authoritative
> live list of open questions.

Last updated: **2026-08-19**, [Session 11](sessions/2026-08-19-session-11.md).
**Phase 4's native AR walkthrough is now implemented and build-verified**
(free walkthrough only — print-anchored AR still not started): a real
Capacitor Android shell wrapping the existing web app, with a genuine
ARCore + SceneView Activity for plane detection, tap-to-place, and free
physical walk-through, bridged to `ProjectView`'s existing AR button so it
picks the native experience when available and falls back to the Phase 1
`<model-viewer>` handoff otherwise. This was built, tested, and shipped
autonomously per the owner's own explicit instruction to decide and
execute without check-ins. **Not verified**: real device AR
tracking/placement behavior (this sandbox has no camera/display) or
Play Store publishing (needs the owner's own developer account). A
debug-signed APK is committed at `releases/architect-ar-debug.apk` for
the owner's own hands-on test. See
[Session 11](sessions/2026-08-19-session-11.md) and
[`../features/ar-walkthrough.md`](../features/ar-walkthrough.md).

Before that: the app runs against a live Supabase backend and has been
used for real, by the owner, against their own real project files — not
just sample data. Phase 2 is fully shipped. Phase 3's admin dashboard is
fully built. Large-file (R2) upload plumbing, the resumable-multipart
rebuild, and the redesigned upload UI (one shared progress bar with real
byte counts, one merged drag-and-drop file picker) are **confirmed
working end-to-end on a real device** — a real FBX (native Revit export)
uploaded through the real app UI, project "NSE." The company-branding
header is on every page in the app, styled to match the share card's
"HSA" mark rather than plain text. [Session 10](sessions/2026-08-15-session-10.md)
also included a long architecture discussion (not code): researched and
ruled out Autodesk Platform Services/NWC and Lumion as export sources,
corrected a real misattribution (real FBX textures come from Revit's own
native export, not Twinmotion, which the owner doesn't have), found a
real undocumented gap (tap-to-inspect doesn't work for a
separately-exported FBX + IFC pair), and logged seven new
proposed-but-unbuilt directions — a pyRevit "one-click export + upload"
extension, GLB compression, real-time multi-user collaboration,
Quest/Vision Pro AR support via WebXR, richer location/OS/browser
analytics, a 360°-photo walkthrough mode, and Gaussian Splatting for site
capture — the last four found while reviewing a competitor product on the
owner's own request. Also compared cloud/hosting providers in real depth
(AWS, Azure, GCP, Cloudflare, Oracle, Hetzner, DigitalOcean) and found
Oracle's free compute tier was just cut, relevant to the still-unbuilt
background-conversion-service idea from Session 9.

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
[Session 8](sessions/2026-08-12-session-08.md) migrated model/IFC
uploads to Cloudflare R2 after finding Supabase Free's fixed 50 MB
upload cap, fixed a real Vercel deploy-time ESM bug along the way, and
built full FBX upload support with real textures/materials after an FBX
file crashed the IFC parser mid-testing.
[Session 9](sessions/2026-08-14-session-09.md) was a long live-debugging
arc getting that R2 upload actually working on the real deployed app —
three unrelated failures deep (Vercel Deployment Protection blocking the
app's own API route; a placeholder credential that survived four "fixed
it" rounds because every redeploy targeted the wrong branch; a real
mobile upload failing at the direct-PUT step, with CORS explicitly ruled
out) — then, after the owner proposed a background server-side
conversion service as a bigger follow-up, rebuilt the upload path itself
around chunked/resumable multipart upload (four new endpoints, per-part
retry, a real progress bar) as the immediate fix for the mobile failure.
[Session 10](sessions/2026-08-15-session-10.md) found and fixed a real
CORS gap (`ETag` not exposed) before the owner's next real test, then
redesigned the whole upload UI per the owner's own live-testing
feedback: one shared progress bar with real byte counts (replacing three
separate bar components), one merged drag-and-drop file picker
(replacing two separate file inputs), and the company-branding header
added to every remaining page, including the full-screen 3D viewer — a
real FBX upload (project "NSE") then confirmed the whole rebuilt
pipeline actually works. The header was corrected again the same
session, to match the share card's styled "HSA" mark instead of plain
text. The rest of the session was architecture discussion, not code:
found a real undocumented tap-to-inspect gap (a separately-exported FBX
doesn't correlate with a separate IFC file); researched and ruled out
Autodesk Platform Services (NWC/Forge) and Lumion as export sources;
corrected a real misattribution (real FBX textures come from Revit's own
native export, not Twinmotion, which the owner doesn't have); reviewed a
competitor product (AR Code) end to end and logged four ideas worth
keeping (Quest/Vision Pro AR, richer analytics, a 360°-photo walkthrough,
Gaussian Splatting); compared cloud/hosting providers in depth and found
Oracle's free compute tier was just cut; and logged seven new
proposed-but-unbuilt directions into the roadmap in total — a pyRevit
"one-click export + upload" extension, GLB compression, real-time
multi-user collaboration, and the four from the competitor review.

## What's still pending / open

- **Real-device AR verification** — the native AR walkthrough (Session
  11) is build-verified only. Plane detection quality, tracking
  robustness, and placement accuracy on a real device all need the
  owner's own hands-on test with `releases/architect-ar-debug.apk`.
- **Print-anchored AR, iOS, and Play Store publishing** are all still
  not started — see [`../roadmap/phases.md`](../roadmap/phases.md)'s
  Phase 4 entry and [`../features/ar-walkthrough.md`](../features/ar-walkthrough.md).
  Publishing specifically needs the owner's own Google Play Console
  account (this session has no access to it).
- **`ArScalePreset.kt` is a manual Kotlin port** of `ScalePreset.ts`'s
  scale math, not shared code — if the web-side presets ever change,
  this file needs a matching edit or the native and web AR views will
  silently disagree on model size.
- **The FBX+IFC tap-to-inspect correlation gap** — a separately-exported
  FBX (visual model) and a separate IFC file (property data) for the
  same building don't correlate at all today; tapping an element on the
  textured model silently shows no data for everything. Quantity Takeoff
  is unaffected (reads the IFC directly). Documented, not fixed — needs
  a real design decision (geometry-matching heuristic, or richer export
  tooling). See
  [`findings.md`](findings.md) and
  [`../features/fbx-upload.md`](../features/fbx-upload.md).
- **Seven new directions proposed 2026-08-15, none built or formally
  scoped**: a pyRevit extension for one-click export + upload (a
  separate software project, not part of this web app's own codebase),
  GLB compression, real-time multi-user collaboration in the viewer,
  AR viewing on Meta Quest/Apple Vision Pro via WebXR, richer
  location/OS/browser analytics, a lightweight 360°-photo walkthrough
  mode, and Gaussian Splatting for real-site capture (the last four
  found while reviewing a competitor product, AR Code, at the owner's
  request). Of these, Quest/Vision Pro AR support and the analytics
  enhancement are the cheapest and most realistic to build soon.
  Autodesk Platform Services (NWC/Forge) was researched and deliberately
  parked, not pursued, given unconfirmed pricing/fidelity and no
  glTF/GLB output. See
  [`../roadmap/decisions.md`](../roadmap/decisions.md) and
  [`../roadmap/phases.md`](../roadmap/phases.md).
- **Cloud/hosting provider comparison done in depth 2026-08-15** (AWS,
  Azure, GCP, Cloudflare, Oracle, Hetzner, DigitalOcean) — found Oracle's
  Always Free compute tier was just cut (halved in June 2026, oversized
  instances being terminated starting 2026-08-18); if the still-unbuilt
  background-conversion-service idea (Session 9) ever moves forward, size
  it to Oracle's new smaller limit, or budget for Hetzner (~$4.50/month)
  as the cheapest paid alternative.
- **No cross-session workflow exists** between this session (the web
  app) and the owner's separate Claude Desktop session (connected to
  Revit via MCP) — raised, not designed. This session has no visibility
  into that other session and cannot reach the owner's PC directly.
- **A background, server-side conversion service is proposed but not
  designed or built** — owner's idea: upload raw files to R2, convert
  in the background on a server (not the client) with live progress/ETA
  on the dashboard, then pick a ready processed file from a catalog UI.
  Needs new infrastructure (a persistent worker; Oracle Cloud's
  "Always Free" VM flagged as the likely host). Scoped as a follow-up
  after the upload-reliability fix above. See
  [`../roadmap/decisions.md`](../roadmap/decisions.md).
- **A temporary Vercel API token was used this session** to diagnose and
  fix the redeploy/credential issue (checking env var metadata and
  deployment history, triggering one correct redeploy) — the owner was
  asked to revoke it after use; not confirmed whether that happened yet.
- **A handful of small test objects were written to the real R2 bucket**
  during diagnosis (`connectivity-test.txt` through
  `connectivity-test-6.txt`, `cors-test.txt`) — harmless, worth deleting
  from the `archar` bucket whenever convenient.
- **FBX upload is confirmed working end-to-end on a real device**
  (2026-08-15, project "NSE") — the upload/conversion/storage pipeline
  is proven; whether textures specifically render correctly, and
  whether the textures on/off toggle behaves right, are still not
  separately confirmed (this environment cannot run headless browser
  automation to check that itself). See
  [`../features/fbx-upload.md`](../features/fbx-upload.md).
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

- **Phase 4 native AR walkthrough** (free walkthrough only): a Capacitor
  Android shell with a real ARCore + SceneView Activity for plane
  detection, tap-to-place, and free physical walk-through, bridged to the
  existing web app. Build-verified (compiles, unit tests pass) — not yet
  hands-on verified on a real device. See
  [`../features/ar-walkthrough.md`](../features/ar-walkthrough.md).
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
- **Large file storage (Cloudflare R2)**: presign → PUT → GET round trip
  confirmed working end-to-end (2026-08-14); the upload path was then
  rebuilt around chunked/resumable multipart upload with a real progress
  bar and a merged drag-and-drop file picker, and **confirmed working
  end-to-end on a real device** (2026-08-15, project "NSE," a real FBX
  upload through the real app UI).

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
| 8 | 2026-08-12 | [`sessions/2026-08-12-session-08.md`](sessions/2026-08-12-session-08.md) — Cloudflare R2 migration, FBX upload with real textures |
| 9 | 2026-08-14 | [`sessions/2026-08-14-session-09.md`](sessions/2026-08-14-session-09.md) — R2 live-debugging arc, mobile upload reliability, background-processing decision |
| 10 | 2026-08-15 | [`sessions/2026-08-15-session-10.md`](sessions/2026-08-15-session-10.md) — CORS `ETag` fix, unified progress bar, merged drag-and-drop file picker, branding header on every page |
| 11 | 2026-08-19 | [`sessions/2026-08-19-session-11.md`](sessions/2026-08-19-session-11.md) — Phase 4 native AR walkthrough built and shipped autonomously (Capacitor shell, ARCore/SceneView, debug APK) |

See [`findings.md`](findings.md) for cross-session findings worth
remembering beyond the session they happened in.
