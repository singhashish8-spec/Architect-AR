import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { PasscodeGate } from '../../components/PasscodeGate'
import { verifyAdminPasscode } from '../../services/analyticsService'
import { listAdminProjects, type AdminProject } from '../../services/adminService'
import { getCompanyName, setCompanyName as saveCompanyName } from '../../services/companyService'
import { getErrorMessage } from '../../utils/errorMessage'
import styles from './AdminLayout.module.css'

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

// The account-wide company name, editable right here and shown as a
// permanent header on every /admin/* page -- owner's own ask,
// 2026-08-11: "add a permanent header of company branding on all the
// page of dashboard". Click-to-edit rather than a separate settings
// page/route: this bar already appears everywhere it needs to, so it's
// also the most natural place to change the name, and one route is one
// less thing to navigate to for a single text field.
function CompanyBrandBar({
  companyName,
  onSave,
}: {
  companyName: string | null
  onSave: (value: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function startEditing() {
    setDraft(companyName ?? '')
    setError(null)
    setEditing(true)
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      await onSave(draft)
      setEditing(false)
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save the company name.'))
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <div className={styles.brandBar}>
        <input
          type="text"
          className={styles.brandInput}
          value={draft}
          placeholder="Company name"
          autoFocus
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void save()
            if (event.key === 'Escape') setEditing(false)
          }}
        />
        <button type="button" className={styles.brandButton} onClick={() => void save()} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className={styles.brandButton} onClick={() => setEditing(false)} disabled={saving}>
          Cancel
        </button>
        {error && (
          <span role="alert" className={styles.brandError}>
            {error}
          </span>
        )}
      </div>
    )
  }

  return (
    <div className={styles.brandBar}>
      <span className={styles.brandName}>{companyName || 'Architect AR'}</span>
      <button type="button" className={styles.brandEditButton} onClick={startEditing}>
        Edit
      </button>
    </div>
  )
}

// The one place the architect manages everything -- projects, their
// models, and real usage stats -- behind a single shared admin passcode,
// never on a project's own link. See docs/features/full-admin-dashboard.md.
export function AdminLayout() {
  const [passcode, setPasscode] = useState<string | null>(null)
  const [projects, setProjects] = useState<AdminProject[] | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Fetched unconditionally, even before the passcode gate -- reading it
  // is public (services/companyService.ts) and this bar is worth showing
  // on the passcode screen too, not just past it.
  const [companyName, setCompanyNameState] = useState<string | null>(null)

  useEffect(() => {
    getCompanyName()
      .then(setCompanyNameState)
      .catch(() => {
        // Falls back to "Architect AR" wherever it's shown.
      })
  }, [])

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

  async function handleSaveCompanyName(value: string) {
    if (!passcode) return
    await saveCompanyName(passcode, value)
    setCompanyNameState(value.trim() || null)
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
  return (
    <>
      <CompanyBrandBar companyName={companyName} onSave={handleSaveCompanyName} />
      <Outlet context={context} />
    </>
  )
}
