import { describe, expect, it } from 'vitest'
import type { IfcAPI } from 'web-ifc'
import { getElementCategories } from './ifcCategories'

interface FakeLine {
  expressID: number
  typeName: string
  RelatingGroup?: { value: number }
  RelatedObjects?: { value: number }[]
  PredefinedType?: { value: string }
}

// A minimal fake of the web-ifc calls this module uses --
// GetAllLines()/GetLine()/GetLineType()/GetNameFromTypeCode() -- shaped
// like the real return values (verified directly against the installed
// package on the real Duplex sample, see this module's own comments),
// not guessed. GetLineType()/GetNameFromTypeCode() are faked as a no-op
// round trip (the "code" is just the type name itself) -- this test only
// needs the two calls composed together to yield the right name, not the
// real numeric encoding in between.
function fakeApi(lines: FakeLine[]): IfcAPI {
  const byId = new Map(lines.map((line) => [line.expressID, line]))
  return {
    GetAllLines: () => ({
      size: () => lines.length,
      get: (i: number) => lines[i].expressID,
    }),
    GetLine: (_modelId: number, expressId: number) => {
      const line = byId.get(expressId)
      if (!line) throw new Error('not found')
      return line
    },
    GetLineType: (_modelId: number, expressId: number) => {
      const line = byId.get(expressId)
      if (!line) throw new Error('not found')
      return line.typeName
    },
    GetNameFromTypeCode: (typeCode: unknown) => typeCode,
  } as unknown as IfcAPI
}

function line(expressID: number, typeName: string, extra: Partial<FakeLine> = {}): FakeLine {
  return { expressID, typeName, ...extra }
}

describe('getElementCategories', () => {
  it('classifies common architecture, structure, and MEP-by-type elements', () => {
    const lines = [
      line(1, 'IfcWallStandardCase'),
      line(2, 'IfcDoor'),
      line(3, 'IfcWindow'),
      line(4, 'IfcColumn'),
      line(5, 'IfcPipeSegment'),
    ]
    const api = fakeApi(lines)
    const expressIdToGlobalId = new Map(lines.map((l) => [l.expressID, `guid-${l.expressID}`]))

    const categories = getElementCategories(api, 0, expressIdToGlobalId)

    expect(categories.find((c) => c.expressId === 1)).toMatchObject({
      discipline: 'Architecture',
      category: 'Walls',
    })
    expect(categories.find((c) => c.expressId === 2)).toMatchObject({
      discipline: 'Architecture',
      category: 'Doors',
    })
    expect(categories.find((c) => c.expressId === 4)).toMatchObject({
      discipline: 'Structure',
      category: 'Columns',
    })
    expect(categories.find((c) => c.expressId === 5)).toMatchObject({
      discipline: 'MEP',
      category: 'Pipes',
    })
  })

  it('excludes non-physical IFC entities entirely (relationships, property sets, type/style definitions, spatial containers) rather than lumping them into a generic "Other" category', () => {
    // All of these have real GlobalIds in IFC (IfcRoot, which almost the
    // whole schema inherits from, carries one) despite having no
    // geometry of their own -- confirmed by actually running this
    // against the real Duplex sample, where they showed up as bogus
    // "categories" before this exclusion existed. See this module's
    // classify() comment.
    const lines = [
      line(1, 'IfcProject'),
      line(2, 'IfcBuildingStorey'),
      line(3, 'IfcPropertySet'),
      line(4, 'IfcDoorStyle'),
      line(5, 'IfcRelAggregates'),
    ]
    const api = fakeApi(lines)
    const expressIdToGlobalId = new Map(lines.map((l) => [l.expressID, `guid-${l.expressID}`]))

    expect(getElementCategories(api, 0, expressIdToGlobalId)).toEqual([])
  })

  it('uses the real IfcSystem discipline (e.g. Fire protection) over the generic MEP type label when a system assignment exists', () => {
    const lines = [
      line(10, 'IfcPipeSegment'),
      line(11, 'IfcDistributionSystem', { PredefinedType: { value: 'FIREPROTECTION' } }),
      line(12, 'IfcRelAssignsToGroup', {
        RelatingGroup: { value: 11 },
        RelatedObjects: [{ value: 10 }],
      }),
    ]
    const api = fakeApi(lines)
    const expressIdToGlobalId = new Map([[10, 'guid-10']])

    const categories = getElementCategories(api, 0, expressIdToGlobalId)

    expect(categories).toEqual([
      { expressId: 10, globalId: 'guid-10', type: 'IfcPipeSegment', discipline: 'MEP', category: 'Fire protection' },
    ])
  })

  it('falls back to the generic type-based MEP category when no system assignment exists', () => {
    const lines = [line(20, 'IfcPipeSegment')]
    const api = fakeApi(lines)
    const categories = getElementCategories(api, 0, new Map([[20, 'guid-20']]))

    expect(categories[0]).toMatchObject({ discipline: 'MEP', category: 'Pipes' })
  })
})
