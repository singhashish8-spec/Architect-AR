import { describe, expect, it } from 'vitest'
import { buildResults } from './searchResults'
import type { Level } from '../ifc/ifcSpatialTree'
import type { ElementCategory } from '../ifc/ifcCategories'

const levels: Level[] = [
  {
    expressId: 1,
    name: 'Level 1',
    elementGlobalIds: ['wall-1', 'door-1', 'room-a-globalid'],
    rooms: [{ expressId: 2, name: 'Kitchen', elementGlobalIds: ['door-1'] }],
  },
]

const categories: ElementCategory[] = [
  { expressId: 10, globalId: 'wall-1', type: 'IfcWallStandardCase', discipline: 'Architecture', category: 'Walls' },
  { expressId: 11, globalId: 'wall-2', type: 'IfcWallStandardCase', discipline: 'Architecture', category: 'Walls' },
  { expressId: 12, globalId: 'door-1', type: 'IfcDoor', discipline: 'Architecture', category: 'Doors' },
]

describe('buildResults', () => {
  it('includes every level, room, and category with real elements', () => {
    const results = buildResults(levels, categories)
    expect(results.some((r) => r.kind === 'level' && r.label === 'Level 1')).toBe(true)
    expect(results.some((r) => r.kind === 'room' && r.label === 'Kitchen')).toBe(true)
    expect(results.some((r) => r.kind === 'category' && r.label === 'Doors')).toBe(true)
    expect(results.some((r) => r.kind === 'category' && r.label === 'Walls')).toBe(true)
  })

  it('groups every element of a category under one result, not one per element', () => {
    const results = buildResults([], categories)
    const walls = results.find((r) => r.kind === 'category' && r.label === 'Walls')
    expect(walls?.globalIds.sort()).toEqual(['wall-1', 'wall-2'])
  })

  it('skips levels/rooms with no real elements in them', () => {
    const emptyLevel: Level[] = [{ expressId: 3, name: 'Empty Level', elementGlobalIds: [], rooms: [] }]
    const results = buildResults(emptyLevel, [])
    expect(results.some((r) => r.label === 'Empty Level')).toBe(false)
  })
})
