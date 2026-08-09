import { useMemo, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { KebabMenu } from '../../components/KebabMenu'
import { deleteAdminProject, duplicateAdminProject, type AdminProject } from '../../services/adminService'
import type { ProjectStatus } from '../../types/Project'
import { getErrorMessage } from '../../utils/errorMessage'
import type { AdminContext } from './AdminLayout'
import styles from './AdminProjectList.module.css'
import formStyles from '../../styles/form.module.css'

type SortBy = 'created' | 'views'
type StatusFilter = 'all' | ProjectStatus

const STATUS_LABEL: Record<ProjectStatus, string> = {
  active: 'Active',
  sent_to_client: 'Sent to client',
  archived: 'Archived',
}

// The admin home -- a minimal, GitHub-repo-style list. Click a row to
// open that project's own page (Overview/Models/Share/Settings tabs);
// everything except a quick glance (status, view count) lives behind
// the ⋮ menu or inside the project page itself, per the owner's own
// call on how busy this list should be. See
// docs/features/full-admin-dashboard.md.
export function AdminProjectList() {
  const { projects, passcode, refresh, refreshing, error: loadError } = useOutletContext<AdminContext>()
  const navigate = useNavigate()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sortBy, setSortBy] = useState<SortBy>('created')
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const visibleProjects = useMemo(() => {
    const query = search.trim().toLowerCase()
    const filtered = projects.filter((project) => {
      const matchesSearch = !query || project.name.toLowerCase().includes(query)
      const matchesStatus = statusFilter === 'all' || project.status === statusFilter
      return matchesSearch && matchesStatus
    })
    return [...filtered].sort((a, b) =>
      sortBy === 'views'
        ? b.viewCount - a.viewCount
        : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
  }, [projects, search, statusFilter, sortBy])

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleDuplicate(project: AdminProject) {
    setActionError(null)
    try {
      const newId = await duplicateAdminProject(passcode, project)
      await refresh()
      void navigate(`/admin/p/${newId}`)
    } catch (err) {
      setActionError(getErrorMessage(err, `Could not duplicate "${project.name}".`))
    }
  }

  async function handleDelete(project: AdminProject) {
    if (!window.confirm(`Delete "${project.name}" and all its models? This can't be undone.`)) return
    setActionError(null)
    try {
      await deleteAdminProject(passcode, project)
      await refresh()
    } catch (err) {
      setActionError(getErrorMessage(err, `Could not delete "${project.name}".`))
    }
  }

  async function handleBulkDelete() {
    const targets = projects.filter((p) => selectedIds.has(p.id))
    if (targets.length === 0) return
    if (!window.confirm(`Delete ${targets.length} project(s) and all their models? This can't be undone.`)) return
    setBulkDeleting(true)
    setActionError(null)
    try {
      for (const project of targets) {
        await deleteAdminProject(passcode, project)
      }
      setSelectedIds(new Set())
      await refresh()
    } catch (err) {
      setActionError(getErrorMessage(err, 'Could not delete every selected project.'))
    } finally {
      setBulkDeleting(false)
    }
  }

  return (
    <main className={formStyles.stack}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1 className={formStyles.title}>Admin dashboard</h1>
          <div className={styles.headerButtons}>
            <button type="button" className={styles.newProjectButton} onClick={() => void navigate('/admin/new')}>
              + New project
            </button>
            <button type="button" className={styles.refreshButton} onClick={() => void refresh()} disabled={refreshing}>
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </div>

        {(loadError || actionError) && (
          <p role="alert" className={formStyles.error}>
            {actionError ?? loadError}
          </p>
        )}

        {projects.length === 0 ? (
          <p className={formStyles.subtitle}>No projects yet — create one above.</p>
        ) : (
          <>
            <div className={styles.toolbar}>
              <input
                type="text"
                className={styles.searchInput}
                placeholder="Search projects…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <select
                className={styles.filterSelect}
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="sent_to_client">Sent to client</option>
                <option value="archived">Archived</option>
              </select>
              <select className={styles.filterSelect} value={sortBy} onChange={(event) => setSortBy(event.target.value as SortBy)}>
                <option value="created">Newest first</option>
                <option value="views">Most viewed</option>
              </select>
            </div>

            {selectedIds.size > 0 && (
              <div className={styles.bulkBar}>
                <span>{selectedIds.size} selected</span>
                <button type="button" className={styles.dangerButton} onClick={() => void handleBulkDelete()} disabled={bulkDeleting}>
                  {bulkDeleting ? 'Deleting…' : 'Delete selected'}
                </button>
                <button type="button" className={styles.refreshButton} onClick={() => setSelectedIds(new Set())}>
                  Clear selection
                </button>
              </div>
            )}

            <div className={styles.list}>
              {visibleProjects.map((project) => (
                <div key={project.id} className={styles.row}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(project.id)}
                    onChange={() => toggleSelected(project.id)}
                    onClick={(event) => event.stopPropagation()}
                    aria-label={`Select ${project.name}`}
                  />
                  <div
                    className={styles.rowMain}
                    role="button"
                    tabIndex={0}
                    onClick={() => void navigate(`/admin/p/${project.id}`)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        void navigate(`/admin/p/${project.id}`)
                      }
                    }}
                  >
                    <span className={styles.rowName}>{project.name}</span>
                    <span className={styles.statusBadge}>{STATUS_LABEL[project.status]}</span>
                    <span className={styles.rowViews}>{project.viewCount} views</span>
                  </div>
                  <KebabMenu
                    ariaLabel={`Actions for ${project.name}`}
                    items={[
                      { label: 'Preview', href: `/p/${project.id}` },
                      { label: 'Duplicate', onSelect: () => void handleDuplicate(project) },
                      { label: 'Delete', danger: true, onSelect: () => void handleDelete(project) },
                    ]}
                  />
                </div>
              ))}
            </div>
            {visibleProjects.length === 0 && <p className={formStyles.subtitle}>No projects match your search.</p>}
          </>
        )}
      </div>
    </main>
  )
}
