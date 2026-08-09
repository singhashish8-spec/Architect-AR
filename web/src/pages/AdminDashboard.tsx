import { useMemo, useState } from 'react'
import { PasscodeGate } from '../components/PasscodeGate'
import { ProjectCreateForm } from '../components/ProjectCreateForm'
import { AdminProjectEditor } from '../components/AdminProjectEditor'
import { verifyAdminPasscode } from '../services/analyticsService'
import { deleteAdminProject, duplicateAdminProject, listAdminProjects, type AdminProject } from '../services/adminService'
import type { ProjectStatus } from '../types/Project'
import { getErrorMessage } from '../utils/errorMessage'
import styles from './AdminDashboard.module.css'
import formStyles from '../styles/form.module.css'

type SortBy = 'created' | 'views'
type StatusFilter = 'all' | ProjectStatus

const STATUS_LABEL: Record<ProjectStatus, string> = {
  active: 'Active',
  sent_to_client: 'Sent to client',
  archived: 'Archived',
}

// The one place the architect manages everything -- projects, their
// models, and real usage stats -- behind a single shared admin passcode,
// never on a project's own link. Phase 2 shipped this as a read-only
// stats page; Phase 3 (owner's call 2026-08-09) turned it into the full
// management console described in
// docs/features/full-admin-dashboard.md: create/edit/delete projects and
// their models directly from here, since project creation no longer has
// a public entry point at all.
export function AdminDashboard() {
  const [projects, setProjects] = useState<AdminProject[] | null>(null)
  const [passcode, setPasscode] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sortBy, setSortBy] = useState<SortBy>('created')
  const [bulkDeleting, setBulkDeleting] = useState(false)

  async function handleUnlock(candidate: string): Promise<boolean> {
    const accepted = await verifyAdminPasscode(candidate)
    if (!accepted) return false
    setPasscode(candidate)
    await loadProjects(candidate)
    return true
  }

  async function loadProjects(candidate: string) {
    setError(null)
    setRefreshing(true)
    try {
      setProjects(await listAdminProjects(candidate))
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load projects.'))
    } finally {
      setRefreshing(false)
    }
  }

  const visibleProjects = useMemo(() => {
    if (!projects) return []
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
    if (!passcode) return
    setError(null)
    try {
      await duplicateAdminProject(passcode, project)
      await loadProjects(passcode)
    } catch (err) {
      setError(getErrorMessage(err, `Could not duplicate "${project.name}".`))
    }
  }

  async function handleDelete(project: AdminProject) {
    if (!passcode) return
    if (!window.confirm(`Delete "${project.name}" and all its models? This can't be undone.`)) return
    setError(null)
    try {
      await deleteAdminProject(passcode, project)
      await loadProjects(passcode)
    } catch (err) {
      setError(getErrorMessage(err, `Could not delete "${project.name}".`))
    }
  }

  async function handleBulkDelete() {
    if (!passcode || !projects) return
    const targets = projects.filter((p) => selectedIds.has(p.id))
    if (targets.length === 0) return
    if (!window.confirm(`Delete ${targets.length} project(s) and all their models? This can't be undone.`)) return
    setBulkDeleting(true)
    setError(null)
    try {
      for (const project of targets) {
        await deleteAdminProject(passcode, project)
      }
      setSelectedIds(new Set())
      await loadProjects(passcode)
    } catch (err) {
      setError(getErrorMessage(err, 'Could not delete every selected project.'))
    } finally {
      setBulkDeleting(false)
    }
  }

  if (!passcode || !projects) {
    return (
      <PasscodeGate
        onSubmit={handleUnlock}
        title="Admin dashboard"
        description="Enter the admin passcode to manage projects and see view stats."
        submitLabel="View dashboard"
      />
    )
  }

  return (
    <main className={formStyles.stack}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1 className={formStyles.title}>Admin dashboard</h1>
          <div className={styles.headerButtons}>
            <button
              type="button"
              className={styles.newProjectButton}
              onClick={() => setShowCreateForm((current) => !current)}
            >
              {showCreateForm ? 'Cancel' : '+ New project'}
            </button>
            <button
              type="button"
              className={styles.refreshButton}
              onClick={() => void loadProjects(passcode)}
              disabled={refreshing}
            >
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </div>

        {error && (
          <p role="alert" className={formStyles.error}>
            {error}
          </p>
        )}

        {showCreateForm && (
          <div className={styles.createPanel}>
            <h2 className={styles.createPanelTitle}>New project</h2>
            <ProjectCreateForm
              adminPasscode={passcode}
              onCreated={(id) => {
                setShowCreateForm(false)
                setExpandedId(id)
                void loadProjects(passcode)
              }}
            />
          </div>
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

            {/* A card list, not a table -- a table's columns can't reflow
                on a narrow phone screen without either clipping content
                or needing its own horizontal scroll, which would have
                also trapped the expanded management panel inside that
                same narrow scroll region. Cards stack their fields
                naturally instead, and the expanded editor renders at the
                card's own full width. Same lesson as
                docs/features/search-and-schedule.md's schedule-panel bug:
                verify on a real mobile viewport, not just desktop. */}
            <div className={styles.projectList}>
              {visibleProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  selected={selectedIds.has(project.id)}
                  expanded={expandedId === project.id}
                  onToggleSelected={() => toggleSelected(project.id)}
                  onToggleExpanded={() => setExpandedId((current) => (current === project.id ? null : project.id))}
                  onDuplicate={() => void handleDuplicate(project)}
                  onDelete={() => void handleDelete(project)}
                  passcode={passcode}
                  onChanged={() => void loadProjects(passcode)}
                />
              ))}
            </div>
            {visibleProjects.length === 0 && <p className={formStyles.subtitle}>No projects match your search.</p>}
          </>
        )}
      </div>
    </main>
  )
}

