import { describe, expect, it } from 'vitest'
import {
  hasMeaningfulValue,
  invertToHyphenatedGlobalIds,
  resolveNodeNameToExpressId,
  unwrap,
} from './ifcPropertyLookup'
import { expandIfcGuid, hyphenateUuid } from './ifcGuid'

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

describe('resolveNodeNameToExpressId', () => {
  // Real element from the Duplex Apartment sample IFC file (a genuine
  // Revit export) -- see ifcGuid.test.ts and docs/history/sessions/.
  const compressedGuid = '2O2Fr$t4X7Zf8NOew3FKau'
  const expandedGuid = expandIfcGuid(compressedGuid)
  const expressId = 42

  function buildIndex(): Map<string, number> {
    const index = new Map<string, number>()
    index.set(compressedGuid, expressId)
    index.set(expandedGuid, expressId)
    index.set(hyphenateUuid(expandedGuid), expressId)
    return index
  }

  it('matches when the node is named directly after the compressed GlobalId', () => {
    expect(resolveNodeNameToExpressId(compressedGuid, buildIndex())).toBe(expressId)
  })

  it('matches IfcOpenShell\'s real glTF naming convention, "product-<uuid>-body"', () => {
    const nodeName = `product-${hyphenateUuid(expandedGuid)}-body`
    expect(resolveNodeNameToExpressId(nodeName, buildIndex())).toBe(expressId)
  })

  it('matches a bare hyphenated UUID with no wrapping', () => {
    expect(resolveNodeNameToExpressId(hyphenateUuid(expandedGuid), buildIndex())).toBe(expressId)
  })

  it('returns undefined for a node name that matches nothing in the model', () => {
    expect(resolveNodeNameToExpressId('some-unrelated-mesh-name', buildIndex())).toBeUndefined()
  })
})

describe('invertToHyphenatedGlobalIds', () => {
  const compressedGuid = '2O2Fr$t4X7Zf8NOew3FKau'
  const expandedGuid = expandIfcGuid(compressedGuid)
  const hyphenated = hyphenateUuid(expandedGuid)
  const expressId = 42

  it('picks only the hyphenated form out of the three keys per element', () => {
    const index = new Map<string, number>([
      [compressedGuid, expressId],
      [expandedGuid, expressId],
      [hyphenated, expressId],
    ])

    const reversed = invertToHyphenatedGlobalIds(index)

    expect(reversed.size).toBe(1)
    expect(reversed.get(expressId)).toBe(hyphenated)
  })

  it('returns an empty map for an index with no hyphenated keys', () => {
    const index = new Map<string, number>([[compressedGuid, expressId]])
    expect(invertToHyphenatedGlobalIds(index).size).toBe(0)
  })
})

describe('hasMeaningfulValue', () => {
  it('rejects Revit\'s own placeholder for an unfilled field, value === name', () => {
    // Real example from the Duplex Apartment sample file: an unfilled
    // "SerialNumber" field exports as NominalValue = IfcLabel('SerialNumber').
    expect(hasMeaningfulValue('SerialNumber', 'SerialNumber')).toBe(false)
  })

  it('rejects an empty or whitespace-only value', () => {
    expect(hasMeaningfulValue('Assembly Code', '')).toBe(false)
    expect(hasMeaningfulValue('Assembly Code', '   ')).toBe(false)
  })

  it('accepts a real, filled-in value', () => {
    expect(hasMeaningfulValue('Level', 'Level 1')).toBe(true)
    expect(hasMeaningfulValue('Elevation', '1.399999999999999')).toBe(true)
  })

  it('accepts a value that happens to equal a different property\'s name', () => {
    expect(hasMeaningfulValue('Phase Created', 'New Construction')).toBe(true)
  })
})
