import { afterEach, describe, expect, it, vi } from 'vitest'
import { copyOnR2, deleteFromR2, uploadToR2 } from './r2Service'

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 500): Response {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
  } as Response
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('uploadToR2', () => {
  it('asks the api for a presigned URL, PUTs the file to it, and returns the public URL', async () => {
    const file = new File(['hello'], 'model.glb', { type: 'model/gltf-binary' })
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ uploadUrl: 'https://r2.example/put?sig=abc', publicUrl: 'https://pub.example/x/model.glb' }),
      )
      .mockResolvedValueOnce(jsonResponse({}))
    vi.stubGlobal('fetch', fetchMock)

    const result = await uploadToR2(file)

    expect(result).toBe('https://pub.example/x/model.glb')
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/r2-upload-url',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ filename: 'model.glb', contentType: 'model/gltf-binary' }),
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://r2.example/put?sig=abc',
      expect.objectContaining({ method: 'PUT', body: file }),
    )
  })

  it('throws the server-provided error message when getting an upload URL fails', async () => {
    const file = new File(['hello'], 'model.glb')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: 'Missing R2_BUCKET_NAME' }, false, 500)))

    await expect(uploadToR2(file)).rejects.toThrow('Missing R2_BUCKET_NAME')
  })

  it('throws when the direct PUT to storage fails', async () => {
    const file = new File(['hello'], 'model.glb')
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ uploadUrl: 'https://r2.example/put', publicUrl: 'https://pub.example/x' }))
      .mockResolvedValueOnce({ ok: false, status: 403 })
    vi.stubGlobal('fetch', fetchMock)

    await expect(uploadToR2(file)).rejects.toThrow(/403/)
  })

  it('says which step failed when the presigned-URL request itself throws (e.g. offline)', async () => {
    const file = new File(['hello'], 'model.glb')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    await expect(uploadToR2(file)).rejects.toThrow(/upload-URL endpoint/)
  })

  it('says which step failed when the direct PUT to R2 itself throws (e.g. CORS)', async () => {
    const file = new File(['hello'], 'model.glb')
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ uploadUrl: 'https://r2.example/put', publicUrl: 'https://pub.example/x' }))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
    vi.stubGlobal('fetch', fetchMock)

    await expect(uploadToR2(file)).rejects.toThrow(/upload the file directly to storage/)
  })
})

describe('deleteFromR2', () => {
  it('does nothing when given no keys, without calling fetch at all', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await deleteFromR2([])

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('posts the keys to the api', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)

    await deleteFromR2(['a/1.glb', 'b/2.ifc'])

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/r2-delete',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ keys: ['a/1.glb', 'b/2.ifc'] }) }),
    )
  })
})

describe('copyOnR2', () => {
  it('returns the new public URL from the api', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ publicUrl: 'https://pub.example/new/model.glb' })))

    const result = await copyOnR2('old/model.glb')

    expect(result).toBe('https://pub.example/new/model.glb')
  })
})