interface ProjectCardProps {
  project: AdminProject
  selected: boolean
  expanded: boolean
  onToggleSelected: () => void
  onToggleExpanded: () => void
  onDuplicate: () => void
  onDelete: () => void
  passcode: string
  onChanged: () => void
}

function ProjectCard({
  project,
  selected,
  expanded,
  onToggleSelected,
  onToggleExpanded,
  onDuplicate,
  onDelete,
  passcode,
  onChanged,
}: ProjectCardProps) {
  return (
    <div className={styles.projectCard}>
      <div className={styles.projectCardHeader}>
        <input type="checkbox" checked={selected} onChange={onToggleSelected} aria-label={`Select ${project.name}`} />
        <span className={styles.projectCardName}>{project.name}</span>
        <span className={styles.statusBadge}>{STATUS_LABEL[project.status]}</span>
      </div>
      <div className={styles.projectCardStats}>
        <span>{project.viewCount} views</span>
        <span>Last viewed: {project.lastViewedAt ? formatDate(project.lastViewedAt) : '—'}</span>
        <span>Avg. time: {formatDuration(project.avgDurationSeconds)}</span>
      </div>
      <div className={styles.actionsCell}>
        <button type="button" className={styles.smallButton} onClick={onToggleExpanded}>
          {expanded ? 'Close' : 'Manage'}
        </button>
        <a href={`/p/${project.id}`} target="_blank" rel="noopener noreferrer" className={styles.smallButton}>
          Preview
        </a>
        <button type="button" className={styles.smallButton} onClick={onDuplicate}>
          Duplicate
        </button>
        <button type="button" className={styles.dangerButton} onClick={onDelete}>
          Delete
        </button>
      </div>
      {expanded && (
        <div className={styles.editorWrapper}>
          <AdminProjectEditor adminPasscode={passcode} project={project} onChanged={onChanged} />
        </div>
      )}
    </div>
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
