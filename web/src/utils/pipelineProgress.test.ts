import { describe, expect, it } from 'vitest'
import { fbxProgressToBar, ifcProgressToBar, uploadProgressToBar } from './pipelineProgress'

describe('ifcProgressToBar', () => {
  it('shows an indeterminate bar for phases with no real counts', () => {
    expect(ifcProgressToBar({ phase: 'parsing', current: 0, total: 0 })).toEqual({
      label: 'Reading IFC file…',
      percent: null,
      detail: undefined,
    })
  })

  it('shows a real percent and element count for the geometry phase', () => {
    expect(ifcProgressToBar({ phase: 'geometry', current: 30, total: 120 })).toEqual({
      label: 'Building 3D shapes…',
      percent: 25,
      detail: '30 of 120 elements',
    })
  })
})

describe('fbxProgressToBar', () => {
  it('is always indeterminate -- FBXLoader has no real per-item counts', () => {
    expect(fbxProgressToBar({ phase: 'loading textures' })).toEqual({
      label: 'Loading materials and textures…',
      percent: null,
    })
  })
})

describe('uploadProgressToBar', () => {
  it('shows a real percent and human-readable byte counts', () => {
    expect(uploadProgressToBar('Uploading model…', 45_000_000, 198_000_000)).toEqual({
      label: 'Uploading model…',
      percent: (45_000_000 / 198_000_000) * 100,
      detail: '42.9 MB of 188.8 MB',
    })
  })
})
