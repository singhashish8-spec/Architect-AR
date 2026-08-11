import { Fragment, useMemo, useState } from 'react'
import type { BoqElementDetail, BoqDebugSample } from '../ifc/ifcBoqDetails'
import {
  boqCategoryKey,
  buildBoqTree,
  filterBoqTree,
  boqGrandTotals,
  buildBoqCsv,
  type BoqDisciplineGroup,
} from '../utils/boqData'
import { buildAndDownloadBoqExcel } from '../utils/boqExcel'
import {
  getCategoryMetrics,
  SUMMABLE_METRICS,
  METRIC_ORDER,
  METRIC_LABEL,
  METRIC_UNIT,
  type QuantityMetric,
} from '../utils/boqQuantityProfiles'
import { getErrorMessage } from '../utils/errorMessage'
import styles from './BoqContent.module.css'

export interface BoqContentProps {
  details: BoqElementDetail[] | null
  progress: { done: number; total: number } | null
  error: string | null
  csvFileName: string
  // Both optional -- only used to label the Excel export's title block.
  // Falls back to generic placeholders when omitted (pages/LocalPreview.tsx
  // has no real project/model name to give).
  projectName?: string
  modelName?: string
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
  // Both omitted on the standalone Quantity Takeoff page
  // (pages/BoqView.tsx) -- there's no 3D viewer there to isolate/frame a
  // camera in, so "Locate" buttons simply don't render rather than doing
  // nothing when clicked.
  onIsolate?: (hiddenGlobalIds: Set<string>) => void
  onJumpTo?: (globalIds: string[]) => void
}

// Company name for the Excel export's title block -- there's no such
// field on the `projects` table (a DB migration felt like overkill for
// one cosmetic export label), so it's just remembered per-browser. Once
// typed in, it stays for every future export on this device.
const COMPANY_NAME_STORAGE_KEY = 'architect-ar:company-name'

