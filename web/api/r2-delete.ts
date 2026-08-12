import type { VercelRequest, VercelResponse } from '@vercel/node'
import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getR2Client, r2Bucket } from './_lib/r2'

// Deletes one or more R2 objects by key -- the R2 counterpart to
// services/adminService.ts's old direct
// `supabase.storage.from(bucket).remove(paths)` call, needed because the
// browser has no safe way to hold R2's secret key itself to do this
// client-side. See docs/features/large-file-storage.md.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { keys } = (req.body ?? {}) as { keys?: unknown }
  if (!Array.isArray(keys) || keys.length === 0 || !keys.every((key) => typeof key === 'string')) {
    res.status(400).json({ error: 'keys must be a non-empty array of strings' })
    return
  }

  try {
    const client = getR2Client()
    const bucket = r2Bucket()
    // One DeleteObjectCommand per key rather than the batch
    // DeleteObjectsCommand -- this app only ever deletes a handful of
    // files at once (one project's worth of models), so the simpler
    // single-object API is plenty, and Promise.all here still issues
    // them concurrently rather than one at a time.
    await Promise.all(keys.map((key) => client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))))
    res.status(200).json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
}
