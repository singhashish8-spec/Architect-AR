import type { VercelRequest, VercelResponse } from '@vercel/node'
import { UploadPartCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { getR2Client, r2Bucket } from './_lib/r2.js'

// Mints one presigned PUT URL per requested part number, for an
// already-started multipart upload (see r2-multipart-start.ts). Takes a
// batch of part numbers rather than one per call so a large file's worth
// of parts (potentially dozens) only costs one round trip to this
// function, not one per part -- the actual byte upload for each part
// still goes straight from the browser to R2, same as the original
// single-PUT flow.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { key, uploadId, partNumbers } = (req.body ?? {}) as {
    key?: unknown
    uploadId?: unknown
    partNumbers?: unknown
  }
  if (typeof key !== 'string' || key.trim() === '') {
    res.status(400).json({ error: 'key is required' })
    return
  }
  if (typeof uploadId !== 'string' || uploadId.trim() === '') {
    res.status(400).json({ error: 'uploadId is required' })
    return
  }
  if (!Array.isArray(partNumbers) || partNumbers.length === 0 || !partNumbers.every((n) => Number.isInteger(n) && n > 0)) {
    res.status(400).json({ error: 'partNumbers must be a non-empty array of positive integers' })
    return
  }

  try {
    const client = getR2Client()
    const bucket = r2Bucket()
    const urls = await Promise.all(
      partNumbers.map(async (partNumber: number) => {
        const command = new UploadPartCommand({ Bucket: bucket, Key: key, UploadId: uploadId, PartNumber: partNumber })
        const url = await getSignedUrl(client, command, { expiresIn: 600 })
        return [partNumber, url] as const
      }),
    )
    res.status(200).json({ urls: Object.fromEntries(urls) })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
}
