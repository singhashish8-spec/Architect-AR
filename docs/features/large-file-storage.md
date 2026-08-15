# Feature: large file storage (Cloudflare R2)

> Part of [`features/`](README.md). Phase 2/3. Status: **built** (2026-08-12),
> **confirmed working end-to-end via a full presign → PUT → GET round trip**
> (2026-08-14, see [`../history/sessions/2026-08-14-session-09.md`](../history/sessions/2026-08-14-session-09.md)).
> A real upload attempt from an actual mobile browser then failed at the
> direct-PUT step (CORS ruled out) — the upload path was rebuilt the same
> session to use **chunked/resumable multipart upload** instead of one
> giant PUT, quality-gate-clean, **not yet re-tested against a real mobile
> browser** — see Open questions.

## Summary

Model and IFC file uploads now go to Cloudflare R2 instead of Supabase
Storage, via a presigned-URL flow that never routes the file's bytes
through this app's own serverless functions. Supabase remains the
database (projects, models, admin settings, RLS) — only large binary
file storage moved.

## Why this exists

A real IFC export from a real building can easily run 150-300+ MB.
Checking the live Supabase project's own Storage settings (2026-08-12)
confirmed the actual constraint: **Supabase's Free plan has a fixed,
non-configurable global upload limit of 50 MB**, enforced regardless of
what any individual bucket's own `file_size_limit` allows (this app's
`project-files` bucket has always been configured for 500 MB in
`schema.sql` — that setting was never the real ceiling). Upgrading to
Supabase Pro would remove the cap, but the owner asked for a free
solution specifically. Cloudflare R2's free tier (10 GB storage, no
per-file size gated by plan, effectively no egress fees) doesn't impose
this kind of tier-based ceiling at all — R2 supports single-request
uploads up to 5 GiB regardless of plan.

## Architecture

**Uploads never touch a serverless function's request body.** The
browser talks directly to R2 either way; which of the two upload paths
below runs depends only on file size (`src/services/r2Service.ts`'s
`MULTIPART_THRESHOLD_BYTES`, currently 8 MB):

**Small files (≤ 8 MB) — a single presigned PUT**, the original design:

1. Client asks `api/r2-upload-url.ts` for a presigned PUT URL, passing
   just the filename and content type.
2. That function (Node runtime, R2 credentials read from Vercel's own
   server-side environment variables — never sent to the browser) mints
   a short-lived (10 minute) presigned URL via `@aws-sdk/client-s3` +
   `@aws-sdk/s3-request-presigner` and returns it, along with the file's
   eventual public read URL.
3. The browser `PUT`s the file's bytes straight to that URL in one shot.

**Larger files — chunked/resumable multipart upload**, added
2026-08-14 after a real ~200 MB upload from a real phone failed
mid-transfer with a bare "Failed to fetch" and no way to tell how far it
had gotten. A single giant PUT has to restart from zero on any dropped
connection; multipart only has to retry whichever chunk was actually in
flight:

1. `api/r2-multipart-start.ts` opens a multipart upload
   (`CreateMultipartUploadCommand`) and returns the object `key` and R2's
   own `uploadId`.
