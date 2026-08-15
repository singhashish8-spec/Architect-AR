// Talks to this app's own api/r2-*.ts serverless functions (Vercel),
// never to R2 directly except for the one PUT below -- R2's secret key
// only ever lives server-side (see api/_lib/r2.ts). See
// docs/features/large-file-storage.md for why this exists at all: Free
// Supabase projects cap every upload at a fixed, non-configurable 50 MB
// (confirmed directly in the Supabase dashboard's own Storage settings,
// 2026-08-12), which a real IFC export can easily exceed.

// A raw fetch() throwing at all (as opposed to resolving with a non-ok
// status, which readJsonOrThrow below already handles) almost always
// means the request never reached the other end -- no internet, a CORS
// preflight rejection, a DNS failure. The browser's own error for every
// one of those is the exact same unhelpful "Failed to fetch," with zero
// detail on which of the two very different requests this module makes
// (this app's own /api/r2-* routes vs. a direct cross-origin PUT to R2's
// own endpoint) actually failed, or why. Wrapping every fetch with
// *which step this was* turns "Failed to fetch" into something a real
// diagnosis can start from -- added 2026-08-12 after exactly that
// generic message showing up on a real upload attempt with no way to
// tell which of the two requests it was.
async function fetchOrThrow(step: string, input: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init)
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    throw new Error(
      `${step} (network error: "${detail}"). If this keeps happening, it's most likely the R2 bucket's CORS ` +
        `policy not allowing requests from this site -- see docs/features/large-file-storage.md.`,
      { cause: err },
    )
  }
}

async function readJsonOrThrow<T>(response: Response, fallbackMessage: string): Promise<T> {
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? fallbackMessage)
  }
  return (await response.json()) as T
}

// Files at or under this size go through a single PUT (uploadSingle) --
// simpler, and a dropped connection on a small file is cheap to just
// retry from scratch by re-submitting the form. Anything bigger uses
// multipart (uploadMultipart): split into PART_SIZE_BYTES chunks, each
// uploaded and retried independently, so a dropped mobile connection
// only has to redo whichever chunk was in flight, not the whole file --
// added 2026-08-14 after a real ~200 MB upload from a real phone failed
// with a bare "Failed to fetch" partway through a single giant PUT, with
// no way to tell how far it had gotten. See
// docs/features/large-file-storage.md.
const PART_SIZE_BYTES = 8 * 1024 * 1024 // 8 MB -- R2's own minimum part size is 5 MB for every part but the last
const MULTIPART_THRESHOLD_BYTES = PART_SIZE_BYTES
const MAX_PART_ATTEMPTS = 4

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Uploads a file straight from the browser to R2 -- the bytes go
// directly to R2's own endpoint over a presigned URL, never through any
// Vercel serverless function (which would reimpose a much smaller
// body-size ceiling of its own). Returns the file's public read URL.
// `onProgress(loaded, total)` is optional and only ever called for the
// multipart path -- a single small PUT has nothing meaningful to report
// partway through. Reports actual byte counts (not just a 0..1 fraction)
// so the UI can show real numbers the way a browser's own download
// manager does ("45.2 MB of 198.3 MB"), not just a bare percentage.
export async function uploadToR2(file: File, onProgress?: (loaded: number, total: number) => void): Promise<string> {
  if (file.size <= MULTIPART_THRESHOLD_BYTES) {
    return uploadSingle(file)
  }
  return uploadMultipart(file, onProgress)
}

async function uploadSingle(file: File): Promise<string> {
  const urlResponse = await fetchOrThrow('Could not reach this app\'s own upload-URL endpoint', '/api/r2-upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename: file.name, contentType: file.type || 'application/octet-stream' }),
  })
  const { uploadUrl, publicUrl } = await readJsonOrThrow<{ uploadUrl: string; publicUrl: string }>(
    urlResponse,
    'Could not get an upload URL.',
  )

  const putResponse = await fetchOrThrow('Could not upload the file directly to storage', uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  })
  if (!putResponse.ok) {
    throw new Error(`Upload to storage failed (${putResponse.status}).`)
  }

  return publicUrl
}

