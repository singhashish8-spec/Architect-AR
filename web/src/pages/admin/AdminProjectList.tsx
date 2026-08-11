import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { KebabMenu } from '../../components/KebabMenu'
import {
  deleteAdminProject,
  duplicateAdminProject,
  getStorageUsage,
  setStorageLimit,
  type AdminProject,
  type StorageUsage,
} from '../../services/adminService'
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

const BYTES_PER_GIB = 1024 * 1024 * 1024

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < BYTES_PER_GIB) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`
  return `${(bytes / BYTES_PER_GIB).toFixed(2)} GB`
}

// Account-wide storage usage panel -- one Storage bucket shared by every
// project, so this doesn't belong on any single project's own page.
// Fetched locally here rather than added to the shared AdminContext
// (AdminLayout.tsx), since nothing else on the dashboard needs it.
function StorageUsagePanel({ passcode }: { passcode: string }) {
  const [usage, setUsage] = useState<StorageUsage | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [limitInput, setLimitInput] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const result = await getStorageUsage(passcode)
        if (!cancelled) setUsage(result)
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err, 'Could not load storage usage.'))
      }
    })()

    return () => {
      cancelled = true
    }
  }, [passcode])

  async function handleSaveLimit() {
    const gib = Number(limitInput)
    if (!Number.isFinite(gib) || gib <= 0) {
      setError('Enter a positive number of GB.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await setStorageLimit(passcode, Math.round(gib * BYTES_PER_GIB))
      setEditing(false)
      setUsage(await getStorageUsage(passcode))
    } catch (err) {
      setError(getErrorMessage(err, 'Could not update the storage limit.'))
    } finally {
      setSaving(false)
    }
  }

  if (error && !usage) {
    return (
      <p role="alert" className={formStyles.error}>
        {error}
      </p>
    )
  }

  if (!usage) {
    return null
  }

  const percent = usage.limitBytes > 0 ? Math.min(100, (usage.usedBytes / usage.limitBytes) * 100) : 0
  const nearLimit = percent >= 90

  return (
    <div className={styles.storagePanel}>
      <div className={styles.storageHeader}>
        <span className={styles.storageLabel}>
          {formatBytes(usage.usedBytes)} of {formatBytes(usage.limitBytes)} used
        </span>
        {editing ? (
          <div className={styles.storageEditRow}>
            <input
              type="number"
              min="0.1"
              step="0.1"
              className={styles.storageLimitInput}
              placeholder="GB"
              value={limitInput}
              onChange={(event) => setLimitInput(event.target.value)}
              autoFocus
            />
            <button type="button" className={styles.storageLinkButton} onClick={() => void handleSaveLimit()} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button type="button" className={styles.storageLinkButton} onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            className={styles.storageLinkButton}
            onClick={() => {
              setLimitInput((usage.limitBytes / BYTES_PER_GIB).toFixed(1))
              setEditing(true)
            }}
          >
            Edit limit
          </button>
        )}
      </div>
      <div className={styles.storageBarTrack}>
        <div
          className={nearLimit ? styles.storageBarFillWarn : styles.storageBarFill}
          style={{ width: `${percent}%` }}
        />
      </div>
      {error && (
        <p role="alert" className={formStyles.error}>
          {error}
        </p>
      )}
    </div>
  )
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

        <StorageUsagePanel passcode={passcode} />

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
