import { useMemo, useState } from 'react'
import type { BoqElementDetail } from '../ifc/ifcBoqDetails'
import { buildBoqTree, filterBoqTree, boqGrandTotals, buildBoqCsv, type BoqCategoryGroup } from '../utils/boqData'
import { getCategoryMetrics, SUMMABLE_METRICS, type QuantityMetric } from '../utils/boqQuantityProfiles'
import styles from './BoqContent.module.css'

export interface BoqContentProps {
  details: BoqElementDetail[] | null
  progress: { done: number; total: number } | null
  error: string | null
  csvFileName: string
  // Both omitted on the standalone BOQ page (pages/BoqView.tsx) -- there's
  // no 3D viewer there to isolate/frame a camera in, so "Locate" buttons
  // simply don't render rather than doing nothing when clicked.
  onIsolate?: (hiddenGlobalIds: Set<string>) => void
  onJumpTo?: (globalIds: string[]) => void
}

const METRIC_ORDER: QuantityMetric[] = ['length', 'width', 'height', 'area', 'volume']
const METRIC_LABEL: Record<QuantityMetric, string> = {
  length: 'Length',
  width: 'Width',
  height: 'Height',
  area: 'Area',
  volume: 'Volume',
}
const METRIC_UNIT: Record<QuantityMetric, string> = { length: 'm', width: 'm', height: 'm', area: 'm²', volume: 'm³' }

