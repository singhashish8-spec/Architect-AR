import type { Level } from '../ifc/ifcSpatialTree'
import type { ElementCategory } from '../ifc/ifcCategories'

export interface SearchResult {
  kind: 'level' | 'room' | 'category'
  label: string
  sublabel: string
  globalIds: string[]
}

// "Show me every door" -- searches by level name, room name, or category/
// discipline name (data already bulk-loaded for the Levels and Categories
// panels, so no extra IFC parsing needed) rather than every element's
// full property set, which isn't loaded for every element up front (only
// on tap) and would be far more expensive to search across. See
// docs/features/search-and-schedule.md.
export function buildResults(levels: Level[], categories: ElementCategory[]): SearchResult[] {
  const results: SearchResult[] = []

  for (const level of levels) {
    if (level.elementGlobalIds.length > 0) {
      results.push({ kind: 'level', label: level.name, sublabel: 'Level', globalIds: level.elementGlobalIds })
    }
    for (const room of level.rooms) {
      if (room.elementGlobalIds.length === 0) continue
      results.push({ kind: 'room', label: room.name, sublabel: `Room · ${level.name}`, globalIds: room.elementGlobalIds })
    }
  }

  const byCategory = new Map<string, { discipline: string; globalIds: string[] }>()
  for (const element of categories) {
    const key = `${element.discipline}::${element.category}`
    if (!byCategory.has(key)) byCategory.set(key, { discipline: element.discipline, globalIds: [] })
    byCategory.get(key)!.globalIds.push(element.globalId)
  }
  for (const [key, { discipline, globalIds }] of byCategory) {
    const category = key.split('::')[1]
    results.push({ kind: 'category', label: category, sublabel: `Category · ${discipline}`, globalIds })
  }

  return results
}