async function uploadMultipart(file: File, onProgress?: (loaded: number, total: number) => void): Promise<string> {
  const startResponse = await fetchOrThrow('Could not start the multipart upload', '/api/r2-multipart-start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename: file.name, contentType: file.type || 'application/octet-stream' }),
  })
  const { key, uploadId, publicUrl } = await readJsonOrThrow<{ key: string; uploadId: string; publicUrl: string }>(
    startResponse,
    'Could not start the multipart upload.',
  )

  const partCount = Math.ceil(file.size / PART_SIZE_BYTES)
  const partNumbers = Array.from({ length: partCount }, (_, i) => i + 1)

  try {
    const signResponse = await fetchOrThrow(
      "Could not get upload URLs for the file's parts",
      '/api/r2-multipart-sign',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, uploadId, partNumbers }),
      },
    )
    const { urls } = await readJsonOrThrow<{ urls: Record<string, string> }>(signResponse, 'Could not get upload URLs.')

    // Uploaded one part at a time, not in parallel -- deliberately
    // simple for a first cut: each part is already a multi-second
    // transfer on its own, and sequential upload keeps progress
    // reporting and per-part retry straightforward. See
    // docs/features/large-file-storage.md.
    const parts: { partNumber: number; eTag: string }[] = []
    let bytesUploaded = 0
    for (let i = 0; i < partCount; i++) {
      const partNumber = i + 1
      const start = i * PART_SIZE_BYTES
      const end = Math.min(start + PART_SIZE_BYTES, file.size)
      const chunk = file.slice(start, end)
      const url = urls[String(partNumber)]
      if (!url) {
        throw new Error(`No upload URL returned for part ${partNumber}.`)
      }
      const eTag = await uploadPartWithRetry(url, chunk)
      parts.push({ partNumber, eTag })
      bytesUploaded += chunk.size
      onProgress?.(bytesUploaded, file.size)
    }

    const completeResponse = await fetchOrThrow('Could not finish the multipart upload', '/api/r2-multipart-complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, uploadId, parts }),
    })
    await readJsonOrThrow(completeResponse, 'Could not finish the multipart upload.')
    return publicUrl
  } catch (err) {
    await abortMultipartUpload(key, uploadId)
    throw err
  }
}

// Retries a single part's PUT a few times with backoff before giving up
// -- the entire reason multipart exists over one giant PUT. Each
// successful part PUT returns its own ETag (in the response's `ETag`
// header), which R2 needs at complete time to verify every part arrived
// intact and in order; getting it back to JavaScript across R2's own
// origin requires 'ETag' to be listed in the bucket's CORS
// Access-Control-Expose-Headers, not just Access-Control-Allow-Headers
// (see docs/features/large-file-storage.md's CORS setup step).
async function uploadPartWithRetry(url: string, chunk: Blob): Promise<string> {
  let lastError: unknown
  for (let attempt = 1; attempt <= MAX_PART_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(url, { method: 'PUT', body: chunk })
      if (!response.ok) {
        throw new Error(`Part upload failed (${response.status}).`)
      }
      const eTag = response.headers.get('ETag')
      if (!eTag) {
        throw new Error(
          "R2 didn't return an ETag for this part -- the bucket's CORS policy likely needs 'ETag' added to " +
            'Access-Control-Expose-Headers (see docs/features/large-file-storage.md).',
        )
      }
      return eTag
    } catch (err) {
      lastError = err
      if (attempt < MAX_PART_ATTEMPTS) {
        await sleep(2 ** attempt * 500)
      }
    }
  }
  const detail = lastError instanceof Error ? lastError.message : String(lastError)
  throw new Error(`Could not upload part of the file after ${MAX_PART_ATTEMPTS} attempts (${detail}).`, {
    cause: lastError,
  })
}

async function abortMultipartUpload(key: string, uploadId: string): Promise<void> {
  try {
    await fetch('/api/r2-multipart-abort', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, uploadId }),
    })
  } catch {
    // Best-effort cleanup -- the upload's own real error is what the
    // caller needs to see, not a failure to clean up after it.
  }
}

export async function deleteFromR2(keys: string[]): Promise<void> {
  if (keys.length === 0) return
  const response = await fetchOrThrow('Could not reach this app\'s own delete endpoint', '/api/r2-delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keys }),
  })
  await readJsonOrThrow(response, 'Could not delete one or more files from storage.')
}

export async function copyOnR2(sourceKey: string): Promise<string> {
  const response = await fetchOrThrow('Could not reach this app\'s own copy endpoint', '/api/r2-copy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sourceKey }),
  })
  const { publicUrl } = await readJsonOrThrow<{ publicUrl: string }>(response, 'Could not copy the file in storage.')
  return publicUrl
}
