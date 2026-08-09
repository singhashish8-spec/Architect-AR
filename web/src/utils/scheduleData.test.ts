import { describe, expect, it } from 'vitest'
import { buildSchedule } from './scheduleData'
import type { ElementCategory } from '../ifc/ifcCategories'

const categories: ElementCategory[] = [
  { expressId: 1, globalId: 'wall-1', type: 'IfcWallStandardCase', discipline: 'Architecture', category: 'Walls' },
  { expressId: 2, globalId: 'wall-2', type: 'IfcWallStandardCase', discipline: 'Architecture', category: 'Walls' },
  { expressId: 3, globalId: 'wall-3', type: 'IfcWallStandardCase', discipline: 'Architecture', category: 'Walls' },
  { expressId: 4, globalId: 'door-1', type: 'IfcDoor', discipline: 'Architecture', category: 'Doors' },
  { expressId: 5, globalId: 'beam-1', type: 'IfcBeam', discipline: 'Structure', category: 'Beams' },
]

describe('buildSchedule', () => {
  it('counts each category and totals each discipline', () => {
    const schedule = buildSchedule(categories)
    const architecture = schedule.find((g) => g.discipline === 'Architecture')
    expect(architecture?.total).toBe(4)
    expect(architecture?.rows.find((r) => r.category === 'Walls')?.count).toBe(3)
    expect(architecture?.rows.find((r) => r.category === 'Doors')?.count).toBe(1)

    const structure = schedule.find((g) => g.discipline === 'Structure')
    expect(structure?.total).toBe(1)
  })

  it('sorts rows within a discipline by count, highest first', () => {
    const schedule = buildSchedule(categories)
    const architecture = schedule.find((g) => g.discipline === 'Architecture')
    expect(architecture?.rows.map((r) => r.category)).toEqual(['Walls', 'Doors'])
  })

  it('omits a discipline entirely when it has no elements', () => {
    const schedule = buildSchedule(categories)
    expect(schedule.some((g) => g.discipline === 'MEP')).toBe(false)
  })

  it('returns an empty list for no data', () => {
    expect(buildSchedule([])).toEqual([])
  })
})
