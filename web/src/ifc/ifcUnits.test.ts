import { describe, expect, it } from 'vitest'
import type { IfcAPI } from 'web-ifc'
import { getLengthUnitScaleToMeters } from './ifcUnits'

interface MockLine {
  type: string
  data: Record<string, unknown>
}

// A minimal stand-in for web-ifc's IfcAPI -- just the handful of methods
// getLengthUnitScaleToMeters()/getLineTypeName() actually call. Type
// codes are assigned arbitrarily per distinct type name, mirroring how
// web-ifc's own GetLineType()/GetNameFromTypeCode() pair round-trips a
// type without ever exposing a "real" numeric constant to this module.
function createMockApi(lines: Record<number, MockLine>): IfcAPI {
  const typeCodes = new Map<string, number>()
  let nextCode = 1
  for (const line of Object.values(lines)) {
    if (!typeCodes.has(line.type)) typeCodes.set(line.type, nextCode++)
  }
  const codeToType = new Map(Array.from(typeCodes.entries()).map(([type, code]) => [code, type]))
  const ids = Object.keys(lines).map(Number)

  return {
    GetAllLines: () => ({ size: () => ids.length, get: (i: number) => ids[i] }),
    GetLineType: (_modelId: number, expressId: number) => typeCodes.get(lines[expressId].type)!,
    GetNameFromTypeCode: (code: number) => codeToType.get(code)!,
    GetLine: (_modelId: number, expressId: number) => lines[expressId].data,
  } as unknown as IfcAPI
}

describe('getLengthUnitScaleToMeters', () => {
  it('defaults to 1 (assume metres) when there is no IfcProject line at all', () => {
    const api = createMockApi({})
    expect(getLengthUnitScaleToMeters(api, 0)).toBe(1)
  })

  it('resolves a prefixed SI length unit (millimetres) to its scale', () => {
    const api = createMockApi({
      1: { type: 'IfcProject', data: { UnitsInContext: { value: 2 } } },
      2: { type: 'IfcUnitAssignment', data: { Units: [{ value: 3 }] } },
      3: {
        type: 'IfcSIUnit',
        data: { UnitType: { value: 'LENGTHUNIT' }, Prefix: { value: 'MILLI' } },
      },
    })
    expect(getLengthUnitScaleToMeters(api, 0)).toBe(0.001)
  })

  it('treats an unprefixed SI length unit as already metres', () => {
    const api = createMockApi({
      1: { type: 'IfcProject', data: { UnitsInContext: { value: 2 } } },
      2: { type: 'IfcUnitAssignment', data: { Units: [{ value: 3 }] } },
      3: { type: 'IfcSIUnit', data: { UnitType: { value: 'LENGTHUNIT' } } },
    })
    expect(getLengthUnitScaleToMeters(api, 0)).toBe(1)
  })

  it('resolves a conversion-based unit (feet) via its ConversionFactor', () => {
    const api = createMockApi({
      1: { type: 'IfcProject', data: { UnitsInContext: { value: 2 } } },
      2: { type: 'IfcUnitAssignment', data: { Units: [{ value: 3 }] } },
      3: {
        type: 'IfcConversionBasedUnit',
        data: { UnitType: { value: 'LENGTHUNIT' }, ConversionFactor: { value: 4 } },
      },
      4: {
        type: 'IfcMeasureWithUnit',
        data: { ValueComponent: { value: 0.3048 }, UnitComponent: { value: 5 } },
      },
      5: { type: 'IfcSIUnit', data: { UnitType: { value: 'LENGTHUNIT' } } },
    })
    expect(getLengthUnitScaleToMeters(api, 0)).toBeCloseTo(0.3048, 6)
  })

  it('falls back to 1 instead of throwing if the API itself errors', () => {
    const api = {
      GetAllLines: () => {
        throw new Error('boom')
      },
    } as unknown as IfcAPI
    expect(getLengthUnitScaleToMeters(api, 0)).toBe(1)
  })
})
