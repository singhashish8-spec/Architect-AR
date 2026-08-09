import { useState, type FormEvent } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import {
  deleteAdminProject,
  setAdminProjectPasscode,
  updateAdminProjectDetails,
  type AdminProject,
} from '../../services/adminService'
import type { ProjectStatus } from '../../types/Project'
import { getErrorMessage } from '../../utils/errorMessage'
import type { AdminProjectPageContext } from './AdminProjectPage'
import styles from './AdminProjectSettings.module.css'
import formStyles from '../../styles/form.module.css'

// Name/description/status, the passcode, and deleting the project --
// everything that changes the project itself rather than what's inside
// it, split out from the Models/Share tabs the same way GitHub splits a
// repo's Settings page from its code and its Overview. See
// docs/features/full-admin-dashboard.md.
export function AdminProjectSettings() {
  const { project, passcode, refresh } = useOutletContext<AdminProjectPageContext>()

  return (
    <div>
      <DetailsForm projectId={project.id} name={project.name} description={project.description} status={project.status} passcode={passcode} onChanged={refresh} />
      <PasscodeForm projectId={project.id} hasPasscode={project.hasPasscode} passcode={passcode} onChanged={refresh} />
      <DangerZone project={project} passcode={passcode} />
    </div>
  )
}

interface DetailsFormProps {
  projectId: string
  name: string
  description: string | null
  status: ProjectStatus
  passcode: string
  onChanged: () => Promise<void>
}

function DetailsForm({ projectId, name: initialName, description: initialDescription, status: initialStatus, passcode, onChanged }: DetailsFormProps) {
  const [name, setName] = useState(initialName)
  const [description, setDescription] = useState(initialDescription ?? '')
  const [status, setStatus] = useState<ProjectStatus>(initialStatus)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      await updateAdminProjectDetails(passcode, projectId, {
        name,
        description: description.trim() || null,
        status,
      })
      await onChanged()
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save these details.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Details</h2>
      <form onSubmit={(event) => void handleSubmit(event)}>
        <div className={formStyles.field}>
          <label htmlFor={`edit-name-${projectId}`} className={formStyles.label}>
            Project name
          </label>
          <input
            id={`edit-name-${projectId}`}
            type="text"
            required
            className={formStyles.input}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className={formStyles.field}>
          <label htmlFor={`edit-description-${projectId}`} className={formStyles.label}>
            Project details
          </label>
          <textarea
            id={`edit-description-${projectId}`}
            className={formStyles.textarea}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
          />
        </div>
        <div className={formStyles.field}>
          <label htmlFor={`edit-status-${projectId}`} className={formStyles.label}>
            Status
          </label>
          <select
            id={`edit-status-${projectId}`}
            className={formStyles.select}
            value={status}
            onChange={(event) => setStatus(event.target.value as ProjectStatus)}
          >
            <option value="active">Active</option>
            <option value="sent_to_client">Sent to client</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        {error && (
          <p role="alert" className={formStyles.error}>
            {error}
          </p>
        )}
        <div className={styles.saveRow}>
          <button type="submit" className={styles.saveButton} disabled={saving}>
            {saving ? 'Saving…' : 'Save details'}
          </button>
          {saved && (
            <span className={styles.savedNote} role="status">
              Saved ✓
            </span>
          )}
        </div>
      </form>
    </section>
  )
}

interface PasscodeFormProps {
  projectId: string
  hasPasscode: boolean
  passcode: string
  onChanged: () => Promise<void>
}

function PasscodeForm({ projectId, hasPasscode, passcode, onChanged }: PasscodeFormProps) {
  const [newPasscode, setNewPasscode] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function apply(value: string | null) {
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      await setAdminProjectPasscode(passcode, projectId, value)
      setNewPasscode('')
      await onChanged()
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setError(getErrorMessage(err, 'Could not update the passcode.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Passcode</h2>
      <p className={formStyles.subtitle}>
        {hasPasscode
          ? 'This project currently requires a passcode to view.'
          : 'This project has no passcode — anyone with the link can open it.'}{' '}
        The passcode itself is never stored in a readable form (same as any password) — there's no
        way to look up what it currently is, only set a new one.
      </p>
      <div className={styles.passcodeRow}>
        <input
          type="text"
          className={formStyles.input}
          value={newPasscode}
          onChange={(event) => setNewPasscode(event.target.value)}
          placeholder="New passcode"
        />
        <button
          type="button"
          className={styles.saveButton}
          disabled={saving || !newPasscode}
          onClick={() => void apply(newPasscode)}
        >
          {hasPasscode ? 'Change' : 'Set'}
        </button>
        {hasPasscode && (
          <button type="button" className={styles.removeButton} disabled={saving} onClick={() => void apply(null)}>
            Remove
          </button>
        )}
        {saved && (
          <span className={styles.savedNote} role="status">
            Saved ✓
          </span>
        )}
      </div>
      {error && (
        <p role="alert" className={formStyles.error}>
          {error}
        </p>
      )}
    </section>
  )
}

interface DangerZoneProps {
  project: AdminProject
  passcode: string
}

function DangerZone({ project, passcode }: DangerZoneProps) {
  const navigate = useNavigate()
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    if (!window.confirm(`Delete "${project.name}" and all its models? This can't be undone.`)) return
    setDeleting(true)
    setError(null)
    try {
      await deleteAdminProject(passcode, project)
      void navigate('/admin')
    } catch (err) {
      setError(getErrorMessage(err, `Could not delete "${project.name}".`))
      setDeleting(false)
    }
  }

  return (
    <section className={styles.dangerSection}>
      <h2 className={styles.sectionTitle}>Danger zone</h2>
      <p className={formStyles.subtitle}>Deleting a project also removes its uploaded files. This can't be undone.</p>
      {error && (
        <p role="alert" className={formStyles.error}>
          {error}
        </p>
      )}
      <button type="button" className={styles.deleteButton} onClick={() => void handleDelete()} disabled={deleting}>
        {deleting ? 'Deleting…' : `Delete "${project.name}"`}
      </button>
    </section>
  )
}
