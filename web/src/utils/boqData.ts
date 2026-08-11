import type { BoqElementDetail } from '../ifc/ifcBoqDetails'

export interface BoqCategoryGroup {
  category: string
  count: number
  totalLength: number | null
  totalArea: number | null
  totalVolume: number | null
  elements: BoqElementDetail[]
}

export interface BoqDisciplineGroup {
  discipline: string
  count: number
  categories: BoqCategoryGroup[]
}

const DISCIPLINE_ORDER = ['Architecture', 'Structure', 'MEP']

// null (not 0) when none of a category's elements have that quantity at
// all -- distinguishes "genuinely zero" (can't actually happen for
// area/volume/length, but kept consistent) from "this export never
// populated Qto data for these elements," which the panel shows as "—"
// rather than a misleading 0.
function sumOrNull(values: (number | null)[]): number | null {
  const present = values.filter((value): value is number => value !== null)
  return present.length > 0 ? present.reduce((a, b) => a + b, 0) : null
}

// Discipline > Category > element tree for the BOQ panel -- the same
// grouping shape utils/scheduleData.ts used for the old count-only
// Schedule, extended with per-category quantity totals and the full
// element list (not just a count) underneath. Categories are sorted by
// element count (highest first, same reasoning as the old schedule: the
// categories with the most instances are generally what a takeoff cares
// about first); elements within a category are sorted by name so the
// list reads predictably rather than in arbitrary IFC file order.
export function buildBoqTree(details: BoqElementDetail[]): BoqDisciplineGroup[] {
  const byDiscipline = new Map<string, Map<string, BoqElementDetail[]>>()
  for (const detail of details) {
    if (!byDiscipline.has(detail.discipline)) byDiscipline.set(detail.discipline, new Map())
    const byCategory = byDiscipline.get(detail.discipline)!
    if (!byCategory.has(detail.category)) byCategory.set(detail.category, [])
    byCategory.get(detail.category)!.push(detail)
  }

  const seen = Array.from(byDiscipline.keys())
  const orderedDisciplines = [
    ...DISCIPLINE_ORDER.filter((discipline) => seen.includes(discipline)),
    ...seen.filter((discipline) => !DISCIPLINE_ORDER.includes(discipline)),
  ]

  return orderedDisciplines.map((discipline) => {
    const byCategory = byDiscipline.get(discipline)!
    const categories = Array.from(byCategory.entries())
      .map(([category, elements]) => ({
        category,
        count: elements.length,
        totalLength: sumOrNull(elements.map((e) => e.quantities.length)),
        totalArea: sumOrNull(elements.map((e) => e.quantities.area)),
        totalVolume: sumOrNull(elements.map((e) => e.quantities.volume)),
        elements: [...elements].sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => b.count - a.count)

    return {
      discipline,
      count: categories.reduce((sum, group) => sum + group.count, 0),
      categories,
    }
  })
}

function elementMatches(element: BoqElementDetail, query: string): boolean {
  const haystack = `${element.name} ${element.type} ${element.category} ${element.level ?? ''} ${element.materials.join(' ')}`.toLowerCase()
  return haystack.includes(query)
}

// A category matches wholesale if its own name matches (keeps every
// element in it, same as typing "doors"); otherwise it survives only if
// some of its elements individually match (e.g. typing a material name
// like "oak" should surface just the oak-faced doors, not every door).
// Live-filters the already-built tree rather than rebuilding it from
// scratch on every keystroke -- buildBoqTree() only needs to run once
// per BOQ load.
export function filterBoqTree(tree: BoqDisciplineGroup[], query: string): BoqDisciplineGroup[] {
  const trimmed = query.trim().toLowerCase()
  if (!trimmed) return tree

  const filtered: BoqDisciplineGroup[] = []
  for (const discipline of tree) {
    const categories: BoqCategoryGroup[] = []
    for (const category of discipline.categories) {
      if (category.category.toLowerCase().includes(trimmed)) {
        categories.push(category)
        continue
      }
      const elements = category.elements.filter((element) => elementMatches(element, trimmed))
      if (elements.length > 0) {
        categories.push({
          ...category,
          elements,
          count: elements.length,
          totalLength: sumOrNull(elements.map((e) => e.quantities.length)),
          totalArea: sumOrNull(elements.map((e) => e.quantities.area)),
          totalVolume: sumOrNull(elements.map((e) => e.quantities.volume)),
        })
      }
    }
    if (categories.length > 0) {
      filtered.push({ discipline: discipline.discipline, categories, count: categories.reduce((sum, c) => sum + c.count, 0) })
    }
  }
  return filtered
}

export interface BoqTotals {
  count: number
  totalArea: number | null
  totalVolume: number | null
}

// Whole-model totals across every discipline -- shown once at the top of
// the panel, same "—" -for-nothing-recorded convention as the per-category
// totals above.
export function boqGrandTotals(tree: BoqDisciplineGroup[]): BoqTotals {
  const allCategories = tree.flatMap((d) => d.categories)
  return {
    count: allCategories.reduce((sum, c) => sum + c.count, 0),
    totalArea: sumOrNull(allCategories.map((c) => c.totalArea)),
    totalVolume: sumOrNull(allCategories.map((c) => c.totalVolume)),
  }
}

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

function formatNumber(value: number | null, digits: number): string {
  return value === null ? '' : value.toFixed(digits)
}

// One row per element, flattened out of the discipline/category tree --
// a real takeoff spreadsheet wants every instance on its own line, not
// just the totals shown in the panel itself.
export function buildBoqCsv(details: BoqElementDetail[]): string {
  const header = [
    'Discipline',
    'Category',
    'Name',
    'Type',
    'Level',
    'Material',
    'Length (m)',
    'Area (m2)',
    'Volume (m3)',
  ]
  const lines = details.map((detail) =>
    [
      detail.discipline,
      detail.category,
      detail.name,
      detail.type,
      detail.level ?? '',
      detail.materials.join('; '),
      formatNumber(detail.quantities.length, 2),
      formatNumber(detail.quantities.area, 2),
      formatNumber(detail.quantities.volume, 3),
    ]
      .map(csvCell)
      .join(','),
  )
  return [header.join(','), ...lines].join('\n')
}
