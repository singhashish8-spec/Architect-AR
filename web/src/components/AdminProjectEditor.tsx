import { useState, type FormEvent } from 'react'
import { ScalePresetSelect } from './ScalePresetSelect'
import {
  addAdminModel,
  deleteAdminModel,
  reorderAdminModels,
  setAdminProjectPasscode,
  updateAdminModel,
  updateAdminProjectDetails,
  type AdminProject,
} from '../services/adminService'
import { uploadIfcFile, uploadModelFile } from '../services/projectService'
import type { AdminProjectModel } from '../types/ProjectModel'
import type { ProjectStatus } from '../types/Project'
import type { ScalePreset } from '../types/ScalePreset'
import { getErrorMessage } from '../utils/errorMessage'
import formStyles from '../styles/form.module.css'
import styles from './AdminProjectEditor.module.css'

interface AdminProjectEditorProps {
  adminPasscode: string
  project: AdminProject
  // Parent (pages/AdminDashboard.tsx) owns the real project list -- every
  // successful write here just asks it to refetch, rather than this
  // component trying to keep its own copy of the list in sync too.
  onChanged: () => void
}

// The full per-project management panel opened by "Manage" in the admin
// dashboard's project table (Phase 3 -- see
// docs/features/full-admin-dashboard.md): edit the basic details, set/
// change/remove the passcode, and manage its models (add, replace,
// rename, delete, reorder, note).
export function AdminProjectEditor({ adminPasscode, project, onChanged }: AdminProjectEditorProps) {
  return (
    <div className={styles.editor}>
      <DetailsForm adminPasscode={adminPasscode} project={project} onChanged={onChanged} />
      <PasscodeForm adminPasscode={adminPasscode} project={project} onChanged={onChanged} />
      <ModelsSection adminPasscode={adminPasscode} project={project} onChanged={onChanged} />
    </div>
  )
}

function DetailsForm({ adminPasscode, project, onChanged }: AdminProjectEditorProps) {
  const [name, setName] = useState(project.name)
  const [description, setDescription] = useState(project.description ?? '')
  const [status, setStatus] = useState<ProjectStatus>(project.status)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await updateAdminProjectDetails(adminPasscode, project.id, {
        name,
        description: description.trim() || null,
        status,
      })
      onChanged()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save these details.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>Details</h3>
      <form onSubmit={(event) => void handleSubmit(event)}>
        <div className={formStyles.field}>
          <label htmlFor={`edit-name-${project.id}`} className={formStyles.label}>
            Project name
          </label>
          <input
            id={`edit-name-${project.id}`}
            type="text"
            required
            className={formStyles.input}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className={formStyles.field}>
          <label htmlFor={`edit-description-${project.id}`} className={formStyles.label}>
            Project details
          </label>
          <textarea
            id={`edit-description-${project.id}`}
            className={formStyles.textarea}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
          />
        </div>
        <div className={formStyles.field}>
          <label htmlFor={`edit-status-${project.id}`} className={formStyles.label}>
            Status
          </label>
          <select
            id={`edit-status-${project.id}`}
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
        <button type="submit" className={styles.saveButton} disabled={saving}>
          {saving ? 'Saving…' : 'Save details'}
        </button>
      </form>
    </section>
  )
}