function formatQuantity(value: number | null, unit: string): string {
  return value === null ? '—' : `${value.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 0 })} ${unit}`
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

// The actual BOQ content -- loading/error state, whole-model totals,
// search + CSV export, and the Discipline > Category > element tree,
// with columns that adapt per category (a beam shows Length/Width/
// Height/Volume; a door just shows a count -- see
// utils/boqQuantityProfiles.ts). Shared between the in-viewer overlay
// (components/BoqPanel.tsx) and the standalone page
// (pages/BoqView.tsx) -- everything here is presentational, driven
// entirely by props; the two callers differ only in how `details` gets
// loaded and whether a 3D viewer exists to locate elements in. See
// docs/features/boq.md.
export function BoqContent({ details, progress, error, csvFileName, onIsolate, onJumpTo }: BoqContentProps) {
  const [search, setSearch] = useState('')
  const [expandedDisciplines, setExpandedDisciplines] = useState<Set<string>>(new Set())
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [expandedLevels, setExpandedLevels] = useState<Set<string>>(new Set())

  const tree = useMemo(() => buildBoqTree(details ?? []), [details])
  const visibleTree = useMemo(() => filterBoqTree(tree, search), [tree, search])
  const totals = useMemo(() => boqGrandTotals(tree), [tree])
  const searching = search.trim() !== ''
  const canLocate = Boolean(onIsolate && onJumpTo)

  function toggleDiscipline(discipline: string) {
    setExpandedDisciplines((current) => {
      const next = new Set(current)
      if (next.has(discipline)) next.delete(discipline)
      else next.add(discipline)
      return next
    })
  }

  function toggleCategory(key: string) {
    setExpandedCategories((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function toggleLevel(key: string) {
    setExpandedLevels((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function locate(globalIds: string[]) {
    if (!onIsolate || !onJumpTo || !details) return
    const keep = new Set(globalIds)
    const hidden = new Set<string>()
    for (const detail of details) {
      if (!keep.has(detail.globalId)) hidden.add(detail.globalId)
    }
    onIsolate(hidden)
    onJumpTo(globalIds)
  }

  function categoryKey(discipline: string, category: BoqCategoryGroup): string {
    return `${discipline} ${category.category}`
  }

  if (error) {
    return (
      <p role="alert" className={styles.error}>
        {error}
      </p>
    )
  }

  if (!details) {
    return (
      <div className={styles.loading}>
        <p className={styles.subtitle}>
          Reading materials and quantities from the model
          {progress ? ` — ${progress.done} of ${progress.total} elements…` : '…'}
        </p>
        {progress && (
          <div className={styles.progressTrack}>
            <div className={styles.progressFill} style={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%` }} />
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      <p className={styles.subtitle}>
        {totals.count} elements
        {totals.totalArea !== null && ` · ${formatQuantity(totals.totalArea, 'm²')} total area`}
        {totals.totalVolume !== null && ` · ${formatQuantity(totals.totalVolume, 'm³')} total volume`}
      </p>
      <p className={styles.caveat}>
        Quantities and materials reflect whatever this file's own export actually recorded — not every element type
        carries them.
      </p>

      <div className={styles.toolbar}>
        <input
          type="text"
          className={styles.search}
          placeholder="Search name, category, material…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <button
          type="button"
          className={styles.exportButton}
          onClick={() => downloadCsv(csvFileName, buildBoqCsv(details))}
          disabled={details.length === 0}
        >
          Export CSV
        </button>
      </div>

      {visibleTree.length === 0 && <p className={styles.subtitle}>No elements match "{search}".</p>}

      {visibleTree.map((discipline) => {
        const disciplineOpen = searching || expandedDisciplines.has(discipline.discipline)
        return (
          <div key={discipline.discipline} className={styles.disciplineGroup}>
            <button
              type="button"
              className={styles.disciplineHeader}
              onClick={() => toggleDiscipline(discipline.discipline)}
              aria-expanded={disciplineOpen}
            >
              <span className={disciplineOpen ? styles.chevronOpen : styles.chevron}>▸</span>
              <span className={styles.disciplineName}>{discipline.discipline}</span>
              <span className={styles.disciplineCount}>{discipline.count}</span>
            </button>

            {disciplineOpen &&
              discipline.categories.map((category) => {
                const key = categoryKey(discipline.discipline, category)
                const categoryOpen = searching || expandedCategories.has(key)
                const metrics = getCategoryMetrics(category.category)
                const columns = METRIC_ORDER.filter((metric) => metrics.includes(metric))
                const totalsByMetric: Partial<Record<QuantityMetric, number | null>> = {
                  length: category.totalLength,
                  area: category.totalArea,
                  volume: category.totalVolume,
                }

                return (
                  <div key={key} className={styles.categoryGroup}>
                    <div className={styles.categoryHeaderRow}>
                      <button
                        type="button"
                        className={styles.categoryHeader}
                        onClick={() => toggleCategory(key)}
                        aria-expanded={categoryOpen}
                      >
                        <span className={categoryOpen ? styles.chevronOpen : styles.chevron}>▸</span>
                        <span className={styles.categoryName}>{category.category}</span>
                        <span className={styles.categoryBadges}>
                          <span className={styles.badge}>{category.count}</span>
                          {columns
                            .filter((metric) => SUMMABLE_METRICS.includes(metric) && totalsByMetric[metric] !== null)
                            .map((metric) => (
                              <span key={metric} className={styles.badge}>
                                {formatQuantity(totalsByMetric[metric] ?? null, METRIC_UNIT[metric])}
                              </span>
                            ))}
                        </span>
                      </button>
                      {canLocate && (
                        <button
                          type="button"
                          className={styles.locateButton}
                          onClick={() => locate(category.elements.map((e) => e.globalId))}
                          title={`Isolate every ${category.category} and frame the camera around them`}
                        >
                          Locate
                        </button>
                      )}
                    </div>

                    {categoryOpen &&
                      category.levels.map((levelGroup) => {
                        const lKey = `${key} ${levelGroup.level}`
                        const levelOpen = searching || expandedLevels.has(lKey)
                        const levelTotalsByMetric: Partial<Record<QuantityMetric, number | null>> = {
                          length: levelGroup.totalLength,
                          area: levelGroup.totalArea,
                          volume: levelGroup.totalVolume,
                        }

                        return (
                          <div key={lKey} className={styles.levelGroup}>
                            <div className={styles.categoryHeaderRow}>
                              <button
                                type="button"
                                className={styles.levelHeader}
                                onClick={() => toggleLevel(lKey)}
                                aria-expanded={levelOpen}
                              >
                                <span className={levelOpen ? styles.chevronOpen : styles.chevron}>▸</span>
                                <span className={styles.levelName}>{levelGroup.level}</span>
                                <span className={styles.categoryBadges}>
                                  <span className={styles.badge}>{levelGroup.count}</span>
                                  {columns
                                    .filter(
                                      (metric) =>
                                        SUMMABLE_METRICS.includes(metric) && levelTotalsByMetric[metric] !== null,
                                    )
                                    .map((metric) => (
                                      <span key={metric} className={styles.badge}>
                                        {formatQuantity(levelTotalsByMetric[metric] ?? null, METRIC_UNIT[metric])}
                                      </span>
                                    ))}
                                </span>
                              </button>
                              {canLocate && (
                                <button
                                  type="button"
                                  className={styles.locateButton}
                                  onClick={() => locate(levelGroup.elements.map((e) => e.globalId))}
                                  title={`Isolate every ${category.category} on ${levelGroup.level} and frame the camera around them`}
                                >
                                  Locate
                                </button>
                              )}
                            </div>

                            {levelOpen && (
                              <div className={styles.tableWrap}>
                                <table className={styles.table}>
                                  <thead>
                                    <tr>
                                      <th>Name</th>
                                      <th>Material</th>
                                      {columns.map((metric) => (
                                        <th key={metric}>{METRIC_LABEL[metric]}</th>
                                      ))}
                                      {canLocate && <th />}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {levelGroup.elements.map((element) => (
                                      <tr key={element.globalId}>
                                        <td>{element.name}</td>
                                        <td>{element.materials.length > 0 ? element.materials.join(', ') : '—'}</td>
                                        {columns.map((metric) => (
                                          <td key={metric} className={styles.numberCell}>
                                            {formatQuantity(element.quantities[metric], METRIC_UNIT[metric])}
                                          </td>
                                        ))}
                                        {canLocate && (
                                          <td>
                                            <button
                                              type="button"
                                              className={styles.rowLocateButton}
                                              onClick={() => locate([element.globalId])}
                                              aria-label={`Locate ${element.name}`}
                                              title="Isolate and frame this element"
                                            >
                                              ⌖
                                            </button>
                                          </td>
                                        )}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        )
                      })}
                  </div>
                )
              })}
          </div>
        )
      })}
    </>
  )
}
