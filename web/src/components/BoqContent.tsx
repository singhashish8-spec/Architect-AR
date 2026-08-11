import { Fragment, useMemo, useState } from 'react'
import type { BoqElementDetail, BoqDebugSample } from '../ifc/ifcBoqDetails'
import { buildBoqTree, filterBoqTree, boqGrandTotals, buildBoqCsv, type BoqCategoryGroup } from '../utils/boqData'
import { getCategoryMetrics, SUMMABLE_METRICS, type QuantityMetric } from '../utils/boqQuantityProfiles'
import styles from './BoqContent.module.css'

export interface BoqContentProps {
  details: BoqElementDetail[] | null
  progress: { done: number; total: number } | null
  error: string | null
  csvFileName: string
  // A raw snapshot of the first element's own IFC data, for a collapsed
  // "Debug info" disclosure at the bottom of the page -- lets the app's
  // owner (or whoever's helping them) see exactly what the source file
  // actually contains without needing browser DevTools access, which
  // isn't practical on a phone. Added 2026-08-11 after exactly that
  // situation: a real report of blank quantities/materials that turned
  // out to need a live retest to diagnose, with no way to see what was
  // actually happening short of relaying screenshots back and forth.
  debugSample?: BoqDebugSample | null
  // On-demand debug for one specific row, not just whichever element
  // happened to be sampled first -- see ifc/useIfcElementData.ts's own
  // comment. Renders a small "Debug" button per element when provided;
  // omitted entirely hides that button (kept optional mainly so tests
  // that don't care about it can skip wiring up a mock).
  debugBoqElement?: (expressId: number, elementName: string) => Promise<BoqDebugSample | null>
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

// Shared between the top-of-page "Debug info" disclosure and each row's
// own on-demand debug expansion below -- same fields, same layout,
// different trigger.
function DebugSampleFields({ sample }: { sample: BoqDebugSample }) {
  return (
    <dl>
      <dt>Sampled element</dt>
      <dd>{sample.elementName}</dd>
      <dt>Property sets found</dt>
      <dd>{sample.propertySetCount}</dd>
      <dt>Property names seen</dt>
      <dd>{sample.propertyNamesSeen.length > 0 ? sample.propertyNamesSeen.join(', ') : '(none)'}</dd>
      <dt>Quantity names seen</dt>
      <dd>{sample.quantityNamesSeen.length > 0 ? sample.quantityNamesSeen.join(', ') : '(none)'}</dd>
      <dt>Material definitions found</dt>
      <dd>{sample.materialDefCount}</dd>
      {(sample.propertySetsPrimaryError || sample.propertySetsFallbackError) && (
        <>
          <dt>Property lookup errors</dt>
          <dd>
            {sample.propertySetsPrimaryError && <div>Primary: {sample.propertySetsPrimaryError}</div>}
            {sample.propertySetsFallbackError && <div>Fallback: {sample.propertySetsFallbackError}</div>}
          </dd>
        </>
      )}
      {(sample.materialsPrimaryError || sample.materialsFallbackError) && (
        <>
          <dt>Material lookup errors</dt>
          <dd>
            {sample.materialsPrimaryError && <div>Primary: {sample.materialsPrimaryError}</div>}
            {sample.materialsFallbackError && <div>Fallback: {sample.materialsFallbackError}</div>}
          </dd>
        </>
      )}
    </dl>
  )
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
export function BoqContent({
  details,
  progress,
  error,
  csvFileName,
  debugSample,
  debugBoqElement,
  onIsolate,
  onJumpTo,
}: BoqContentProps) {
  const [search, setSearch] = useState('')
  const [expandedDisciplines, setExpandedDisciplines] = useState<Set<string>>(new Set())
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [expandedLevels, setExpandedLevels] = useState<Set<string>>(new Set())
  // expressId -> sample once fetched, or null while a fetch is in
  // flight. Absent from the map entirely = never asked for.
  const [rowDebug, setRowDebug] = useState<Map<number, BoqDebugSample | null>>(new Map())

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

  async function toggleRowDebug(expressId: number, name: string) {
    if (rowDebug.has(expressId)) {
      setRowDebug((current) => {
        const next = new Map(current)
        next.delete(expressId)
        return next
      })
      return
    }
    if (!debugBoqElement) return
    setRowDebug((current) => new Map(current).set(expressId, null))
    const sample = await debugBoqElement(expressId, name)
    setRowDebug((current) => new Map(current).set(expressId, sample))
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

      {debugSample && (
        <details className={styles.debug}>
          <summary>Debug info</summary>
          <DebugSampleFields sample={debugSample} />
        </details>
      )}

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
                                      {debugBoqElement && <th />}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {levelGroup.elements.map((element) => {
                                      const totalColumns = 2 + columns.length + (canLocate ? 1 : 0) + (debugBoqElement ? 1 : 0)
                                      const sample = rowDebug.get(element.expressId)
                                      const debugOpen = rowDebug.has(element.expressId)
                                      return (
                                        <Fragment key={element.globalId}>
                                          <tr>
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
                                            {debugBoqElement && (
                                              <td>
                                                <button
                                                  type="button"
                                                  className={styles.rowLocateButton}
                                                  onClick={() => void toggleRowDebug(element.expressId, element.name)}
                                                  aria-label={`Debug ${element.name}`}
                                                  title="Show this element's raw IFC data"
                                                >
                                                  🛈
                                                </button>
                                              </td>
                                            )}
                                          </tr>
                                          {debugOpen && (
                                            <tr>
                                              <td colSpan={totalColumns} className={styles.rowDebugCell}>
                                                {sample ? <DebugSampleFields sample={sample} /> : 'Loading…'}
                                              </td>
                                            </tr>
                                          )}
                                        </Fragment>
                                      )
                                    })}
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
