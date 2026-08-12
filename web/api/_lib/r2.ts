import { S3Client } from '@aws-sdk/client-s3'

// Shared by every api/r2-*.ts route. Lives under api/_lib/ specifically
// -- Vercel's file-based routing turns every file directly under api/
// into its own endpoint, EXCEPT files/folders whose name starts with an
// underscore, which is exactly why this one isn't itself reachable as a
// route.
//
// Cloudflare R2 is S3-compatible, so the AWS SDK talks to it directly --
// only the endpoint (R2's own account-scoped URL, not AWS's) and
// `region: 'auto'` (R2 doesn't have real AWS regions) differ from a
// plain S3 setup. Credentials are read from Vercel's own server-side
// environment variables -- never sent to the client, never present in
// the browser bundle, since nothing under api/ is processed by Vite at
// all.
export function getR2Client(): S3Client {
  const accountId = requireEnv('R2_ACCOUNT_ID')
  const accessKeyId = requireEnv('R2_ACCESS_KEY_ID')
  const secretAccessKey = requireEnv('R2_SECRET_ACCESS_KEY')

  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  })
}

export function r2Bucket(): string {
  return requireEnv('R2_BUCKET_NAME')
}

// R2_PUBLIC_URL is the bucket's own public read URL -- either the free
// `pub-xxxxx.r2.dev` subdomain Cloudflare hands out once "Allow Access"
// is turned on for the bucket, or a real custom domain if one's been
// connected. Not secret (it's a read-only URL, same as Supabase
// Storage's own getPublicUrl() output was), but still only known
// server-side here -- projectService.ts on the client only ever sees
// the final URL this function already built, not the base itself.
export function r2PublicUrl(key: string): string {
  const base = requireEnv('R2_PUBLIC_URL').replace(/\/$/, '')
  return `${base}/${key}`
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `Missing ${name} -- set it in Vercel's Project Settings → Environment Variables (see docs/features/large-file-storage.md).`,
    )
  }
  return value
}
