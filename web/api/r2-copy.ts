import type { VercelRequest, VercelResponse } from '@vercel/node'
import { randomUUID } from 'node:crypto'
import { CopyObjectCommand } from '@aws-sdk/client-s3'
import { getR2Client, r2Bucket, r2PublicUrl } from './_lib/r2'

// The R2 counterpart to services/adminService.ts's old
// `supabase.storage.from(bucket).copy()` call, used by "Duplicate
// project" so the copy owns its own independent file rather than
// sharing the original's (which would break if the original were later
// deleted). A server-side S3 CopyObjectCommand is actually *more*
// efficient here than the Supabase Storage version ever was -- R2
// copies the object directly, without the bytes ever passing through
// this function, let alone the browser. See
// docs/features/large-file-storage.md.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { sourceKey } = (req.body ?? {}) as { sourceKey?: unknown }
  if (typeof sourceKey !== 'string' || sourceKey.trim() === '') {
    res.status(400).json({ error: 'sourceKey is required' })
    return
  }

  try {
    const filename = sourceKey.split('/').pop() ?? sourceKey
    const destKey = `${randomUUID()}/${filename}`
    const client = getR2Client()
    const bucket = r2Bucket()
    await client.send(
      new CopyObjectCommand({
        Bucket: bucket,
        Key: destKey,
        // Every path segment needs its own encoding (not the whole
        // string in one pass) -- encodeURIComponent() would also escape
        // the "/" separators CopySource's "<bucket>/<key>" shape
        // depends on.
        CopySource: `${bucket}/${sourceKey.split('/').map(encodeURIComponent).join('/')}`,
      }),
    )
    res.status(200).json({ publicUrl: r2PublicUrl(destKey), key: destKey })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
}
