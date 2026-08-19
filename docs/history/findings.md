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

## Finding: Supabase Free enforces a fixed 50 MB upload cap regardless of any bucket's own settings (Session 8)

**What was found:** a real 169 MB IFC upload failed with "The object
exceeded the maximum allowed size," despite this app's own
`project-files` bucket being configured for a 500 MB `file_size_limit`
in `schema.sql`. Checking the live Supabase project's own Storage
dashboard directly (not guessing) confirmed the real ceiling: Supabase's
**Free plan enforces a fixed, non-configurable 50 MB global upload
limit**, which overrides any individual bucket's own setting. Only
upgrading to Pro removes it.

**Impact on the plan:** since the owner needed 200-300 MB files on a
free tier — which Supabase Free structurally cannot do no matter what
this app's own code or bucket config says — new model/IFC uploads moved
to Cloudflare R2 instead. See
[`features/large-file-storage.md`](../features/large-file-storage.md).

**Standing lesson:** a storage provider's own *account-tier* limits can
silently override a bucket-level setting that looks authoritative in
this app's own schema — when a size/quota error doesn't match what the
app's own config says it should allow, check the provider's dashboard
settings directly before assuming the app's config is wrong.

## Finding: Vercel Deployment Protection can block an app's own same-origin API calls (Session 9)

