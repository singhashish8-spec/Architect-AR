import { describe, expect, it } from 'vitest'
import { formatBytes } from './formatBytes'

describe('formatBytes', () => {
  it('shows plain bytes under 1 KB', () => {
    expect(formatBytes(512)).toBe('512 B')
  })

  it('shows KB with one decimal place', () => {
    expect(formatBytes(1536)).toBe('1.5 KB')
  })

  it('shows MB with one decimal place', () => {
    expect(formatBytes(45_234_000)).toBe('43.1 MB')
  })

  it('shows GB for very large files', () => {
    expect(formatBytes(2_147_483_648)).toBe('2.0 GB')
  })
})