2. `api/r2-multipart-sign.ts` mints one presigned `UploadPartCommand`
   URL per part number, in a single batched call (so a file with dozens
   of parts still only costs one round trip to this function, even
   though each part's actual bytes still go straight to R2).
3. The browser uploads each 8 MB chunk (`file.slice()`) to its own part
   URL, **one at a time**, retrying an individual part's PUT up to 4
   times with backoff before giving up — deliberately sequential, not
   parallel, for a first cut (each part is already a multi-second
   transfer on its own; a concurrency-limited pool wasn't judged worth
   the added complexity yet). Each successful part PUT returns an `ETag`
   header, which R2 needs to verify the parts arrive intact and in
   order.
4. `api/r2-multipart-complete.ts` finishes the upload
   (`CompleteMultipartUploadCommand`) with the full list of
   `{ partNumber, eTag }`.
5. If any part exhausts its retries, the client calls
   `api/r2-multipart-abort.ts` (`AbortMultipartUploadCommand`) before
   rethrowing the real error — otherwise every already-uploaded part of
   a failed upload sits in R2 forever, still counting against storage,
   with no way to ever complete or reach it.

An optional `onProgress(loaded, total)` callback — real byte counts, not
a bare 0..1 fraction — is threaded through both `uploadModelFile()`/
`uploadIfcFile()`, updated once per completed part for the multipart
path, and rendered via `components/PipelineProgressBar.tsx`
(2026-08-15) in every upload form (`ProjectCreateForm`,
`AdminProjectModels`'s `AddModelForm` and `ModelEditForm`'s replace-file
fields, `LocalPreview`), matching the same "show real progress, not a
spinner" precedent [`ifc-only-upload.md`](ifc-only-upload.md) and
[`fbx-upload.md`](fbx-upload.md) already set — and closing the specific
gap noted in Session 9: previously there was no way to tell how far a
failed upload had gotten before it died.

**One shared progress bar for the whole pipeline, not three.** The
owner's own follow-up ask after first trying the upload-progress bar:
byte counts alongside the percentage ("the way we see for downloads"),
and one bar instead of two/three showing at once with a label that
could go stale ("finishing up" bleeding into the upload step).
`PipelineProgressBar` replaced three separate components
(`ConversionProgressBar`, `FbxConversionStatus`, `UploadProgressBar`),
driven by one state variable per form (`utils/pipelineProgress.ts` maps
each of the three real progress sources — IFC conversion's phase/mesh-
count, FBX conversion's phase-only, and upload's byte counts — into the
one shape the bar renders) so exactly one bar is ever mounted, and its
label always matches whatever is actually happening. Deliberately
**not** a single fabricated percentage spanning conversion *and* upload
together — mesh counts and bytes are different units with no honest way
to weight them into one true number, so the bar still resets to 0% when
the stage changes; what changed is that it's always the same bar/style
doing it, not a visually different component swapping in.

**The two "Model file" / "IFC file" inputs are now one control.** The
owner's other same-day ask: merge the two file pickers into one, and add
desktop drag-and-drop. `components/ModelFileDropzone.tsx` is a single
drop target (click-to-browse or drag-and-drop) that sorts whatever files
land on it by extension — `.ifc` to the IFC slot, `.glb`/`.gltf`/`.fbx`
to the model slot — so dropping a model file and its IFC data file
together in one drag still fills both slots, the same dual-file
capability the old two-input version had. Used by all four upload sites
(`ProjectCreateForm`, `AddModelForm`, `ModelEditForm`, `LocalPreview`);
as a side effect, `ModelEditForm`'s "Replace model file" now accepts FBX
too, closing a gap [`fbx-upload.md`](fbx-upload.md) previously called
out as deliberately unsupported.

**Delete and copy go through small server-side functions** instead
(`api/r2-delete.ts`, `api/r2-copy.ts`) — the browser has no safe way to
hold R2's secret key itself, so these can't be done directly the way the
upload's presigned-URL steps avoid needing one.

**Object keys** follow the same `"<uuid>/<original filename>"` shape
Supabase Storage uploads already used, generated server-side (not
client-supplied) so nothing about key generation has to be trusted from
the browser.

**Provider detection for existing data**: every model/IFC url uploaded
before 2026-08-12 is still a Supabase Storage `getPublicUrl()` output;
everything since is an R2 public URL. `services/projectService.ts`'s
`extractStorageRef()` tells the two apart (Supabase urls contain
`/project-files/`; anything else is treated as R2) so
`services/adminService.ts`'s delete/copy paths for "Delete project,"
"Delete model," and "Duplicate project" keep working correctly for
*both* generations of file without needing a data migration — nothing
about already-uploaded files changes, they just get deleted/copied via
the Supabase Storage API instead of R2's.

## What's built

- `api/_lib/r2.ts` — shared R2 `S3Client` setup (R2 is S3-compatible;
  only the endpoint URL and `region: 'auto'` differ from plain S3).
  Underscore-prefixed folder so Vercel's file-based routing doesn't turn
  it into its own endpoint.
- `api/r2-upload-url.ts` — mints a single presigned PUT URL (small
  files) + returns the eventual public URL.
- `api/r2-multipart-start.ts` / `api/r2-multipart-sign.ts` /
  `api/r2-multipart-complete.ts` / `api/r2-multipart-abort.ts` — the
  four small endpoints behind chunked/resumable upload for larger files
  (see Architecture above).
- `api/r2-delete.ts` — deletes one or more objects by key.
- `api/r2-copy.ts` — server-side copy (used by "Duplicate project") —
  genuinely more efficient than Supabase Storage's own copy ever was,
  since R2 copies the object directly without the bytes passing through
  any function or the browser at all.
- `src/services/r2Service.ts` — the client-side counterpart calling
  those routes; `uploadToR2(file, onProgress?)` picks single-PUT vs.
  multipart automatically based on file size, reporting `(loaded, total)`
  byte counts.
- `src/components/PipelineProgressBar.tsx` + `src/utils/pipelineProgress.ts`
  — the one shared progress bar for the whole convert-then-upload
  pipeline (see above).
- `src/components/ModelFileDropzone.tsx` — the one merged, drag-and-drop
  capable file picker used by every upload form (see above).
- `src/services/projectService.ts` — `uploadModelFile()`/
  `uploadIfcFile()` now call `uploadToR2()` instead of Supabase Storage;
  `extractStorageRef()` replaces the old Supabase-only
  `extractStoragePath()`, now provider-aware.
- `src/services/adminService.ts` — `removeModelFiles()`/
  `copyStorageFile()` branch on `extractStorageRef()`'s provider,
  dispatching to Supabase Storage or R2 as appropriate.
- `tsconfig.api.json` (new project reference) and an ESLint override for
  `api/**/*.ts` (Node globals, not browser) — the same bundler-mode
  resolution `tsconfig.app.json` already uses, since Vercel bundles
  these functions with esbuild rather than running them through Node's
  own ESM loader directly.

**Deliberately ungated** (no admin passcode check on the R2 routes) —
matches this app's already-documented, already-accepted security
posture for file uploads (see `project-files`'s own comment in
`schema.sql`: "there's no real per-role Supabase Auth session to scope
Storage writes to"). This is the same shape of already-accepted risk on
a different storage backend, not a new gap introduced by this feature.

## Setup required (owner, not code)

This needs real Cloudflare account setup that only the account owner can
do:

1. Create a free Cloudflare account and an R2 bucket.
2. **R2 → Manage API tokens → Create API token**, permission
   **Object Read & Write**, scoped to the one bucket.
3. Add to Vercel (Project Settings → Environment Variables, Production +
   Preview):

   | Name | Value |
   |---|---|
   | `R2_ACCOUNT_ID` | The account-id subdomain segment of the R2 endpoint URL |
   | `R2_ACCESS_KEY_ID` | From the API token |
   | `R2_SECRET_ACCESS_KEY` | From the API token |
   | `R2_BUCKET_NAME` | The bucket's name |
   | `R2_PUBLIC_URL` | The bucket's public read URL (either the free `pub-xxxxx.r2.dev` subdomain from **bucket → Settings → Public Access**, or a connected custom domain) |

4. **CORS on the R2 bucket itself** needs to allow `PUT` (and the
   `Content-Type` header) from this app's actual deployed origin(s) —
   the browser's direct upload PUT to R2 is a cross-origin request from
   R2's perspective, and R2 rejects it without an explicit CORS rule,
   independent of anything this app's own code does. **`ExposeHeaders`
   must include `ETag`** — confirmed correctly configured as of
   2026-08-14, but easy to miss when setting this up fresh: the
   multipart upload path (see Architecture above) reads each part's
   `ETag` response header directly in the browser, and a CORS policy
   that allows the PUT itself but doesn't expose that header leaves
   `response.headers.get('ETag')` returning `null` even though the
   upload succeeded — `uploadPartWithRetry()` treats a missing `ETag` as
   a failure and retries (uselessly, since retrying doesn't fix a CORS
   config gap) before eventually giving up.

## What went wrong getting here, and how it was diagnosed (2026-08-14)

Three unrelated failures stacked on top of each other before this
actually worked live — full detail in
[`../history/sessions/2026-08-14-session-09.md`](../history/sessions/2026-08-14-session-09.md)
and [`../history/findings.md`](../history/findings.md):

1. **Vercel's own Deployment Protection** was blocking the app's own
   same-origin `/api/r2-upload-url` call on the Preview deployment — not
   CORS, not app code. Fixed by disabling "Vercel Authentication" at the
   *project* level (a team-level default toggle doesn't govern existing
   projects, which caused one round of "already turned off" that wasn't).
2. **The R2 access key was still the literal placeholder text** from
   setup instructions, and stayed that way through four rounds of
   "edited and redeployed" — because every redeploy targeted `main`
   while the URL under test was a different branch's Preview deployment
   that hadn't rebuilt in days. Root-caused via the Vercel API and fixed
   by redeploying the correct branch directly.
3. **A real upload from a real mobile browser still failed**, at the
   direct-PUT-to-R2 step specifically. CORS was explicitly simulated
   (a real preflight `OPTIONS` request) and confirmed correctly
   configured — this also surfaced that a `curl`-based PUT test alone
   can never validate CORS at all, since `curl` doesn't send or enforce
   a preflight. With CORS ruled out, a dropped mobile connection on a
   large (~200 MB) transfer is the leading suspect — see the next
   section.

## Open questions

- **The multipart upload rebuild has not yet been re-tested against a
  real mobile browser** — it's quality-gate-clean (typecheck/lint/unit
  tests covering the split-into-parts flow, per-part retry-then-succeed,
  and abort-after-exhausted-retries cases/production build), and fixes
  the specific gap that caused the original mobile failure (no way to
  tell how far a failed upload got; a dropped connection had to restart
  the whole file), but the actual real-world test — a real ~200 MB IFC
  from a real phone, through the real app UI — hasn't happened yet since
  this was built. That's the next concrete verification step.
- **Parts upload sequentially, not in parallel** — a deliberate
  simplicity choice for this first cut (see Architecture above), not a
  performance tuning pass. Worth revisiting if a real large upload turns
  out to be slower than expected once tested for real.
- **A separate, bigger idea is being considered as a follow-up, not a
  substitute for the fix above**: move IFC/FBX conversion server-side
  entirely, with background processing and live progress/ETA on the
  dashboard instead of converting in the browser. Needs real new
  infrastructure (a persistent worker, not a Vercel serverless
  function) — scoped in conversation, not yet designed or built. See
  [`../roadmap/decisions.md`](../roadmap/decisions.md).
- **No `R2_PUBLIC_URL` reachability check anywhere** — if it's
  misconfigured (wrong bucket, public access not actually enabled),
  uploads would still succeed (the presigned PUT only needs valid
  credentials, not a working public URL) but every subsequently
  generated share link would 404 on the file itself. Worth a real
  browser-load check after first setup, not just a successful upload.
- **No automatic migration of already-uploaded files from Supabase
  Storage to R2** — deliberately out of scope; existing projects keep
  working exactly as before via the Supabase Storage code path
  `extractStorageRef()` still supports, they just don't get the higher
  size ceiling retroactively (not needed, since anything already
  uploaded already fit under the old 50 MB cap by definition).
- **R2 delete/copy endpoints have no rate limiting or abuse protection**
  beyond what Vercel's own function invocation limits provide — same
  already-accepted posture as every other open `admin_*`-adjacent write
  path in this app, not a new consideration specific to R2.
