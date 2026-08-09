import type { ElementCategory } from '../ifc/ifcCategories'

export interface ScheduleRow {
  category: string
  count: number
  globalIds: string[]
}

export interface ScheduleGroup {
  discipline: string
  rows: ScheduleRow[]
  total: number
}

const DISCIPLINE_ORDER = ['Architecture', 'Structure', 'MEP']

// A simple quantity takeoff -- how many of each category, grouped by
// discipline, from the same classified-element data the Categories panel
// already has (ifc/ifcCategories.ts). Sorted by count descending within
// each discipline (the categories with the most elements read first,
// generally the ones someone doing a takeoff cares about first) rather
// than alphabetically. See docs/features/search-and-schedule.md.
export function buildSchedule(categories: ElementCategory[]): ScheduleGroup[] {
  const byDiscipline = new Map<string, Map<string, string[]>>()
  for (const element of categories) {
    if (!byDiscipline.has(element.discipline)) byDiscipline.set(element.discipline, new Map())
    const byCategory = byDiscipline.get(element.discipline)!
    if (!byCategory.has(element.category)) byCategory.set(element.category, [])
    byCategory.get(element.category)!.push(element.globalId)
  }

  return DISCIPLINE_ORDER.filter((discipline) => byDiscipline.has(discipline)).map((discipline) => {
    const rows = Array.from(byDiscipline.get(discipline)!.entries())
      .map(([category, globalIds]) => ({ category, count: globalIds.length, globalIds }))
      .sort((a, b) => b.count - a.count)
    return { discipline, rows, total: rows.reduce((sum, row) => sum + row.count, 0) }
  })
}
