import type { VercelRequest, VercelResponse } from '@vercel/node'
import { randomUUID } from 'node:crypto'
import { CreateMultipartUploadCommand } from '@aws-sdk/client-s3'
import { getR2Client, r2Bucket, r2PublicUrl } from './_lib/r2.js'

// Starts a multipart upload for one large object -- the first of four
// small endpoints (start / sign-parts / complete / abort) that replace
// the old single-PUT r2-upload-url.ts for anything large enough to
// benefit from being split into independently-retryable chunks. See
// "Why multipart" in docs/features/large-file-storage.md: a single huge
// PUT has to restart from zero if the connection drops partway through
// (the real failure seen from a real mobile upload, 2026-08-14) --
// multipart only has to retry whichever chunk actually failed.
//
// Same ungated posture as r2-upload-url.ts -- see that file's own
// comment for why.
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
    const key = `${randomUUID()}/${filename}`
    const client = getR2Client()
    const { UploadId } = await client.send(
      new CreateMultipartUploadCommand({
        Bucket: r2Bucket(),
        Key: key,
        ContentType: typeof contentType === 'string' && contentType ? contentType : 'application/octet-stream',
      }),
    )
    if (!UploadId) {
      throw new Error('R2 did not return an UploadId for the new multipart upload.')
    }
    res.status(200).json({ key, uploadId: UploadId, publicUrl: r2PublicUrl(key) })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
}
