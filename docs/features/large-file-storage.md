# Feature: large file storage (Cloudflare R2)

> Part of [`features/`](README.md). Phase 2/3. Status: **built** (2026-08-12),
> not yet confirmed with a real end-to-end upload — see Open questions.

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

**Uploads never touch a serverless function.** The browser talks
directly to R2:

1. Client asks `api/r2-upload-url.ts` (a Vercel serverless function) for
   a presigned PUT URL, passing just the filename and content type.
2. That function (Node runtime, R2 credentials read from Vercel's own
   server-side environment variables — never sent to the browser) mints
   a short-lived (10 minute) presigned URL via `@aws-sdk/client-s3` +
   `@aws-sdk/s3-request-presigner` and returns it, along with the file's
   eventual public read URL.
3. The browser `PUT`s the file's bytes straight to that URL — R2's own
   endpoint, not any part of this app's infrastructure. This is the
   entire reason a serverless function couldn't do the upload itself:
   Vercel's own request body size limit for serverless functions is
   nowhere near large enough for a real IFC file, which is exactly the
   kind of ceiling this whole feature exists to get away from.

**Delete and copy go through small server-side functions** instead
(`api/r2-delete.ts`, `api/r2-copy.ts`) — the browser has no safe way to
hold R2's secret key itself, so these can't be done directly the way the
upload's presigned-URL step avoids needing one.

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
- `api/r2-upload-url.ts` — mints a presigned PUT URL + returns the
  eventual public URL.
- `api/r2-delete.ts` — deletes one or more objects by key.
- `api/r2-copy.ts` — server-side copy (used by "Duplicate project") —
  genuinely more efficient than Supabase Storage's own copy ever was,
  since R2 copies the object directly without the bytes passing through
  any function or the browser at all.
- `src/services/r2Service.ts` — the client-side counterpart calling
  those three routes.
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
   independent of anything this app's own code does.

## Open questions

- **Not yet confirmed with a real end-to-end upload** — built and
  quality-gate-clean (typecheck/lint/unit tests/production build), but
  no live upload has been attempted yet since it depends on the owner
  finishing the Cloudflare setup above (API token, env vars, CORS).
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