function loadCompanyName(): string {
  try {
    return window.localStorage.getItem(COMPANY_NAME_STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

function saveCompanyName(value: string) {
  try {
    window.localStorage.setItem(COMPANY_NAME_STORAGE_KEY, value)
  } catch {
    // Private browsing / storage disabled -- the export still works,
    // it just won't remember the name for next time.
  }
}

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

interface ScheduleTableProps {
  elements: BoqElementDetail[]
  columns: QuantityMetric[]
  showLevelColumn: boolean
  canLocate: boolean
  debugBoqElement?: (expressId: number, elementName: string) => Promise<BoqDebugSample | null>
  rowDebug: Map<number, BoqDebugSample | null | 'error'>
  onToggleRowDebug: (expressId: number, name: string) => void
  onLocate: (globalIds: string[]) => void
}

// One category's dedicated table -- a real architectural schedule: a
// running "No." index, every element on its own row, and (when not
// grouped by level -- see the per-category toggle in the main component
// below) a Level column so the whole category reads as one flat sheet,
// the same shape a "Door Schedule"/"Wall Schedule" takes in Revit's own
// schedule views. Shared between the flat rendering and each level's own
// sub-table when grouping is switched on, so row markup (including the
// on-demand debug expansion) never has to be written twice.
function ScheduleTable({
  elements,
  columns,
  showLevelColumn,
  canLocate,
  debugBoqElement,
  rowDebug,
  onToggleRowDebug,
  onLocate,
}: ScheduleTableProps) {
  const totalColumns = 2 + (showLevelColumn ? 1 : 0) + columns.length + (canLocate ? 1 : 0) + (debugBoqElement ? 1 : 0)

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.indexColumn}>No.</th>
            <th>Name</th>
            {showLevelColumn && <th>Level</th>}
            <th>Material</th>
            {columns.map((metric) => (
              <th key={metric}>{METRIC_LABEL[metric]}</th>
            ))}
            {canLocate && <th />}
            {debugBoqElement && <th />}
          </tr>
        </thead>
        <tbody>
          {elements.map((element, index) => {
            const sample = rowDebug.get(element.expressId)
            const debugOpen = rowDebug.has(element.expressId)
            return (
              <Fragment key={element.globalId}>
                <tr>
                  <td className={styles.indexCell}>{index + 1}</td>
                  <td>{element.name}</td>
                  {showLevelColumn && <td>{element.level ?? '—'}</td>}
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
                        onClick={() => onLocate([element.globalId])}
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
                        className={styles.rowDebugButton}
                        onClick={() => onToggleRowDebug(element.expressId, element.name)}
                        aria-label={`Debug ${element.name}`}
                        title="Show this element's raw IFC data"
                      >
                        Debug
                      </button>
                    </td>
                  )}
                </tr>
                {debugOpen && (
                  <tr>
                    <td colSpan={totalColumns} className={styles.rowDebugCell}>
                      {sample === null && 'Loading…'}
                      {sample === 'error' && 'Could not load debug data for this element.'}
                      {sample && sample !== 'error' && <DebugSampleFields sample={sample} />}
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// Every discipline/category/level key in the tree, flattened -- used by
// "Expand all" to open everything regardless of what's currently
// visible under a search filter.
function allKeys(tree: BoqDisciplineGroup[]) {
  const disciplines = new Set<string>()
  const categories = new Set<string>()
  const levels = new Set<string>()
  for (const discipline of tree) {
    disciplines.add(discipline.discipline)
    for (const category of discipline.categories) {
      const key = boqCategoryKey(discipline.discipline, category.category)
      categories.add(key)
      for (const levelGroup of category.levels) levels.add(`${key} ${levelGroup.level}`)
    }
  }
  return { disciplines, categories, levels }
}

// The actual Quantity Takeoff content -- loading/error state, whole-model
// totals, search + CSV/Excel export, and the Discipline > Category tree.
// Each category renders as its own dedicated schedule table, with
// columns that adapt per category (a beam shows Length/Width/Height/
// Volume; a door just shows a count -- see utils/boqQuantityProfiles.ts)
// and a per-category toggle for whether it's shown as one flat table
// (default -- a Level column, like a real Revit schedule) or grouped
// into a sub-table per level. Shared between the in-viewer overlay
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
  projectName,
  modelName,
  debugSample,
  debugBoqElement,
  onIsolate,
  onJumpTo,
}: BoqContentProps) {
  const [search, setSearch] = useState('')
  const [expandedDisciplines, setExpandedDisciplines] = useState<Set<string>>(new Set())
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [expandedLevels, setExpandedLevels] = useState<Set<string>>(new Set())
  // categoryKey -> true means "grouped into a sub-table per level";
  // absent/false is the default flat schedule (one table, a Level
  // column). Owner's own ask, 2026-08-11: "add a toggle option for
  // levels to each element".
  const [groupByLevel, setGroupByLevel] = useState<Set<string>>(new Set())
  // expressId -> sample once fetched, null while a fetch is in flight,
  // or 'error' if debugBoqElement() itself rejected. Absent from the map
  // entirely = never asked for.
  const [rowDebug, setRowDebug] = useState<Map<number, BoqDebugSample | null | 'error'>>(new Map())
  const [companyName, setCompanyName] = useState(loadCompanyName)
  const [excelBusy, setExcelBusy] = useState(false)
  const [excelError, setExcelError] = useState<string | null>(null)

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

  function toggleGroupByLevel(key: string) {
    setGroupByLevel((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function expandAll() {
    const keys = allKeys(tree)
    setExpandedDisciplines(keys.disciplines)
    setExpandedCategories(keys.categories)
    setExpandedLevels(keys.levels)
  }

  function collapseAll() {
    setExpandedDisciplines(new Set())
    setExpandedCategories(new Set())
    setExpandedLevels(new Set())
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
    try {
      const sample = await debugBoqElement(expressId, name)
      setRowDebug((current) => new Map(current).set(expressId, sample))
    } catch {
      setRowDebug((current) => new Map(current).set(expressId, 'error'))
    }
  }

  function handleCompanyNameChange(value: string) {
    setCompanyName(value)
    saveCompanyName(value)
  }

  async function exportExcel() {
    if (!details || details.length === 0) return
    setExcelBusy(true)
    setExcelError(null)
    try {
      await buildAndDownloadBoqExcel(
        tree,
        (key) => groupByLevel.has(key),
        {
          projectName: projectName || 'Untitled project',
          companyName,
          modelName: modelName || 'Model',
          generatedOn: new Date().toLocaleDateString(),
        },
        csvFileName.replace(/\.csv$/i, '.xlsx'),
      )
    } catch (err) {
      setExcelError(getErrorMessage(err, 'Could not build the Excel export.'))
    } finally {
      setExcelBusy(false)
    }
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
        <button type="button" className={styles.exportButton} onClick={expandAll} disabled={searching}>
          Expand all
        </button>
        <button type="button" className={styles.exportButton} onClick={collapseAll} disabled={searching}>
          Collapse all
        </button>
      </div>

      <div className={styles.toolbar}>
        <input
          type="text"
          className={styles.search}
          placeholder="Company name (shown on the Excel export)"
          value={companyName}
          onChange={(event) => handleCompanyNameChange(event.target.value)}
        />
        <button
          type="button"
          className={styles.exportButton}
          onClick={() => downloadCsv(csvFileName, buildBoqCsv(details))}
          disabled={details.length === 0}
        >
          Export CSV
        </button>
        <button type="button" className={styles.exportButton} onClick={() => void exportExcel()} disabled={details.length === 0 || excelBusy}>
          {excelBusy ? 'Preparing…' : 'Export Excel'}
        </button>
      </div>
      {excelError && (
        <p role="alert" className={styles.error}>
          {excelError}
        </p>
      )}

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
                const key = boqCategoryKey(discipline.discipline, category.category)
                const categoryOpen = searching || expandedCategories.has(key)
                const grouped = groupByLevel.has(key)
                const metrics = getCategoryMetrics(category.category)
                const columns = METRIC_ORDER.filter((metric) => metrics.includes(metric))
                const totalsByMetric: Partial<Record<QuantityMetric, number | null>> = {
                  length: category.totalLength,
                  area: category.totalArea,
                  volume: category.totalVolume,
                }
                const flatElements = category.levels.flatMap((l) => l.elements)

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
                        <span className={styles.categoryName}>{category.category} Schedule</span>
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
                      {category.levels.length > 1 && (
                        <label className={styles.levelToggle}>
                          <input type="checkbox" checked={grouped} onChange={() => toggleGroupByLevel(key)} />
                          Group by level
                        </label>
                      )}
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
                      (grouped ? (
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
                                <ScheduleTable
                                  elements={levelGroup.elements}
                                  columns={columns}
                                  showLevelColumn={false}
                                  canLocate={canLocate}
                                  debugBoqElement={debugBoqElement}
                                  rowDebug={rowDebug}
                                  onToggleRowDebug={(id, name) => void toggleRowDebug(id, name)}
                                  onLocate={locate}
                                />
                              )}
                            </div>
                          )
                        })
                      ) : (
                        <ScheduleTable
                          elements={flatElements}
                          columns={columns}
                          showLevelColumn={true}
                          canLocate={canLocate}
                          debugBoqElement={debugBoqElement}
                          rowDebug={rowDebug}
                          onToggleRowDebug={(id, name) => void toggleRowDebug(id, name)}
                          onLocate={locate}
                        />
                      ))}
                  </div>
                )
              })}
          </div>
        )
      })}
    </>
  )
}
