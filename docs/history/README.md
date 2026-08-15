# History — the story of how this project got here

> Part of [Architect AR docs](../README.md). If you are a human returning
> after a break, or an AI assistant starting a brand-new chat session with
> no memory of previous conversations, read this section before doing
> anything else. It's the record of every session, every decision made and
> why, every finding (including things that turned out to be broken or
> missing), and where things stand right now.
>
> This mirrors the sibling repo
> [Budget Tracker](https://github.com/singhashish8-spec/Budget-Tracker)'s
> `docs/PROJECT_HISTORY.md` in spirit — same owner, same discipline: **keep
> this current** — but as a folder, one file per session, rather than one
> ever-growing file. See [`../README.md`](../README.md) for why.

## What this app is, in plain English

Architect AR is a **client presentation tool** for architects (and interior
designers, contractors) who work in Revit, SketchUp, or Rhino. The
architect exports a design; a client opens a link on their own phone or
laptop — no install — and can rotate, walk around, view it in AR on their
phone, and **tap any element (a wall, a door, a fixture) to see what Revit
actually knows about it** (family/type, level, material, dimensions).

Full detail — architecture, tech stack, phased build plan — lives in
[`../roadmap/`](../roadmap/README.md). This section is the narrative of how
that plan came to be and stays accurate as work happens; read the roadmap
for *what* to build next, read this section for *why* it's shaped that way.

## How this project is being built

This project is being planned and built through conversation with an AI
assistant (Claude, via Claude Code), the same working style as Budget
Tracker. Each work session:

- Investigates or builds something concrete.
- Surfaces decisions that only the product owner can make (architecture
  tradeoffs, scope calls) and asks rather than guessing.
- Records the outcome in a new file under [`sessions/`](sessions/), and
  updates [`../roadmap/`](../roadmap/README.md) if the plan changed.
- Commits and pushes to the project's designated branch, opening/updating a
  pull request rather than pushing straight to `main`.

## Sessions

| Session | Date | Summary |
|---|---|---|
| [1](sessions/2026-08-06-session-01.md) | 2026-08-06 | Investigated reported camera-crash → found an empty template repo → built the full roadmap, history, and engineering docs, then executed Phase 0 (the `web/` scaffold). Merged as PR #1. |
| [2](sessions/2026-08-06-session-02.md) | 2026-08-06 | Built Phase 1 code (schema, upload flow, viewer, IFC parsing, AR handoff) ahead of Supabase/Vercel existing. Fixed a missed router in the stack pin and several real type-safety gaps. Flags what's still unverified end-to-end. |
| [3](sessions/2026-08-07-session-03.md) | 2026-08-07 | Not a Claude session — Gemini pushed 6 commits directly to `main` (no PR), building a simpler single-page paste-a-URL viewer with `@ts-nocheck` and no BIM/scale/persistence features, but a real live Vercel deployment on Cloudflare R2 storage. `main` and PR #2 have diverged; not yet reconciled. Also: shipped a printable QR code export and captured the Phase 4 print-anchored AR vision. |
| [4](sessions/2026-08-08-session-04.md) | 2026-08-08 | Found and verified a real Revit-exported IFC sample, converted it to glTF with an independent open-source tool, and used it to find + fix a real bug in the BIM tap-to-inspect correlation logic (wrong node-naming assumption) — with tests proving it against real data. Meaningfully de-risks the project's single biggest open question. |
| [5](sessions/2026-08-09-session-05.md) | 2026-08-09 | Owner's Supabase project went live. Shipped three Phase 2 features (multiple models, passcode-protected links, levels/rooms navigation). Real live testing surfaced and fixed four real bugs in a row (Vercel routing, pgcrypto schema, an ambiguous SQL column reference, a duplicate-rendering AR button) — the first session with real end-to-end usage against a live backend, not just a clean first pass. Continued the same day into a full admin dashboard rebuild, per-model stats, and a mobile-only schedule-panel bug plus its own follow-on QR-overlap bug, then a camera-pivot fix that shipped with (and was caught causing) an infinite-render-loop freeze regression. |
| [6](sessions/2026-08-10-session-06.md) | 2026-08-10 | A day of real-usage polish: four corner-panel bugs found by clicking around (panels shoving each other, more than one open at once, wrapping text, rooms with no direct elements not jumping), a "look around from here" camera control, a page that looked frozen on a real IFC file fixed properly by moving IFC→GLB conversion to a Web Worker (a first pacing-only attempt wasn't enough), double-sided rendering for BIM geometry, and two Phase 3 items (free walk/fly navigation, camera modes/view presets/a level slicer) scoped into the roadmap but deliberately left unbuilt. |
| [7](sessions/2026-08-11-session-07.md) | 2026-08-11 | Closed out the admin dashboard's Analytics tab and storage tracker, then spent most of the day on the Bill of Quantities: built, reported broken against the owner's own real project, misdiagnosed once (assumed a thrown exception where the real cause was a silently-empty success), hit two real environment walls while trying to self-verify (sandboxed browser automation completely non-functional; the live deployment behind Vercel's own SSO wall) — handled by building a self-diagnosing in-app "Debug info" panel instead of continuing to imply a live check was possible — then found and fixed the real root cause, confirmed live. Finished with a full rename to "Quantity Takeoff," a real-schedule redesign, a formatted multi-sheet Excel export, and one dashboard-wide company name replacing an earlier per-export text field. |
| [8](sessions/2026-08-12-session-08.md) | 2026-08-12 | A 169 MB IFC upload failing "exceeded the maximum allowed size" turned out to be Supabase Free's own fixed 50 MB cap — migrated model/IFC uploads to a Cloudflare R2 presigned-URL flow instead, hit and fixed a real Vercel deploy-time ESM import bug along the way. Mid-testing, an `.fbx` file crashed the WASM IFC parser (wrong slot, not a bug) — became the same-day owner ask "then make it read fbx too," built into full FBX upload support with real textures/materials and a viewer-side toggle, plus a proactively-caught bundle-size regression fixed via lazy-loading. |
| [9](sessions/2026-08-14-session-09.md) | 2026-08-14 | A long live-debugging arc against the real deployed app, three unrelated failures deep: Vercel's own Deployment Protection blocking the app's own API route (found via direct `curl`, not guesswork), a placeholder R2 credential that survived four rounds of "fixed it" because every redeploy targeted the wrong branch (root-caused via the Vercel API, using a temporary token the owner provided), and a real mobile upload failure at the direct-PUT-to-R2 step that CORS testing ruled out as a CORS problem. Ended with the owner proposing background server-side conversion; agreed to fix upload reliability (resumable multipart) first and scope the background service as a separate follow-up. |
| [10](sessions/2026-08-15-session-10.md) | 2026-08-15 | Found and fixed a real CORS gap (`Access-Control-Expose-Headers: ETag` missing) before asking the owner to re-test the multipart upload rebuild. While testing, the owner asked for a redesigned upload UI — one shared progress bar with real byte counts, one merged drag-and-drop file picker, and the branding header on every page (later corrected to match the share card's styled mark, not plain text) — all built, discussed-before-coding per the owner's own request. A real FBX upload through the real app UI then confirmed the whole pipeline works. The rest of the session was architecture discussion: found an undocumented tap-to-inspect gap between a separately-exported FBX and a separate IFC file; researched and ruled out Autodesk Platform Services (NWC) and Lumion as export sources; corrected a real misattribution (FBX textures come from Revit's own native export, not Twinmotion, which the owner doesn't have); and logged three new proposed directions — a pyRevit one-click export/upload extension, GLB compression, and real-time multi-user collaboration. |

## See also

- [`findings.md`](findings.md) — notable findings and how they changed the
  plan (cross-session; a finding can matter beyond the session it happened
  in).
- [`status.md`](status.md) — where things stand right now, and what's still
  pending. The one file in this folder that's expected to change every
  session, not just gain a new entry.

## Rules of the road for this section

- **Add a new file to `sessions/` every session**, before moving on — don't
  append to an old one. Name it `YYYY-MM-DD-session-NN.md`.
- **Update [`findings.md`](findings.md)** if the session turned up
  something that changed the plan, beyond just "did the planned work."
- **Update [`status.md`](status.md)** at the end of every session — it
  should always reflect *right now*, not a snapshot from whenever it was
  last touched.
- **Update [`../roadmap/`](../roadmap/README.md)** in the same session if a
  decision changes scope, architecture, or phase ordering — history and
  plan must never drift apart.
- **Write down *why*, not just *what***, especially for any decision that
  reverses a pattern from the sibling Budget Tracker project.
- **Commit and push incrementally**, especially before testing anything
  risky on-device — see [`findings.md`](findings.md) for exactly why this
  rule exists.
- **Ask, don't guess**, on anything only the product owner can decide.
