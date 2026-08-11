import type { BoqElementDetail } from '../ifc/ifcBoqDetails'

export interface BoqLevelGroup {
  level: string
  levelIndex: number | null
  count: number
  totalLength: number | null
  totalArea: number | null
  totalVolume: number | null
  elements: BoqElementDetail[]
}

export interface BoqCategoryGroup {
  category: string
  count: number
  totalLength: number | null
  totalArea: number | null
  totalVolume: number | null
  // Every element in the category, flat -- used for "Locate this whole
  // category" and the totals above. `levels` below is the same elements
  // regrouped by level for display; both exist so neither view has to
  // be reconstructed from the other.
  elements: BoqElementDetail[]
  levels: BoqLevelGroup[]
}

export interface BoqDisciplineGroup {
  discipline: string
  count: number
  categories: BoqCategoryGroup[]
}

const DISCIPLINE_ORDER = ['Architecture', 'Structure', 'MEP']
const NO_LEVEL_LABEL = 'No level'

// null (not 0) when none of a category's elements have that quantity at
// all -- distinguishes "genuinely zero" (can't actually happen for
// area/volume/length, but kept consistent) from "this export never
// populated Qto data for these elements," which the panel shows as "—"
// rather than a misleading 0.
function sumOrNull(values: (number | null)[]): number | null {
  const present = values.filter((value): value is number => value !== null)
  return present.length > 0 ? present.reduce((a, b) => a + b, 0) : null
}

// One category's elements, regrouped by level -- level *names* ("T/FDN",
// "Level 1", "Roof") don't sort correctly as plain strings, so this
// sorts by each level's own position in the building instead
// (BoqElementDetail.levelIndex, ultimately from ifc/ifcSpatialTree.ts's
// own bottom-to-top storey order -- see ifc/ifcBoqDetails.ts). Elements
// with no containing level at all (rare -- most real exports attach
// everything to a storey) are grouped under "No level", sorted last.
function groupByLevel(elements: BoqElementDetail[]): BoqLevelGroup[] {
  const byLevel = new Map<string, BoqElementDetail[]>()
  for (const element of elements) {
    const key = element.level ?? NO_LEVEL_LABEL
    if (!byLevel.has(key)) byLevel.set(key, [])
    byLevel.get(key)!.push(element)
  }

  return Array.from(byLevel.entries())
    .map(([level, levelElements]) => ({
      level,
      levelIndex: levelElements[0]?.levelIndex ?? null,
      count: levelElements.length,
      totalLength: sumOrNull(levelElements.map((e) => e.quantities.length)),
      totalArea: sumOrNull(levelElements.map((e) => e.quantities.area)),
      totalVolume: sumOrNull(levelElements.map((e) => e.quantities.volume)),
      elements: [...levelElements].sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => (a.levelIndex ?? Infinity) - (b.levelIndex ?? Infinity))
}

function buildCategoryGroup(category: string, elements: BoqElementDetail[]): BoqCategoryGroup {
  return {
    category,
    count: elements.length,
    totalLength: sumOrNull(elements.map((e) => e.quantities.length)),
    totalArea: sumOrNull(elements.map((e) => e.quantities.area)),
    totalVolume: sumOrNull(elements.map((e) => e.quantities.volume)),
    elements: [...elements].sort((a, b) => a.name.localeCompare(b.name)),
    levels: groupByLevel(elements),
  }
}

// Discipline > Category > Level > element tree for the BOQ panel -- the
// same grouping shape utils/scheduleData.ts used for the old count-only
// Schedule, extended with per-category quantity totals, a level
// breakdown, and the full element list underneath. Categories are
// sorted by element count (highest first, same reasoning as the old
// schedule: the categories with the most instances are generally what a
// takeoff cares about first).
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
      .map(([category, elements]) => buildCategoryGroup(category, elements))
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
        categories.push(buildCategoryGroup(category.category, elements))
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
// just the totals shown in the panel itself. Every dimension this app
// can detect goes in the export regardless of which columns the panel
// itself chose to display for that element's category (see
// utils/boqQuantityProfiles.ts) -- the panel hides columns that aren't
// usually relevant to keep the screen readable, but a spreadsheet
// export has no such reason to leave data out.
export function buildBoqCsv(details: BoqElementDetail[]): string {
  const header = [
    'Discipline',
    'Category',
    'Name',
    'Type',
    'Level',
    'Material',
    'Length (m)',
    'Width (m)',
    'Height (m)',
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
      formatNumber(detail.quantities.width, 2),
      formatNumber(detail.quantities.height, 2),
      formatNumber(detail.quantities.area, 2),
      formatNumber(detail.quantities.volume, 3),
    ]
      .map(csvCell)
      .join(','),
  )
  return [header.join(','), ...lines].join('\n')
}
