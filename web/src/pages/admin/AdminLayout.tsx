import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { PasscodeGate } from '../../components/PasscodeGate'
import { verifyAdminPasscode } from '../../services/analyticsService'
import { listAdminProjects, type AdminProject } from '../../services/adminService'
import { getErrorMessage } from '../../utils/errorMessage'

// Shared by every /admin/* page via useOutletContext<AdminContext>() --
// one passcode entry and one project list, held here so navigating
// between the list, a project's page, and its tabs doesn't mean
// re-entering the passcode or re-fetching the same data on every click.
// Deliberately in-memory only (no sessionStorage/localStorage) -- a full
// page reload asks for the passcode again, which is an acceptable
// tradeoff for a solo-architect internal tool, not a real login system.
export interface AdminContext {
  passcode: string
  projects: AdminProject[]
  refresh: () => Promise<void>
  refreshing: boolean
  error: string | null
}

// The one place the architect manages everything -- projects, their
// models, and real usage stats -- behind a single shared admin passcode,
// never on a project's own link. See docs/features/full-admin-dashboard.md.
export function AdminLayout() {
  const [passcode, setPasscode] = useState<string | null>(null)
  const [projects, setProjects] = useState<AdminProject[] | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleUnlock(candidate: string): Promise<boolean> {
    const accepted = await verifyAdminPasscode(candidate)
    if (!accepted) return false
    setPasscode(candidate)
    await refresh(candidate)
    return true
  }

  async function refresh(candidate?: string) {
    const activePasscode = candidate ?? passcode
    if (!activePasscode) return
    setError(null)
    setRefreshing(true)
    try {
      setProjects(await listAdminProjects(activePasscode))
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load projects.'))
    } finally {
      setRefreshing(false)
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

  const context: AdminContext = { passcode, projects, refresh: () => refresh(), refreshing, error }
  return <Outlet context={context} />
}
