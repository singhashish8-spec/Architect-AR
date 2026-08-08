import { describe, expect, it } from 'vitest'
import { compressToIfcGuid, expandIfcGuid, hyphenateUuid } from './ifcGuid'

// This pair is real, not invented: extracted from the actual Duplex
// Apartment sample IFC file (a genuine Revit IFC export from
// buildingSMART's community sample files) via ifcopenshell.guid --
// the authoritative reference implementation -- and cross-checked against
// the node name IfcOpenShell's own glTF serializer produced for the same
// element when converting that same file. See docs/history/sessions/.
const REAL_COMPRESSED = '2O2Fr$t4X7Zf8NOew3FKau'
const REAL_EXPANDED = '9808fd7fdc48478e9217628e833d4938'

describe('expandIfcGuid', () => {
  it('matches the real reference implementation on a real IFC element', () => {
    expect(expandIfcGuid(REAL_COMPRESSED)).toBe(REAL_EXPANDED)
  })
})

describe('compressToIfcGuid', () => {
  it('is the exact inverse of expandIfcGuid on the same real element', () => {
    expect(compressToIfcGuid(REAL_EXPANDED)).toBe(REAL_COMPRESSED)
  })
})

describe('hyphenateUuid', () => {
  it('formats as the standard 8-4-4-4-12 UUID grouping', () => {
    expect(hyphenateUuid(REAL_EXPANDED)).toBe('9808fd7f-dc48-478e-9217-628e833d4938')
  })
})
