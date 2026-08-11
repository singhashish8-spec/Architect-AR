import { describe, expect, it } from 'vitest'
import type { IfcAPI } from 'web-ifc'
import { getElementBoqData } from './ifcQuantities'

function createMockApi(propertySets: unknown[], materials: unknown[]): IfcAPI {
  return {
    properties: {
      getPropertySets: () => Promise.resolve(propertySets),
      getMaterialsProperties: () => Promise.resolve(materials),
    },
  } as unknown as IfcAPI
}

describe('getElementBoqData', () => {
  it('extracts length/area/volume from Qto quantity sets, scaled to metres', async () => {
    const propertySets = [
      {
        Quantities: [
          { Name: { value: 'Length' }, LengthValue: { value: 4000 } },
          { Name: { value: 'NetSideArea' }, AreaValue: { value: 8000000 } },
        ],
      },
    ]
    const api = createMockApi(propertySets, [])
    const result = await getElementBoqData(api, 0, 1, 0.001) // model's length unit is millimetres
    expect(result.quantities.length).toBeCloseTo(4, 6)
    expect(result.quantities.area).toBeCloseTo(8, 6) // 8,000,000 mm2 * 0.001^2 = 8 m2
    expect(result.quantities.volume).toBeNull()
  })

  it('prefers a well-known quantity name over an arbitrary one of the same kind', async () => {
    const propertySets = [
      {
        Quantities: [
          { Name: { value: 'GrossSideArea' }, AreaValue: { value: 12 } },
          { Name: { value: 'NetSideArea' }, AreaValue: { value: 10 } },
        ],
      },
    ]
    const api = createMockApi(propertySets, [])
    const result = await getElementBoqData(api, 0, 1, 1)
    expect(result.quantities.area).toBe(10)
  })

  it('ignores regular Pset properties (HasProperties), not just quantities', async () => {
    const propertySets = [{ HasProperties: [{ Name: { value: 'Fire Rating' }, NominalValue: { value: '2 HR' } }] }]
    const api = createMockApi(propertySets, [])
    const result = await getElementBoqData(api, 0, 1, 1)
    expect(result.quantities).toEqual({ length: null, area: null, volume: null })
  })

  it('collects a flat material name directly', async () => {
    const api = createMockApi([], [{ Name: { value: 'Brick' } }])
    const result = await getElementBoqData(api, 0, 1, 1)
    expect(result.materials).toEqual(['Brick'])
  })

  it('collects material names nested inside a layer set', async () => {
    const materials = [
      {
        ForLayerSet: {
          MaterialLayers: [
            { Material: { Name: { value: 'Brick' } } },
            { Material: { Name: { value: 'Insulation' } } },
          ],
        },
      },
    ]
    const api = createMockApi([], materials)
    const result = await getElementBoqData(api, 0, 1, 1)
    expect(result.materials.sort()).toEqual(['Brick', 'Insulation'])
  })

  it('never throws when getPropertySets/getMaterialsProperties reject', async () => {
    const api = {
      properties: {
        getPropertySets: () => Promise.reject(new Error('no psets')),
        getMaterialsProperties: () => Promise.reject(new Error('no materials')),
      },
    } as unknown as IfcAPI
    const result = await getElementBoqData(api, 0, 1, 1)
    expect(result).toEqual({ quantities: { length: null, area: null, volume: null }, materials: [] })
  })
})
