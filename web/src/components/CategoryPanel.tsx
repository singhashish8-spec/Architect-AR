import { useEffect, useMemo, useState } from 'react'
import type { ElementCategory } from '../ifc/ifcCategories'
import styles from './CategoryPanel.module.css'

interface CategoryPanelProps {
  categories: ElementCategory[]
  // Expected to be a stable function reference (e.g. a useState setter
  // passed directly, not a new arrow function each render) -- it's a
  // dependency of this component's own effect below, and an unstable
  // reference here would re-fire that effect (and its parent setState)
  // every render.
  onHiddenGlobalIdsChange: (hidden: Set<string>) => void
}

interface CategoryGroup {
  discipline: string
  categories: { name: string; globalIds: string[] }[]
}

const DISCIPLINE_ORDER = ['Architecture', 'Structure', 'MEP']

function groupByDiscipline(categories: ElementCategory[]): CategoryGroup[] {
  const byDiscipline = new Map<string, Map<string, string[]>>()
  for (const element of categories) {
    if (!byDiscipline.has(element.discipline)) byDiscipline.set(element.discipline, new Map())
    const byCategory = byDiscipline.get(element.discipline)!
    if (!byCategory.has(element.category)) byCategory.set(element.category, [])
    byCategory.get(element.category)!.push(element.globalId)
  }

  return DISCIPLINE_ORDER.filter((discipline) => byDiscipline.has(discipline)).map((discipline) => ({
    discipline,
    categories: Array.from(byDiscipline.get(discipline)!.entries())
      .map(([name, globalIds]) => ({ name, globalIds }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  }))
}

// Lets a client hide whole categories of elements (walls, furniture,
// specific MEP systems, etc.) instead of only being able to look at
// everything at once. See
// docs/features/category-and-discipline-visibility.md.
export function CategoryPanel({ categories, onHiddenGlobalIdsChange }: CategoryPanelProps) {
  const [open, setOpen] = useState(false)
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(new Set())

  const groups = useMemo(() => groupByDiscipline(categories), [categories])

  useEffect(() => {
    const hiddenGlobalIds = new Set<string>()
    for (const group of groups) {
      for (const category of group.categories) {
        if (!hiddenKeys.has(`${group.discipline}::${category.name}`)) continue
        for (const globalId of category.globalIds) hiddenGlobalIds.add(globalId)
      }
    }
    onHiddenGlobalIdsChange(hiddenGlobalIds)
  }, [hiddenKeys, groups, onHiddenGlobalIdsChange])

  if (categories.length === 0) return null

  function toggleCategory(key: string) {
    setHiddenKeys((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div>
      <button type="button" className={styles.toggle} onClick={() => setOpen((current) => !current)}>
        {open ? 'Hide categories' : 'Show/hide categories'}
      </button>
      {open && (
        <div className={styles.panel}>
          {groups.map((group) => (
            <div key={group.discipline}>
              <h3 className={styles.disciplineHeading}>{group.discipline}</h3>
              <ul className={styles.list}>
                {group.categories.map((category) => {
                  const key = `${group.discipline}::${category.name}`
                  return (
                    <li key={key}>
                      <label className={styles.checkboxRow}>
                        <input
                          type="checkbox"
                          checked={!hiddenKeys.has(key)}
                          onChange={() => toggleCategory(key)}
                        />
                        {category.name}
                      </label>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
