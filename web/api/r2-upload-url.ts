import type { VercelRequest, VercelResponse } from '@vercel/node'
import { randomUUID } from 'node:crypto'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { getR2Client, r2Bucket, r2PublicUrl } from './_lib/r2'

// Mints a short-lived, single-object presigned PUT URL so the browser
// can upload a model/IFC file straight to R2 -- the file's bytes never
// pass through this function or any other Vercel serverless function at
// all (Vercel's own request body limit, well under what a real IFC
// export needs, would otherwise be exactly the same kind of hard ceiling
// this whole R2 move exists to get away from). This function only ever
// handles the small JSON request/response around that, not the file
// itself. See docs/features/large-file-storage.md.
//
// Deliberately ungated (no admin passcode check) -- matches this app's
// already-documented, already-accepted security posture for file
// uploads (see the `project-files` Storage bucket's own comment in
// supabase/schema.sql: "there's no real per-role Supabase Auth session
// to scope Storage writes to, admin-ness here is just a passcode check
// in a Postgres function, not a Storage-level identity"). This endpoint
// is the same shape of already-accepted risk, not a new one.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { filename, contentType } = (req.body ?? {}) as { filename?: unknown; contentType?: unknown }
  if (typeof filename !== 'string' || filename.trim() === '') {
    res.status(400).json({ error: 'filename is required' })
    return
  }

  try {
    // Same "<uuid>/<original filename>" shape Supabase Storage uploads
    // already used (see projectService.ts's old uploadFile()) -- keeps
    // every already-written extractStorageRef()/URL-parsing logic
    // working unchanged for R2-hosted files too.
    const key = `${randomUUID()}/${filename}`
    const client = getR2Client()
    const command = new PutObjectCommand({
      Bucket: r2Bucket(),
      Key: key,
      ContentType: typeof contentType === 'string' && contentType ? contentType : 'application/octet-stream',
    })
    const uploadUrl = await getSignedUrl(client, command, { expiresIn: 600 })
    res.status(200).json({ uploadUrl, publicUrl: r2PublicUrl(key), key })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
}
