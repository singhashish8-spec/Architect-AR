import type { VercelRequest, VercelResponse } from '@vercel/node'
import { CompleteMultipartUploadCommand } from '@aws-sdk/client-s3'
import { getR2Client, r2Bucket, r2PublicUrl } from './_lib/r2.js'

// Finishes a multipart upload once every part has actually been PUT to
// R2 successfully -- R2 (like S3) won't assemble the object until this
// runs, and needs each part's ETag (returned by R2 itself in the PUT
// response for that part) to verify nothing was corrupted or reordered.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { key, uploadId, parts } = (req.body ?? {}) as { key?: unknown; uploadId?: unknown; parts?: unknown }
  if (typeof key !== 'string' || key.trim() === '') {
    res.status(400).json({ error: 'key is required' })
    return
  }
  if (typeof uploadId !== 'string' || uploadId.trim() === '') {
    res.status(400).json({ error: 'uploadId is required' })
    return
  }
  const isValidPart = (p: unknown): p is { partNumber: number; eTag: string } =>
    typeof p === 'object' &&
    p !== null &&
    Number.isInteger((p as { partNumber?: unknown }).partNumber) &&
    typeof (p as { eTag?: unknown }).eTag === 'string'
  if (!Array.isArray(parts) || parts.length === 0 || !parts.every(isValidPart)) {
    res.status(400).json({ error: 'parts must be a non-empty array of { partNumber, eTag }' })
    return
  }

  try {
    const client = getR2Client()
    await client.send(
      new CompleteMultipartUploadCommand({
        Bucket: r2Bucket(),
        Key: key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: parts
            .slice()
            .sort((a, b) => a.partNumber - b.partNumber)
            .map((p) => ({ PartNumber: p.partNumber, ETag: p.eTag })),
        },
      }),
    )
    res.status(200).json({ publicUrl: r2PublicUrl(key) })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
}
