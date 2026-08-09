import { useEffect, useMemo, useState } from 'react'
import type { ElementCategory } from '../ifc/ifcCategories'
import styles from './CategoryPanel.module.css'
import labelStyles from '../styles/responsiveLabel.module.css'

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
  // Each discipline's category list starts collapsed -- same reasoning
  // as LevelsPanel's per-level collapse: a real building can have a
  // couple dozen categories once MEP is involved, and showing every
  // discipline's full list at once defeats the point of a compact panel.
  const [expandedDisciplines, setExpandedDisciplines] = useState<Set<string>>(new Set())

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

  function toggleDiscipline(discipline: string) {
    setExpandedDisciplines((current) => {
      const next = new Set(current)
      if (next.has(discipline)) next.delete(discipline)
      else next.add(discipline)
      return next
    })
  }

  return (
    <div>
      <button
        type="button"
        className={styles.toggle}
        onClick={() => setOpen((current) => !current)}
        aria-label={open ? 'Hide categories' : 'Show/hide categories'}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </svg>
        <span className={labelStyles.label}>{open ? 'Hide categories' : 'Show/hide categories'}</span>
      </button>
      {open && (
        <div className={styles.panel}>
          {groups.map((group) => {
            const expanded = expandedDisciplines.has(group.discipline)
            return (
              <div key={group.discipline}>
                <button
                  type="button"
                  className={styles.disciplineHeading}
                  onClick={() => toggleDiscipline(group.discipline)}
                  aria-label={expanded ? `Collapse ${group.discipline}` : `Expand ${group.discipline}`}
                >
                  <svg
                    className={expanded ? styles.chevronOpen : styles.chevron}
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                  {group.discipline}
                </button>
                {expanded && (
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
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
