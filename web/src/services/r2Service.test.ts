import { afterEach, describe, expect, it, vi } from 'vitest'
import { copyOnR2, deleteFromR2, uploadToR2 } from './r2Service'

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 500): Response {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
  } as Response
}

function partPutResponse(eTag: string | null = '"etag"', ok = true, status = ok ? 200 : 500): Response {
  return {
    ok,
    status,
    headers: { get: (name: string) => (name === 'ETag' ? eTag : null) },
  } as unknown as Response
}

// Bigger than r2Service.ts's own 8 MB multipart threshold -- large
// enough to split into two parts (one full 8 MB part, one partial),
// without actually allocating anything close to a real IFC export's
// size.
function bigFile(name = 'model.glb', sizeBytes = 9 * 1024 * 1024): File {
  return new File([new ArrayBuffer(sizeBytes)], name, { type: 'model/gltf-binary' })
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
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

describe('uploadToR2 (multipart, files above the 8 MB threshold)', () => {
  it('splits the file into parts, uploads each, and completes the multipart upload', async () => {
    const file = bigFile()
    const onProgress = vi.fn()
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() =>
        Promise.resolve(
          jsonResponse({ key: 'abc/model.glb', uploadId: 'upload-1', publicUrl: 'https://pub.example/abc/model.glb' }),
        ),
      )
      .mockImplementationOnce(() =>
        Promise.resolve(jsonResponse({ urls: { '1': 'https://r2.example/part1', '2': 'https://r2.example/part2' } })),
      )
      .mockImplementationOnce(() => Promise.resolve(partPutResponse('"etag-1"')))
      .mockImplementationOnce(() => Promise.resolve(partPutResponse('"etag-2"')))
      .mockImplementationOnce(() => Promise.resolve(jsonResponse({ publicUrl: 'https://pub.example/abc/model.glb' })))
    vi.stubGlobal('fetch', fetchMock)

    const result = await uploadToR2(file, onProgress)

    expect(result).toBe('https://pub.example/abc/model.glb')
    expect(fetchMock).toHaveBeenCalledTimes(5)
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/r2-multipart-start',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/r2-multipart-sign',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ key: 'abc/model.glb', uploadId: 'upload-1', partNumbers: [1, 2] }),
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(3, 'https://r2.example/part1', expect.objectContaining({ method: 'PUT' }))
    expect(fetchMock).toHaveBeenNthCalledWith(4, 'https://r2.example/part2', expect.objectContaining({ method: 'PUT' }))
    const completeCall = fetchMock.mock.calls[4] as [string, RequestInit]
    expect(completeCall[0]).toBe('/api/r2-multipart-complete')
    expect(JSON.parse(completeCall[1].body as string)).toEqual({
      key: 'abc/model.glb',
      uploadId: 'upload-1',
      parts: [
        { partNumber: 1, eTag: '"etag-1"' },
        { partNumber: 2, eTag: '"etag-2"' },
      ],
    })
    // Called once per completed part, ending at 1 (100%).
    expect(onProgress).toHaveBeenLastCalledWith(1)
  })

  it('retries a failed part upload before giving up, and succeeds once a retry works', async () => {
    vi.useFakeTimers()
    const file = bigFile('model.glb', 8 * 1024 * 1024 + 1) // just over one part, so 2 parts total
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() =>
        Promise.resolve(jsonResponse({ key: 'abc/model.glb', uploadId: 'upload-1', publicUrl: 'https://pub.example/x' })),
      )
      .mockImplementationOnce(() =>
        Promise.resolve(jsonResponse({ urls: { '1': 'https://r2.example/part1', '2': 'https://r2.example/part2' } })),
      )
      // Part 1: fails once, then succeeds on retry.
      .mockImplementationOnce(() => Promise.resolve(partPutResponse(null, false, 503)))
      .mockImplementationOnce(() => Promise.resolve(partPutResponse('"etag-1"')))
      .mockImplementationOnce(() => Promise.resolve(partPutResponse('"etag-2"')))
      .mockImplementationOnce(() => Promise.resolve(jsonResponse({ publicUrl: 'https://pub.example/x' })))
    vi.stubGlobal('fetch', fetchMock)

    const resultPromise = uploadToR2(file)
    await vi.advanceTimersByTimeAsync(2000)
    const result = await resultPromise

    expect(result).toBe('https://pub.example/x')
    expect(fetchMock).toHaveBeenCalledTimes(6)
  })

  it('aborts the multipart upload and rethrows once a part exhausts every retry', async () => {
    vi.useFakeTimers()
    const file = bigFile()
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() =>
        Promise.resolve(jsonResponse({ key: 'abc/model.glb', uploadId: 'upload-1', publicUrl: 'https://pub.example/x' })),
      )
      .mockImplementationOnce(() =>
        Promise.resolve(jsonResponse({ urls: { '1': 'https://r2.example/part1', '2': 'https://r2.example/part2' } })),
      )
      .mockImplementation(() => Promise.resolve(partPutResponse(null, false, 500))) // every part PUT fails
    vi.stubGlobal('fetch', fetchMock)

    const assertion = expect(uploadToR2(file)).rejects.toThrow(/after 4 attempts/)
    await vi.advanceTimersByTimeAsync(10000)
    await assertion

    const abortCall = fetchMock.mock.calls.find(([url]) => url === '/api/r2-multipart-abort')
    expect(abortCall).toBeDefined()
    expect(JSON.parse((abortCall![1] as RequestInit).body as string)).toEqual({
      key: 'abc/model.glb',
      uploadId: 'upload-1',
    })
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