function PasscodeForm({ adminPasscode, project, onChanged }: AdminProjectEditorProps) {
  const [newPasscode, setNewPasscode] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function apply(value: string | null) {
    setSaving(true)
    setError(null)
    try {
      await setAdminProjectPasscode(adminPasscode, project.id, value)
      setNewPasscode('')
      onChanged()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not update the passcode.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>Passcode</h3>
      <p className={formStyles.subtitle}>
        {project.hasPasscode
          ? 'This project currently requires a passcode to view.'
          : 'This project has no passcode — anyone with the link can open it.'}
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
          {project.hasPasscode ? 'Change' : 'Set'}
        </button>
        {project.hasPasscode && (
          <button type="button" className={styles.removeButton} disabled={saving} onClick={() => void apply(null)}>
            Remove
          </button>
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

function ModelsSection({ adminPasscode, project, onChanged }: AdminProjectEditorProps) {
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)

  async function withBusy(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await action()
      onChanged()
    } catch (err) {
      setError(getErrorMessage(err, 'That change did not go through. Please try again.'))
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(model: AdminProjectModel) {
    if (project.models.length <= 1) {
      setError('A project needs at least one model — add a replacement before removing this one.')
      return
    }
    if (!window.confirm(`Delete model "${model.name}"? This can't be undone.`)) return
    await withBusy(() => deleteAdminModel(adminPasscode, model))
  }

  async function handleMove(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= project.models.length) return
    const ids = project.models.map((m) => m.id)
    const [moved] = ids.splice(index, 1)
    ids.splice(target, 0, moved)
    await withBusy(() => reorderAdminModels(adminPasscode, project.id, ids))
  }

  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>Models</h3>
      {error && (
        <p role="alert" className={formStyles.error}>
          {error}
        </p>
      )}
      {project.models.map((model, index) => (
        <ModelRow
          key={model.id}
          adminPasscode={adminPasscode}
          model={model}
          busy={busy}
          isFirst={index === 0}
          isLast={index === project.models.length - 1}
          onMoveUp={() => void handleMove(index, -1)}
          onMoveDown={() => void handleMove(index, 1)}
          onDelete={() => void handleDelete(model)}
          onChanged={onChanged}
        />
      ))}

      {showAddForm ? (
        <AddModelForm
          adminPasscode={adminPasscode}
          projectId={project.id}
          onDone={() => {
            setShowAddForm(false)
            onChanged()
          }}
          onCancel={() => setShowAddForm(false)}
        />
      ) : (
        <button type="button" className={styles.addModelButton} onClick={() => setShowAddForm(true)}>
          + Add another model
        </button>
      )}
    </section>
  )
}

interface ModelRowProps {
  adminPasscode: string
  model: AdminProjectModel
  busy: boolean
  isFirst: boolean
  isLast: boolean
  onMoveUp: () => void
  onMoveDown: () => void
  onDelete: () => void
  onChanged: () => void
}

// One existing model's editable row -- name/note/scale are always
// editable inline (no separate edit-mode toggle, this is an internal
// admin tool used by one person), "Replace file" is opt-in via its own
// file inputs so a normal detail edit never re-uploads anything by
// accident.
function ModelRow({ adminPasscode, model, busy, isFirst, isLast, onMoveUp, onMoveDown, onDelete, onChanged }: ModelRowProps) {
  const [name, setName] = useState(model.name)
  const [note, setNote] = useState(model.note ?? '')
  const [scalePreset, setScalePreset] = useState<ScalePreset>(model.scalePreset)
  const [replaceModelFile, setReplaceModelFile] = useState<File | null>(null)
  const [replaceIfcFile, setReplaceIfcFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const modelUrl = replaceModelFile ? await uploadModelFile(replaceModelFile) : model.modelUrl
      const ifcUrl = replaceIfcFile ? await uploadIfcFile(replaceIfcFile) : model.ifcUrl
      await updateAdminModel(adminPasscode, {
        id: model.id,
        name,
        modelUrl,
        ifcUrl,
        scalePreset,
        note: note.trim() || null,
      })
      setReplaceModelFile(null)
      setReplaceIfcFile(null)
      onChanged()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save this model.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.modelRow}>
      <div className={styles.modelRowFields}>
        <input
          type="text"
          className={formStyles.input}
          value={name}
          onChange={(event) => setName(event.target.value)}
          aria-label="Model name"
        />
        <ScalePresetSelect className={formStyles.select} value={scalePreset} onChange={setScalePreset} />
        <input
          type="text"
          className={formStyles.input}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Note (e.g. “final”)"
          aria-label="Model note"
        />
      </div>
      <div className={styles.modelRowFiles}>
        <label className={styles.replaceLabel}>
          Replace model file
          <input
            type="file"
            accept=".glb,.gltf"
            className={formStyles.fileInput}
            onChange={(event) => setReplaceModelFile(event.target.files?.[0] ?? null)}
          />
        </label>
        <label className={styles.replaceLabel}>
          Replace IFC file
          <input
            type="file"
            accept=".ifc"
            className={formStyles.fileInput}
            onChange={(event) => setReplaceIfcFile(event.target.files?.[0] ?? null)}
          />
        </label>
      </div>
      {error && (
        <p role="alert" className={formStyles.error}>
          {error}
        </p>
      )}
      <div className={styles.modelRowActions}>
        <button type="button" className={styles.smallButton} onClick={onMoveUp} disabled={busy || isFirst}>
          ↑ Move up
        </button>
        <button type="button" className={styles.smallButton} onClick={onMoveDown} disabled={busy || isLast}>
          ↓ Move down
        </button>
        <button type="button" className={styles.saveButton} onClick={() => void handleSave()} disabled={saving || busy}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className={styles.removeButton} onClick={onDelete} disabled={busy}>
          Delete
        </button>
      </div>
    </div>
  )
}

interface AddModelFormProps {
  adminPasscode: string
  projectId: string
  onDone: () => void
  onCancel: () => void
}

function AddModelForm({ adminPasscode, projectId, onDone, onCancel }: AddModelFormProps) {
  const [name, setName] = useState('')
  const [modelFile, setModelFile] = useState<File | null>(null)
  const [ifcFile, setIfcFile] = useState<File | null>(null)
  const [scalePreset, setScalePreset] = useState<ScalePreset | ''>('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = (modelFile || ifcFile) && scalePreset

  async function handleAdd() {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      const modelUrl = modelFile ? await uploadModelFile(modelFile) : null
      const ifcUrl = ifcFile ? await uploadIfcFile(ifcFile) : null
      if (!modelUrl && !ifcUrl) throw new Error('Give either a model file or an IFC file.')
      await addAdminModel(adminPasscode, projectId, {
        name: name.trim() || 'New model',
        // A model file is required by NewProjectModel's shape -- an
        // IFC-only add still needs *some* viewable geometry, same
        // constraint the create-project form enforces; converting IFC to
        // a GLB here would duplicate ProjectCreateForm.tsx's conversion
        // logic for a case admins can also just cover by uploading a GLB
        // alongside the IFC. Revisit if IFC-only model adds turn out to
        // be common in practice.
        modelUrl: modelUrl ?? ifcUrl!,
        ifcUrl,
        scalePreset,
      })
      onDone()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not add this model.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.addModelForm}>
      <div className={formStyles.field}>
        <label className={formStyles.label} htmlFor={`add-model-name-${projectId}`}>
          Model name
        </label>
        <input
          id={`add-model-name-${projectId}`}
          type="text"
          className={formStyles.input}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </div>
      <div className={formStyles.field}>
        <label className={formStyles.label} htmlFor={`add-model-file-${projectId}`}>
          Model file (glTF / GLB)
        </label>
        <input
          id={`add-model-file-${projectId}`}
          type="file"
          accept=".glb,.gltf"
          className={formStyles.fileInput}
          onChange={(event) => setModelFile(event.target.files?.[0] ?? null)}
        />
      </div>
      <div className={formStyles.field}>
        <label className={formStyles.label} htmlFor={`add-model-ifc-${projectId}`}>
          IFC file (optional — enables tap-to-inspect)
        </label>
        <input
          id={`add-model-ifc-${projectId}`}
          type="file"
          accept=".ifc"
          className={formStyles.fileInput}
          onChange={(event) => setIfcFile(event.target.files?.[0] ?? null)}
        />
      </div>
      <div className={formStyles.field}>
        <label className={formStyles.label} htmlFor={`add-model-scale-${projectId}`}>
          Scale
        </label>
        <ScalePresetSelect
          id={`add-model-scale-${projectId}`}
          className={formStyles.select}
          value={scalePreset}
          onChange={setScalePreset}
        />
      </div>
      {error && (
        <p role="alert" className={formStyles.error}>
          {error}
        </p>
      )}
      <div className={styles.modelRowActions}>
        <button type="button" className={styles.saveButton} onClick={() => void handleAdd()} disabled={submitting || !canSubmit}>
          {submitting ? 'Adding…' : 'Add model'}
        </button>
        <button type="button" className={styles.smallButton} onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
      </div>
    </div>
  )
}
