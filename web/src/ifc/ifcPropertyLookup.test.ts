import { describe, expect, it } from 'vitest'
import { unwrap } from './ifcPropertyLookup'

describe('unwrap', () => {
  it('reads .value off web-ifc value objects (e.g. IfcLabel, IfcGloballyUniqueId)', () => {
    expect(unwrap({ value: 'Basic Wall', type: 3, name: 'IFCLABEL' })).toBe('Basic Wall')
  })

  it('stringifies numbers wrapped the same way, e.g. IfcLengthMeasure', () => {
    expect(unwrap({ value: 200, type: 4, name: 'IFCLENGTHMEASURE' })).toBe('200')
  })

  it('falls back to String() for anything not wrapped', () => {
    expect(unwrap('already a string')).toBe('already a string')
    expect(unwrap(42)).toBe('42')
  })

  it('does not crash on null', () => {
    expect(unwrap(null)).toBe('null')
  })
})
