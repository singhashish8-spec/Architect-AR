import { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { getProjectViewHistory, type ProjectViewRecord } from '../../services/adminService'
import { getErrorMessage } from '../../utils/errorMessage'
import type { AdminProjectPageContext } from './AdminProjectPage'
import styles from './AdminProjectAnalytics.module.css'
import formStyles from '../../styles/form.module.css'

const CHART_DAYS = 14

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return '—'
  const minutes = Math.floor(seconds / 60)
  const remaining = Math.round(seconds % 60)
  return minutes > 0 ? `${minutes}m ${remaining}s` : `${remaining}s`
}

function padTwo(n: number): string {
  return n < 10 ? `0${n}` : `${n}`
}

// A local-calendar-day key, deliberately NOT going through
// toISOString()/slice(0, 10) -- Postgres returns UTC timestamps, and
// doing that conversion buckets every view by its UTC day instead of
// the viewer's own local day, silently shifting the whole chart by a
// day for any positive-UTC-offset timezone (e.g. IST, UTC+5:30: local
// midnight is still the previous UTC day).
function localDayKey(date: Date): string {
  return `${date.getFullYear()}-${padTwo(date.getMonth() + 1)}-${padTwo(date.getDate())}`
}

// Last CHART_DAYS calendar days ending today, oldest first -- filled in
// with zero-view days so a quiet project shows a flat baseline instead
// of the bars silently compressing to only the days that had a visit.
// Keeps each bucket's own Date object (not just its string key) so the
// day-of-month label can be read directly off it instead of
// re-parsing a date-only string, which Date treats as UTC midnight and
// would shift the displayed day again on the way back through
// toLocaleDateString().
function buildDailyCounts(views: ProjectViewRecord[]): { key: string; date: Date; count: number }[] {
  const counts = new Map<string, number>()
  for (const view of views) {
    const key = localDayKey(new Date(view.viewedAt))
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  const days: { key: string; date: Date; count: number }[] = []
  const cursor = new Date()
  cursor.setHours(0, 0, 0, 0)
  for (let i = CHART_DAYS - 1; i >= 0; i--) {
    const d = new Date(cursor)
    d.setDate(d.getDate() - i)
    days.push({ key: localDayKey(d), date: d, count: counts.get(localDayKey(d)) ?? 0 })
  }
  return days
}

function downloadCsv(filename: string, rows: ProjectViewRecord[]) {
  const header = ['Viewed at', 'Duration (seconds)', 'Model']
  const lines = rows.map((row) =>
    [new Date(row.viewedAt).toISOString(), row.durationSeconds ?? '', row.modelName ?? ''].map((cell) => {
      const value = String(cell)
      return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
    }).join(','),
  )
  const csv = [header.join(','), ...lines].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

// Per-visit history, a views-per-day chart, and a CSV export -- the
// "richer analytics" still open in docs/features/full-admin-dashboard.md.
// get_admin_projects() already gives the dashboard its aggregate stats
// (view_count/last_viewed_at/avg_duration_seconds, shown on Overview);
// this tab is the raw rows behind that aggregate. No chart library --
// a handmade SVG bar chart matches this codebase's existing
// no-new-dependency, hand-drawn-icon style.
export function AdminProjectAnalytics() {
  const { project, passcode } = useOutletContext<AdminProjectPageContext>()
  const [views, setViews] = useState<ProjectViewRecord[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    void (async () => {
      setViews(null)
      setError(null)
      try {
        const rows = await getProjectViewHistory(passcode, project.id)
        if (!cancelled) setViews(rows)
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err, 'Could not load visit history.'))
      }
    })()

    return () => {
      cancelled = true
    }
  }, [passcode, project.id])

  const dailyCounts = useMemo(() => buildDailyCounts(views ?? []), [views])
  const maxCount = Math.max(1, ...dailyCounts.map((d) => d.count))

  if (error) {
    return (
      <p role="alert" className={formStyles.error}>
        {error}
      </p>
    )
  }

  if (!views) {
    return <p className={formStyles.subtitle}>Loading visit history…</p>
  }

  return (
    <div>
      <div className={styles.chartHeader}>
        <h2 className={styles.sectionTitle}>Views, last {CHART_DAYS} days</h2>
        <button
          type="button"
          className={styles.exportButton}
          onClick={() => downloadCsv(`${project.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-visits.csv`, views)}
          disabled={views.length === 0}
        >
          Export CSV
        </button>
      </div>

      <div className={styles.chart} role="img" aria-label={`Views per day over the last ${CHART_DAYS} days`}>
        {dailyCounts.map((day) => (
          <div key={day.key} className={styles.chartBar}>
            <span
              className={styles.chartBarFill}
              style={{ height: `${(day.count / maxCount) * 100}%` }}
              title={`${day.count} view${day.count === 1 ? '' : 's'} on ${day.date.toLocaleDateString(undefined, { dateStyle: 'medium' })}`}
            />
            <span className={styles.chartBarLabel}>{day.date.getDate()}</span>
          </div>
        ))}
      </div>

      <h2 className={styles.sectionTitle}>Visit history ({views.length})</h2>
      {views.length === 0 ? (
        <p className={formStyles.subtitle}>No visits recorded yet.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Viewed</th>
                <th>Duration</th>
                {project.models.length > 1 && <th>Model</th>}
              </tr>
            </thead>
            <tbody>
              {views.map((view, index) => (
                <tr key={`${view.viewedAt}-${index}`}>
                  <td>{formatDateTime(view.viewedAt)}</td>
                  <td>{formatDuration(view.durationSeconds)}</td>
                  {project.models.length > 1 && <td>{view.modelName ?? '—'}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