**What was found:** a real upload attempt failed with "Could not reach
this app's own upload-URL endpoint (network error: 'Failed to
fetch')" — initially assumed to be an R2 CORS problem, since that was
the only cross-origin request in the flow. Direct `curl -D -` testing
against `/api/r2-upload-url` (this sandbox can reach the internet
directly via `curl`, even though it cannot run headless browser
automation — see this file's Session 7 entry) returned a `401` with
`{"protection":{"vercel_auth_enabled":true}}` — **Vercel's own
"Vercel Authentication" (Deployment Protection) setting**, not CORS or
any app code, was blocking the request. This blocks *all* unauthenticated
requests to a Preview deployment, including same-origin requests the
app makes to its own API routes — a same-origin fetch failing is not
proof the failure is CORS-related.

**Why the first fix attempt didn't land:** Deployment Protection has
both a **team-level** default (only affects *new* projects going
forward) and a separate **project-level** setting (governs the actual
existing project). The owner initially checked and reported the
team-level toggle as already off, which was true but irrelevant — the
project's own setting, on a different settings page, was still active.

**Standing lesson:** when a same-origin `fetch()` from an app to its own
API route fails with a generic network error on a Vercel Preview
deployment, check Deployment Protection (at the *project* level
specifically, not just the team default) before assuming it's a CORS or
backend-code issue — CORS cannot explain a same-origin request failing
at all.

## Finding: a Vercel env var edit only takes effect on the next deployment of that specific branch/environment (Session 9)

**What was found:** after discovering a presigned URL contained a
literal placeholder credential (`your_access_key_id_here`), the owner
edited the real `R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY` values,
redeployed, and re-tested — the placeholder was still there. This
repeated **four times**, including a full delete-and-recreate of both
variables scoped to all environments. Direct inspection via the Vercel
API (deployment history for the project) found the actual cause: every
redeploy the owner triggered was of **`main`** (the production branch),
while the URL being tested the whole time was the **Preview** deployment
for a different branch (`claude/app-crash-camera-access-y74pyp`), which
had not been rebuilt in three days — since before any of the credential
edits. An env var edit only reaches a deployment that gets *rebuilt*
after the edit; redeploying an unrelated branch/environment does nothing
for it, no matter how many times it's repeated.

**Why it wasn't obvious sooner:** both `main` and the feature branch
deploy to the same Vercel project, and "Redeploy" is available from
multiple places in the dashboard without always making the target
branch obvious in the UI flow the owner was using.

**Standing lesson:** if a Vercel env var change doesn't appear to take
effect after a reported redeploy, check *which deployment* (branch,
target environment, and timestamp relative to the edit) was actually
redeployed before re-testing again — don't assume a change was saved
incorrectly when it may simply never have reached the deployment under
test. The Vercel API's own deployment-history endpoint is a fast,
unambiguous way to check this directly instead of guessing from
dashboard screenshots.

## Finding: a successful curl PUT to a presigned URL does not prove the browser's CORS preflight will succeed (Session 9)

**What was found:** after fixing the credential issue, `curl`-based
testing of the full presign → PUT → GET flow succeeded completely (`200`
at every step), which was treated as confirming the upload path worked.
A real upload from an actual mobile browser then failed at exactly the
PUT step, with a generic "Failed to fetch." Simulating the browser's
actual preflight `OPTIONS` request (`Access-Control-Request-Method`,
`Access-Control-Request-Headers`, a real `Origin` header) showed R2's
CORS configuration was in fact correct — so CORS wasn't this particular
failure's cause either — but the deeper issue is that **`curl` never
sends or enforces a CORS preflight at all**, so the earlier "confirmed
working" curl round trip could never have caught a CORS problem even if
one had existed. It only proved the credentials, signature, and object
storage itself worked.

**Standing lesson:** a `curl`-based test of a presigned-URL upload flow
validates credentials/signing/storage, not CORS — it is not a substitute
for testing (or explicitly simulating, via an `OPTIONS` request with the
right `Access-Control-Request-*` headers) what a real browser will do
for any endpoint involved in a cross-origin request. Don't report a
browser-facing upload flow as "confirmed working" from `curl` results
alone.

## Finding: tap-to-inspect doesn't correlate a separately-exported FBX with a separate IFC file (Session 10)

**What was found:** while answering the owner's own architecture
question about consolidating multiple Revit export files, checked
directly (rather than assuming) whether tap-to-inspect — tapping a 3D
element to see its Revit properties — actually works when someone
uploads both an FBX (for real textures) and a separate IFC file (for
property data) for the same model, which the app's own upload forms
have always allowed. It doesn't. `viewer/fbxToGlb.ts` passes
`FBXLoader`'s raw object names straight through to the exported GLB's
node names, untouched — Revit's own FBX naming, not an IFC GlobalId in
any form. `ifc/ifcPropertyLookup.ts`'s `resolveNodeNameToExpressId()`
only recognizes two forms of IFC GlobalId (a direct match, or a UUID-
shaped substring) and returns `undefined` for anything else, which
`ifc/useIfcElementData.ts`'s `getElementDataByGlobalId()` then turns
into a silent `null` — indistinguishable from a legitimately data-less
element. Tapping any element on an FBX-derived model would just show
"no data available" for every single element, with no error to signal
that anything's actually wrong.

**Why it wasn't caught earlier:** the FBX+IFC combination has always
been technically allowed by the upload forms (both file slots have
always coexisted), but nobody had specifically tested tapping an element
on a model built from a separately-exported FBX with an attached IFC —
previous tap-to-inspect verification
([`sessions/2026-08-08-session-04.md`](sessions/2026-08-08-session-04.md))
was against a GLB *generated from that same IFC file*, where the node
names are IFC GlobalIds by construction, not a real-world FBX+IFC pair.

**Impact:** Quantity Takeoff is unaffected (it reads the IFC file
directly, independent of whatever visual model is attached), but
tap-to-inspect specifically silently doesn't work for this combination
today. Not yet reported as a real bug by the owner (found while
reasoning through their own architecture question, not from a bug
report) — documented as a known gap in
[`features/fbx-upload.md`](../features/fbx-upload.md) and
[`roadmap/decisions.md`](../roadmap/decisions.md) rather than fixed,
since fixing it needs a real design decision (a geometry-matching
heuristic, or richer export tooling) beyond a quick patch.

**Standing lesson:** "the two features both work individually" isn't
the same claim as "they work together" — when two upload-time options
are allowed to coexist, explicitly check the combination, not just each
one alone, especially when the correlation between them (here: node
naming) was originally built and proven for a narrower case (IFC-derived
GLB) than what the UI actually permits (any GLB/FBX plus any IFC).

## Finding: the app's own docs misattributed real FBX textures to Twinmotion, when the owner exports directly from Revit (Session 10)

**What was found:** every doc and code comment describing how real
Revit textures get into this app (`roadmap/decisions.md`,
`features/fbx-upload.md`, `viewer/fbxToGlb.ts`'s own comments) credited
"Autodesk's Twinmotion-for-Revit add-in" as the free export path. Asked
directly, the owner clarified: *"we do not have twin motion app"* —
their actual FBX files come from **Revit's own native FBX export**
(File → Export → FBX), no plugin at all.

**Why it happened:** the Twinmotion attribution was written 2026-08-09
based on general knowledge of common free ways to get textured exports
out of Revit, not confirmed against the owner's own actual workflow at
the time — a reasonable-sounding assumption that was never actually
checked, and then got copied forward into every later doc/comment that
referenced the same capability, compounding across three files and one
code comment before being caught.

**Impact:** none on the app's actual behavior — it accepts any valid
FBX file regardless of which tool produced it, so nothing needed to
change in code, only in the docs' explanation of where a real user's
file actually comes from. All four references corrected 2026-08-15
(historical session docs describing the original, incorrect belief were
deliberately left as-is, per this folder's own history-is-append-only
convention — see [`README.md`](README.md)).

**Standing lesson:** don't let a plausible-sounding assumption about a
user's own toolchain go unconfirmed and then get copied across multiple
docs — a single direct question ("where does this file actually come
from?") would have caught this on day one instead of after several
docs/comments had already repeated it as fact.

## Finding: `io.github.sceneview:arsceneview` silently changed its whole API shape between the 2.x and 4.x lines (Session 11)

**What was found:** Kotlin code written against the imperative SceneView
API remembered from training (`ARScene(childNodes = ..., onSessionUpdated
= { session, frame -> ... })`, `AnchorNode` under
`io.github.sceneview.node`) failed to compile against
`io.github.sceneview:arsceneview:4.31.0` — the version Gradle resolved by
default. Decompiling the actual `4.31.0` `.jar` (`javap` on the
transformed API jar in the Gradle cache) showed the real cause: SceneView
`4.x` rewrote `ARScene` around a fully declarative Compose scene-graph (a
trailing `content: @Composable ARSceneScope.() -> Unit` lambda with
composable node-builder functions inside it) with no `childNodes` list,
`rememberNodes()`, or `AnchorNode` in its old package — a genuine
upstream breaking rewrite somewhere in the `4.x` line, not a mistake in
the code as first written.

**How it was actually resolved:** rather than reverse-engineer the new
declarative API from bytecode signatures alone (error-prone, and this
session's model has no training knowledge of anything that changed after
its cutoff), fetched the real Kotlin source for `arsceneview` from its
GitHub repo at a specific historical tag (`v2.2.1` — note the `v` prefix;
`2.2.1` without it 404s) to confirm that version still has the
`childNodes`/`onSessionUpdated`/`AnchorNode`-at-`ar.node` API the code
already targeted, then pinned the dependency to `2.2.1` instead of
rewriting the screen. Confirmed against real source, not assumed from
memory — the same standing rule as everywhere else in this project.

**Standing lesson:** a version placeholder like "the current release" or
"whatever Gradle resolves by default" is not safe to write Kotlin/Java
code against sight-unseen for a library outside this session's training
knowledge — the API surface itself can change between major versions,
not just add/deprecate symbols. When a dependency's API doesn't match
what the code expects, check whether it's a genuine upstream rewrite
(compare real source at a specific tag) before assuming the code is
wrong. This sandbox does have real, working network access to
`raw.githubusercontent.com` for exactly this kind of check, confirmed
working in this session — it isn't gated by this session's repo-access
scope, since that only governs the GitHub API/MCP tools, not plain HTTPS
fetches.
