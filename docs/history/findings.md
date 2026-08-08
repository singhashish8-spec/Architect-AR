# Notable findings and how they changed the plan

> Part of [`history/`](README.md). Cross-session log — a finding can matter
> beyond the session it happened in, unlike the session-by-session narrative
> in [`sessions/`](sessions/).

## Finding: the reported crash isn't reproducible from this repo (Session 1)

**What was found:** the repository contains no camera or AR code at all —
just the unmodified default Android Studio template. The crash the owner
saw locally cannot be diagnosed from what's on GitHub.

**Why it happened (most likely):** work done through Android Studio's
Gemini assistant locally was run and tested on-device but never committed
or pushed before the crash occurred, so it never made it into version
control.

**Impact on the plan:** rather than chase a bug in code that doesn't exist
here, the task became "build the roadmap for what should exist," starting
clean. This is *why* [Session 1](sessions/2026-08-06-session-01.md)
produced a roadmap instead of a bug fix — not a scope-creep accident, a
direct consequence of this finding.

**Standing lesson for anyone working on this repo:** commit and push local
work *before* testing something risky (like a first camera-permission
flow) on-device, specifically so a crash doesn't take uncommitted work down
with it. Nothing in the current plan depends on Android Studio-only local
state — everything from Phase 0 onward should be built and pushed
incrementally for exactly this reason. See
[`engineering/git-workflow.md`](../engineering/git-workflow.md).

## Finding: PR #2's Vercel preview 404s on any route but `/` (Session 4)

**What was found:** the owner navigated straight to `/local` on the live
PR #2 preview URL to test the BIM correlation fix and got a Vercel
`404: NOT_FOUND`. `web/` had no `vercel.json`. `react-router-dom` handles
`/`, `/p/:projectId`, and `/local` entirely client-side (in the browser,
after `index.html` loads) — but Vercel's static file server doesn't know
that. It only serves `index.html` automatically for the bare root; any
other path is looked up as a literal file/folder, doesn't exist, and 404s
before React Router ever gets a chance to run.

**Why it wasn't caught earlier:** all prior testing on this preview URL
either stayed on `/` or arrived at `/p/:projectId` indirectly through the
app's own in-page navigation (a link click, not a typed/bookmarked URL) —
which works fine, since the redirect happens client-side after `/` has
already loaded correctly. Typing or bookmarking a deep link directly is
what exposes the gap, and that's exactly what the owner did.

**Fix:** added `web/vercel.json` with a catch-all rewrite
(`"/(.*)" → "/index.html"`), the standard fix for any client-side-routed
single-page app on Vercel. Every path now serves `index.html`, and React
Router takes over from there correctly.

**Standing lesson:** any new client-side route added later needs no
special Vercel config — this rewrite already covers all of them — but if
this project ever moves off Vercel (Netlify, Cloudflare Pages, etc.), the
equivalent SPA-fallback rule needs to be re-added for that host too. See
[`engineering/`](../engineering/README.md) if a hosting migration ever
happens.

## Finding: Revit's own IFC export fills unset fields with the field's own name (Session 4)

**What was found:** testing the fixed `/local` page against the real
Duplex sample, the owner saw data-panel rows like `SerialNumber:
SerialNumber` and `BarCode: BarCode` — the value looked like a bug (data
missing, something echoing the label). Checked the raw IFC file directly
with `ifcopenshell` rather than guessing: confirmed this is genuinely what
Revit's own IFC exporter writes for a text parameter nobody filled in —
`NominalValue = IfcLabel('SerialNumber')`, i.e. the field's own name used
as a placeholder, not an empty value. A smaller number of fields (like
"Assembly Code") are genuinely blank (`IfcLabel('')`) instead.

**Fix:** `ifc/ifcPropertyLookup.ts` now has `hasMeaningfulValue(name,
value)`, applied when building each element's property list — drops a
property if its value is blank/whitespace-only, or if it exactly equals
the property's own name. Verified with tests against the real observed
pattern (`SerialNumber`/`SerialNumber` → dropped, `Level`/`Level 1` →
kept). Pushed as `53961aa`.

**Standing lesson:** Revit-exported IFC data needs to be treated as
"real-world messy" by default, not schema-clean — this is the second
concrete, evidence-based (not hypothetical) quirk found in the same
sample file this session, after the node-naming convention. Any future
work reading IFC property values should expect placeholder/junk patterns
like this rather than assuming every populated field is meaningful.
