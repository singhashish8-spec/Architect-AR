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

## Finding: web-ifc's `includeTypeProperties`/`includeTypeMaterials` argument can fail silently (Session 7)

**What was found:** `getPropertySets()`/`getMaterialsProperties()`'s
4-arg form (passing `includeTypeProperties`/`includeTypeMaterials=true`
to also reach type-level data, not just instance-level) was added to fix
a real report of blank quantities on the owner's own project. The first
fix wrapped it in a `try/catch` falling back to the proven-working 3-arg
form on any thrown error — a reasonable design *if* an unsupported
argument throws. A live per-row debug sample against a real element
(already proven via tap-to-inspect to carry real data) proved that
assumption wrong: the 4-arg call was resolving **successfully with an
empty array**, no exception at all, so the catch-based fallback never
engaged.

**Why it wasn't caught immediately:** "fails" and "succeeds but returns
nothing" look identical from a caller's perspective unless something
specifically distinguishes them — a `try/catch` alone only ever handles
the first. The bug wasn't in the fallback *logic* so much as in which
condition it was watching for.

**Fix:** `ifc/ifcQuantities.ts`'s fallback helpers now retry the 3-arg
call whenever the 4-arg result is **empty**, independent of whether it
threw. Covered by unit tests for the "succeeds but empty" case
specifically, not just the "throws" case the original fix already had.

**Standing lesson:** any fallback wrapped around a `web-ifc` (or, more
generally, any WASM-backed) API call whose exact failure behavior for an
argument combination hasn't been directly confirmed should treat "empty/
falsy successful result" as a fallback trigger alongside "threw," not
instead of it — assuming a library will throw on something it doesn't
support is not itself confirmed behavior. See
[`boq.md`](../features/boq.md) and
[Session 7](sessions/2026-08-11-session-07.md) for the full arc.

## Finding: this sandboxed environment cannot run headless browser automation at all (Session 7)

**What was found:** attempting to self-verify a live report by driving a
real headless Chromium (Playwright, pre-installed at
`/opt/pw-browsers/chromium`) against the deployed app failed with
`net::ERR_CONNECTION_RESET` on every attempt — with and without an
explicit proxy configuration, with `--no-sandbox`/
`--disable-dev-shm-usage`, and even with the sandbox disabled at the
tool level. The same failure happened navigating to a completely
unrelated domain (`example.com`), while a plain `curl` through the same
proxy to the same domains succeeded.

**Why:** the network path itself is reachable (confirmed by `curl`
working) — only the browser-launched socket path is blocked. This points
at a hard constraint of the sandboxed execution environment itself
(browser processes can't open outbound sockets the way `curl` can), not
a proxy misconfiguration or anything specific to this app.

**Impact on the plan:** any future session that needs to visually verify
a live deployment cannot do so via headless browser automation from
inside this environment — full stop, not worth re-attempting with a
different flag combination. The workaround used this session (and worth
reaching for first next time) was making the *app itself*
self-diagnosing — an in-app "Debug info" disclosure that puts real
diagnostic data directly in front of whoever's looking at a real device,
since a phone screenshot is the actual available channel.

**Standing lesson:** don't spend session time re-proving this limitation
again — treat it as confirmed, and design around it (self-diagnosing UI,
asking for specific screenshots, reasoning from commit/build history)
rather than attempting live browser verification from this sandbox.

## Finding: a Vercel per-commit preview URL never updates; only the branch-alias URL does (Session 7)

**What was found:** several rounds of "still not fixed" reports during
the BOQ debugging arc turned out to be the owner reloading a per-commit
Vercel preview URL (`architect-7d1pjdq29-...`) — an immutable snapshot
of whatever the app looked like at that specific commit, which does not
change on later pushes no matter how many times it's reloaded. The
actual current build was live at a separate, stable **git-branch alias**
(`architect-ar-git-claude-app-9ec6df-...`) that auto-updates on every
push to the branch.

**Why it wasn't obvious:** both URLs look equally "real" and load the
app successfully — nothing about a stale per-commit URL signals that
it's frozen; it just quietly stops reflecting new pushes. The stable
alias URL was found by reading GitHub PR #2's own Vercel commit status
(`get_status`'s `target_url`), not by guessing at a URL pattern.

**Impact:** several genuine fixes were reported as "still broken" purely
because the owner was retesting stale state, not because anything was
actually wrong — wasted rounds that a URL check upfront would have
avoided.

**Standing lesson:** when a live retest keeps failing after a fix that
should have worked, check *which* URL is being tested before assuming
the fix itself is wrong — prefer sharing the stable branch-alias URL
(found via the PR's own commit status) over a per-commit snapshot URL
whenever asking someone to retest something across multiple pushes.
