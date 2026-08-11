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
    expect(result.quantities).toEqual({ length: null, width: null, height: null, area: null, volume: null })
  })

  it('extracts Width/Height as their own dimensions, separate from Length', async () => {
    const propertySets = [
      {
        Quantities: [
          { Name: { value: 'Length' }, LengthValue: { value: 6 } },
          { Name: { value: 'Width' }, LengthValue: { value: 0.3 } },
          { Name: { value: 'Height' }, LengthValue: { value: 0.5 } },
        ],
      },
    ]
    const api = createMockApi(propertySets, [])
    const result = await getElementBoqData(api, 0, 1, 1)
    expect(result.quantities).toEqual({ length: 6, width: 0.3, height: 0.5, area: null, volume: null })
  })

  it('never reports Width/Height back as the generic length when no quantity is literally named "Length"', async () => {
    const propertySets = [
      {
        Quantities: [
          { Name: { value: 'Width' }, LengthValue: { value: 0.3 } },
          { Name: { value: 'Height' }, LengthValue: { value: 0.5 } },
        ],
      },
    ]
    const api = createMockApi(propertySets, [])
    const result = await getElementBoqData(api, 0, 1, 1)
    expect(result.quantities.length).toBeNull()
    expect(result.quantities.width).toBe(0.3)
    expect(result.quantities.height).toBe(0.5)
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

  it('falls back to the 3-arg getPropertySets call if the 4-arg (includeTypeProperties) call throws', async () => {
    // Confirmed live against a real project (2026-08-11): the 4-arg
    // call was silently returning nothing for a real wall, while the
    // exact 3-arg call ifcPropertyLookup.ts's own tap-to-inspect already
    // uses returned its Length/Width/Area/Volume properties correctly.
    const propertySets = [{ HasProperties: [{ Name: { value: 'Length' }, NominalValue: { value: 5 } }] }]
    let sawFourArgCall = false
    const api = {
      properties: {
        getPropertySets: (...args: unknown[]) => {
          if (args.length >= 4) {
            sawFourArgCall = true
            return Promise.reject(new Error('4-arg call not supported'))
          }
          return Promise.resolve(propertySets)
        },
        getMaterialsProperties: () => Promise.resolve([]),
      },
    } as unknown as IfcAPI

    const result = await getElementBoqData(api, 0, 1, 1)
    expect(sawFourArgCall).toBe(true)
    expect(result.quantities.length).toBe(5)
  })

  it('never throws when getPropertySets/getMaterialsProperties reject', async () => {
    const api = {
      properties: {
        getPropertySets: () => Promise.reject(new Error('no psets')),
        getMaterialsProperties: () => Promise.reject(new Error('no materials')),
      },
    } as unknown as IfcAPI
    const result = await getElementBoqData(api, 0, 1, 1)
    expect(result).toEqual({
      quantities: { length: null, width: null, height: null, area: null, volume: null },
      materials: [],
    })
  })
})
