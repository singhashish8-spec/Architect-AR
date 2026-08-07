import { describe, expect, it } from 'vitest'
import { isScalePreset, scaleRatio, SCALE_PRESETS, visualScale } from './ScalePreset'

describe('isScalePreset', () => {
  it('accepts every standard preset', () => {
    for (const preset of SCALE_PRESETS) {
      expect(isScalePreset(preset)).toBe(true)
    }
  })

  it('rejects values outside the standard list', () => {
    expect(isScalePreset('1:1000000')).toBe(false)
    expect(isScalePreset('')).toBe(false)
    expect(isScalePreset('1:1 ')).toBe(false)
  })
})

describe('scaleRatio', () => {
  it('reads the ratio out of the preset string', () => {
    expect(scaleRatio('1:1')).toBe(1)
    expect(scaleRatio('1:100')).toBe(100)
    expect(scaleRatio('1:1000')).toBe(1000)
  })
})

describe('visualScale', () => {
  it('is the inverse of the ratio, so 1:1 renders at true size', () => {
    expect(visualScale('1:1')).toBe(1)
  })

  it('shrinks larger ratios proportionally, e.g. a 1:1000 master plan to 1/1000 size', () => {
    expect(visualScale('1:1000')).toBeCloseTo(0.001)
    expect(visualScale('1:100')).toBeCloseTo(0.01)
  })
})
