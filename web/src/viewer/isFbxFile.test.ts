import { describe, expect, it } from 'vitest'
import { isFbxFile } from './isFbxFile'

describe('isFbxFile', () => {
  it('matches .fbx regardless of case', () => {
    expect(isFbxFile(new File([], 'Model.FBX'))).toBe(true)
    expect(isFbxFile(new File([], 'model.fbx'))).toBe(true)
    expect(isFbxFile(new File([], 'model.glb'))).toBe(false)
  })
})
