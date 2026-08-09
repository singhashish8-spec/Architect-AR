import { useOutletContext } from 'react-router-dom'
import type { AdminProjectPageContext } from './AdminProjectPage'
import styles from './AdminProjectOverview.module.css'
import formStyles from '../../styles/form.module.css'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return '—'
  const minutes = Math.floor(seconds / 60)
  const remaining = Math.round(seconds % 60)
  return minutes > 0 ? `${minutes}m ${remaining}s` : `${remaining}s`
}

// A read-only, at-a-glance summary -- real editing lives in Settings,
// same split GitHub draws between a repo's README/overview and its
// settings page. See docs/features/full-admin-dashboard.md.
export function AdminProjectOverview() {
  const { project } = useOutletContext<AdminProjectPageContext>()

  return (
    <div>
      {project.description && <p className={styles.description}>{project.description}</p>}

      <dl className={styles.statGrid}>
        <div className={styles.stat}>
          <dt>Views</dt>
          <dd>{project.viewCount}</dd>
        </div>
        <div className={styles.stat}>
          <dt>Last viewed</dt>
          <dd>{project.lastViewedAt ? formatDate(project.lastViewedAt) : '—'}</dd>
        </div>
        <div className={styles.stat}>
          <dt>Avg. time on page</dt>
          <dd>{formatDuration(project.avgDurationSeconds)}</dd>
        </div>
        <div className={styles.stat}>
          <dt>Created</dt>
          <dd>{formatDate(project.createdAt)}</dd>
        </div>
        <div className={styles.stat}>
          <dt>Passcode</dt>
          <dd>{project.hasPasscode ? 'Set' : 'Open (no passcode)'}</dd>
        </div>
      </dl>

      <h2 className={styles.sectionTitle}>Models ({project.models.length})</h2>
      {project.models.length === 0 ? (
        <p className={formStyles.subtitle}>No models yet — add one from the Models tab.</p>
      ) : (
        <ul className={styles.modelList}>
          {project.models.map((model) => (
            <li key={model.id} className={styles.modelItem}>
              <span className={styles.modelName}>{model.name}</span>
              <span className={styles.modelMeta}>{model.scalePreset}</span>
              {model.note && <span className={styles.modelNote}>{model.note}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
