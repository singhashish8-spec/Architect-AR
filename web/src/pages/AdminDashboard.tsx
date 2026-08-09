import { useState } from 'react'
import { PasscodeGate } from '../components/PasscodeGate'
import { getAdminStats, verifyAdminPasscode, type AdminProjectStats } from '../services/analyticsService'
import { getErrorMessage } from '../utils/errorMessage'
import styles from './AdminDashboard.module.css'
import formStyles from '../styles/form.module.css'

// "Did the client open the link, how long did they look" -- visible only
// here, behind a single shared admin passcode, never on the project link
// itself. See docs/features/analytics-and-admin-dashboard.md.
export function AdminDashboard() {
  const [stats, setStats] = useState<AdminProjectStats[] | null>(null)
  const [passcode, setPasscode] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  async function handleUnlock(candidate: string): Promise<boolean> {
    const accepted = await verifyAdminPasscode(candidate)
    if (!accepted) return false
    setPasscode(candidate)
    await loadStats(candidate)
    return true
  }

  async function loadStats(candidate: string) {
    setError(null)
    setRefreshing(true)
    try {
      setStats(await getAdminStats(candidate))
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load stats.'))
    } finally {
      setRefreshing(false)
    }
  }

  if (!passcode || !stats) {
    return (
      <PasscodeGate
        onSubmit={handleUnlock}
        title="Admin dashboard"
        description="Enter the admin passcode to see project view stats."
        submitLabel="View dashboard"
      />
    )
  }

  return (
    <main className={formStyles.page}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1 className={formStyles.title}>Admin dashboard</h1>
          <button
            type="button"
            className={styles.refreshButton}
            onClick={() => void loadStats(passcode)}
            disabled={refreshing}
          >
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {error && (
          <p role="alert" className={formStyles.error}>
            {error}
          </p>
        )}

        {stats.length === 0 ? (
          <p className={formStyles.subtitle}>No projects yet.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Project</th>
                <th>Created</th>
                <th>Views</th>
                <th>Last viewed</th>
                <th>Avg. time on page</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((row) => (
                <tr key={row.projectId}>
                  <td>{row.projectName}</td>
                  <td>{formatDate(row.createdAt)}</td>
                  <td>{row.viewCount}</td>
                  <td>{row.lastViewedAt ? formatDate(row.lastViewedAt) : '—'}</td>
                  <td>{formatDuration(row.avgDurationSeconds)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  )
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return '—'
  const minutes = Math.floor(seconds / 60)
  const remaining = Math.round(seconds % 60)
  return minutes > 0 ? `${minutes}m ${remaining}s` : `${remaining}s`
}
