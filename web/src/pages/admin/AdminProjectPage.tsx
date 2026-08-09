import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { KebabMenu } from '../../components/KebabMenu'
import { deleteAdminProject, duplicateAdminProject, type AdminProject } from '../../services/adminService'
import { getErrorMessage } from '../../utils/errorMessage'
import type { AdminContext } from './AdminLayout'
import styles from './AdminProjectPage.module.css'
import formStyles from '../../styles/form.module.css'

export interface AdminProjectPageContext {
  project: AdminProject
  passcode: string
  refresh: () => Promise<void>
}

const STATUS_LABEL: Record<AdminProject['status'], string> = {
  active: 'Active',
  sent_to_client: 'Sent to client',
  archived: 'Archived',
}

const TABS = [
  { to: '', label: 'Overview', end: true },
  { to: 'models', label: 'Models' },
  { to: 'share', label: 'Share' },
  { to: 'settings', label: 'Settings' },
]

// One project's own page -- GitHub-repo style: a header (name, status,
// secondary actions behind ⋮), then tabs for the different things you'd
// do with it. Replaces the old single-page "Manage" panel. See
// docs/features/full-admin-dashboard.md.
export function AdminProjectPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const { projects, passcode, refresh } = useOutletContext<AdminContext>()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  const project = projects.find((p) => p.id === projectId)

  async function handleDuplicate() {
    if (!project) return
    setError(null)
    try {
      const newId = await duplicateAdminProject(passcode, project)
      await refresh()
      void navigate(`/admin/p/${newId}`)
    } catch (err) {
      setError(getErrorMessage(err, `Could not duplicate "${project.name}".`))
    }
  }

  async function handleDelete() {
    if (!project) return
    if (!window.confirm(`Delete "${project.name}" and all its models? This can't be undone.`)) return
    setError(null)
    try {
      await deleteAdminProject(passcode, project)
      void navigate('/admin')
    } catch (err) {
      setError(getErrorMessage(err, `Could not delete "${project.name}".`))
    }
  }

  if (!project) {
    return (
      <main className={formStyles.stack}>
        <div className={formStyles.card}>
          <p className={formStyles.subtitle}>
            <Link to="/admin" className={formStyles.link}>
              ← Back to dashboard
            </Link>
          </p>
          <h1 className={formStyles.title}>Project not found</h1>
          <p className={formStyles.subtitle}>
            This project may have been deleted, or the link is out of date. Try refreshing the dashboard.
          </p>
        </div>
      </main>
    )
  }

  const context: AdminProjectPageContext = { project, passcode, refresh }

  return (
    <main className={formStyles.stack}>
      <div className={styles.card}>
        <p className={formStyles.subtitle}>
          <Link to="/admin" className={formStyles.link}>
            ← Back to dashboard
          </Link>
        </p>
        <div className={styles.header}>
          <div className={styles.headerMain}>
            <h1 className={styles.title}>{project.name}</h1>
            <span className={styles.statusBadge}>{STATUS_LABEL[project.status]}</span>
          </div>
          <KebabMenu
            ariaLabel={`Actions for ${project.name}`}
            items={[
              { label: 'Preview', href: `/p/${project.id}` },
              { label: 'Duplicate', onSelect: () => void handleDuplicate() },
              { label: 'Delete', danger: true, onSelect: () => void handleDelete() },
            ]}
          />
        </div>

        {error && (
          <p role="alert" className={formStyles.error}>
            {error}
          </p>
        )}

        <nav className={styles.tabs}>
          {TABS.map((tab) => (
            <NavLink
              key={tab.label}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) => (isActive ? styles.tabActive : styles.tab)}
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>

        <div className={styles.tabPanel}>
          <Outlet context={context} />
        </div>
      </div>
    </main>
  )
}
