import { describe, expect, it } from 'vitest'
import { buildBoqTree, filterBoqTree, boqGrandTotals, buildBoqCsv } from './boqData'
import type { BoqElementDetail } from '../ifc/ifcBoqDetails'

function detail(overrides: Partial<BoqElementDetail>): BoqElementDetail {
  return {
    expressId: 1,
    globalId: 'id-1',
    name: 'Element',
    type: 'IfcWallStandardCase',
    discipline: 'Architecture',
    category: 'Walls',
    level: 'Level 1',
    materials: [],
    quantities: { length: null, area: null, volume: null },
    ...overrides,
  }
}

const details: BoqElementDetail[] = [
  detail({
    expressId: 1,
    globalId: 'wall-1',
    name: 'Wall-01',
    category: 'Walls',
    materials: ['Brick'],
    quantities: { length: 4, area: 10, volume: 2 },
  }),
  detail({
    expressId: 2,
    globalId: 'wall-2',
    name: 'Wall-02',
    category: 'Walls',
    materials: ['Concrete'],
    quantities: { length: 6, area: 15, volume: null },
  }),
  detail({
    expressId: 3,
    globalId: 'door-1',
    name: 'Door-01',
    category: 'Doors',
    type: 'IfcDoor',
    materials: ['Oak'],
    quantities: { length: null, area: 2, volume: null },
  }),
  detail({
    expressId: 4,
    globalId: 'beam-1',
    name: 'Beam-01',
    category: 'Beams',
    discipline: 'Structure',
    type: 'IfcBeam',
    materials: ['Steel'],
    quantities: { length: 3, area: null, volume: 0.5 },
  }),
]

describe('buildBoqTree', () => {
  it('groups by discipline then category, with element lists and totals', () => {
    const tree = buildBoqTree(details)
    const architecture = tree.find((d) => d.discipline === 'Architecture')!
    expect(architecture.count).toBe(3)

    const walls = architecture.categories.find((c) => c.category === 'Walls')!
    expect(walls.count).toBe(2)
    expect(walls.totalLength).toBe(10)
    expect(walls.totalArea).toBe(25)
    // Only one of the two walls has a volume -- sums what's present.
    expect(walls.totalVolume).toBe(2)
    expect(walls.elements.map((e) => e.name)).toEqual(['Wall-01', 'Wall-02'])
  })

  it('sorts categories within a discipline by element count, highest first', () => {
    const tree = buildBoqTree(details)
    const architecture = tree.find((d) => d.discipline === 'Architecture')!
    expect(architecture.categories.map((c) => c.category)).toEqual(['Walls', 'Doors'])
  })

  it('reports null (not zero) for a category where nothing has that quantity', () => {
    const tree = buildBoqTree(details)
    const doors = tree.find((d) => d.discipline === 'Architecture')!.categories.find((c) => c.category === 'Doors')!
    expect(doors.totalLength).toBeNull()
    expect(doors.totalVolume).toBeNull()
  })

  it('returns an empty list for no data', () => {
    expect(buildBoqTree([])).toEqual([])
  })
})

describe('filterBoqTree', () => {
  it('returns the tree unchanged for an empty query', () => {
    const tree = buildBoqTree(details)
    expect(filterBoqTree(tree, '')).toBe(tree)
  })

  it('keeps a whole category when the category name matches', () => {
    const tree = buildBoqTree(details)
    const filtered = filterBoqTree(tree, 'walls')
    const architecture = filtered.find((d) => d.discipline === 'Architecture')!
    expect(architecture.categories.find((c) => c.category === 'Walls')?.count).toBe(2)
  })

  it('narrows a category down to just matching elements by material', () => {
    const tree = buildBoqTree(details)
    const filtered = filterBoqTree(tree, 'brick')
    const architecture = filtered.find((d) => d.discipline === 'Architecture')!
    const walls = architecture.categories.find((c) => c.category === 'Walls')!
    expect(walls.elements.map((e) => e.name)).toEqual(['Wall-01'])
    expect(walls.count).toBe(1)
  })

  it('drops disciplines and categories with no matches at all', () => {
    const tree = buildBoqTree(details)
    const filtered = filterBoqTree(tree, 'zzz-nothing-matches')
    expect(filtered).toEqual([])
  })
})

describe('boqGrandTotals', () => {
  it('sums counts and quantities across every discipline', () => {
    const tree = buildBoqTree(details)
    const totals = boqGrandTotals(tree)
    expect(totals.count).toBe(4)
    expect(totals.totalArea).toBe(27) // 10 + 15 + 2, beam has no area
    expect(totals.totalVolume).toBe(2.5) // 2 + 0.5, second wall has no volume
  })
})

describe('buildBoqCsv', () => {
  it('includes a header row and one row per element', () => {
    const csv = buildBoqCsv(details)
    const lines = csv.split('\n')
    expect(lines[0]).toBe('Discipline,Category,Name,Type,Level,Material,Length (m),Area (m2),Volume (m3)')
    expect(lines).toHaveLength(details.length + 1)
    expect(lines[1]).toBe('Architecture,Walls,Wall-01,IfcWallStandardCase,Level 1,Brick,4.00,10.00,2.000')
  })

  it('leaves quantity cells blank rather than "null" when a value is missing', () => {
    const csv = buildBoqCsv(details)
    const doorRow = csv.split('\n').find((line) => line.includes('Door-01'))!
    expect(doorRow).toBe('Architecture,Doors,Door-01,IfcDoor,Level 1,Oak,,2.00,')
  })
})
