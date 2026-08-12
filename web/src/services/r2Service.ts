// Talks to this app's own api/r2-*.ts serverless functions (Vercel),
// never to R2 directly except for the one PUT below -- R2's secret key
// only ever lives server-side (see api/_lib/r2.ts). See
// docs/features/large-file-storage.md for why this exists at all: Free
// Supabase projects cap every upload at a fixed, non-configurable 50 MB
// (confirmed directly in the Supabase dashboard's own Storage settings,
// 2026-08-12), which a real IFC export can easily exceed.

async function readJsonOrThrow<T>(response: Response, fallbackMessage: string): Promise<T> {
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? fallbackMessage)
  }
  return (await response.json()) as T
}

// Uploads a file straight from the browser to R2 -- the bytes go
// directly to R2's own endpoint over the presigned URL, never through
// any Vercel serverless function (which would reimpose a much smaller
// body-size ceiling of its own). Returns the file's public read URL.
export async function uploadToR2(file: File): Promise<string> {
  const urlResponse = await fetch('/api/r2-upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename: file.name, contentType: file.type || 'application/octet-stream' }),
  })
  const { uploadUrl, publicUrl } = await readJsonOrThrow<{ uploadUrl: string; publicUrl: string }>(
    urlResponse,
    'Could not get an upload URL.',
  )

  const putResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  })
  if (!putResponse.ok) {
    throw new Error(`Upload to storage failed (${putResponse.status}).`)
  }

  return publicUrl
}

export async function deleteFromR2(keys: string[]): Promise<void> {
  if (keys.length === 0) return
  const response = await fetch('/api/r2-delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keys }),
  })
  await readJsonOrThrow(response, 'Could not delete one or more files from storage.')
}

export async function copyOnR2(sourceKey: string): Promise<string> {
  const response = await fetch('/api/r2-copy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sourceKey }),
  })
  const { publicUrl } = await readJsonOrThrow<{ publicUrl: string }>(response, 'Could not copy the file in storage.')
  return publicUrl
}
