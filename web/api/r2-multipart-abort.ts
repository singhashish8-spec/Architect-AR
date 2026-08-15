import type { VercelRequest, VercelResponse } from '@vercel/node'
import { AbortMultipartUploadCommand } from '@aws-sdk/client-s3'
import { getR2Client, r2Bucket } from './_lib/r2.js'

// Cleans up an incomplete multipart upload after the browser gives up
// retrying a part -- without this, every already-uploaded part of a
// failed upload sits in R2 forever, still counting against storage, with
// no way to ever complete or reach it. Best-effort: the client calls
// this on its way to throwing the real upload error, but doesn't block
// on or fail the user-facing error if this itself fails too.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { key, uploadId } = (req.body ?? {}) as { key?: unknown; uploadId?: unknown }
  if (typeof key !== 'string' || key.trim() === '') {
    res.status(400).json({ error: 'key is required' })
    return
  }
  if (typeof uploadId !== 'string' || uploadId.trim() === '') {
    res.status(400).json({ error: 'uploadId is required' })
    return
  }

  try {
    const client = getR2Client()
    await client.send(new AbortMultipartUploadCommand({ Bucket: r2Bucket(), Key: key, UploadId: uploadId }))
    res.status(200).json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
}
