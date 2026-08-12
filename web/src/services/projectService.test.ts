import { describe, expect, it } from 'vitest'
import { extractStorageRef, MODEL_BUCKET } from './projectService'

describe('extractStorageRef', () => {
  it('extracts a Supabase Storage path from a getPublicUrl()-shaped url', () => {
    const url = `https://xyz.supabase.co/storage/v1/object/public/${MODEL_BUCKET}/abc-123/model.glb`
    expect(extractStorageRef(url)).toEqual({ provider: 'supabase', path: 'abc-123/model.glb' })
  })

  it('treats any other http(s) url as R2, keyed by everything after the host', () => {
    const url = 'https://pub-abc123.r2.dev/def-456/model.glb'
    expect(extractStorageRef(url)).toEqual({ provider: 'r2', path: 'def-456/model.glb' })
  })

  it('also recognizes a custom-domain R2 public url the same way', () => {
    const url = 'https://files.example.com/def-456/model.glb'
    expect(extractStorageRef(url)).toEqual({ provider: 'r2', path: 'def-456/model.glb' })
  })

  it('returns null for a url with nothing after the host', () => {
    expect(extractStorageRef('https://pub-abc123.r2.dev/')).toBeNull()
    expect(extractStorageRef('https://pub-abc123.r2.dev')).toBeNull()
  })

  it('returns null for something that is not a url at all', () => {
    expect(extractStorageRef('not-a-url')).toBeNull()
  })
})
