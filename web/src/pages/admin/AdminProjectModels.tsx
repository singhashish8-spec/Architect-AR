import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { ScalePresetSelect } from '../../components/ScalePresetSelect'
import {
  addAdminModel,
  deleteAdminModel,
  reorderAdminModels,
  updateAdminModel,
} from '../../services/adminService'
import { uploadIfcFile, uploadModelFile } from '../../services/projectService'
import type { AdminProjectModel } from '../../types/ProjectModel'
import type { ScalePreset } from '../../types/ScalePreset'
import { getErrorMessage } from '../../utils/errorMessage'
import type { AdminProjectPageContext } from './AdminProjectPage'
import formStyles from '../../styles/form.module.css'
import styles from './AdminProjectModels.module.css'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' })
}

// Add/replace/rename/delete/reorder/note a project's models -- moved
// here from the old single-page AdminProjectEditor.tsx once the
// dashboard became multi-page. Rows are collapsed summaries by default
// (name, scale, created date, view count), not always-open edit forms --
// with several models ("versions") per project becoming normal, always
// showing every field for every one turned into a long scroll (owner's
// own report, 2026-08-09). See docs/features/full-admin-dashboard.md.
export function AdminProjectModels() {
  const { project, passcode, refresh } = useOutletContext<AdminProjectPageContext>()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  async function withBusy(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await action()
      await refresh()
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
    await withBusy(() => deleteAdminModel(passcode, model))
  }

  async function handleMove(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= project.models.length) return
    const ids = project.models.map((m) => m.id)
    const [moved] = ids.splice(index, 1)
    ids.splice(target, 0, moved)
    await withBusy(() => reorderAdminModels(passcode, project.id, ids))
  }

  return (
    <div>
      {error && (
        <p role="alert" className={formStyles.error}>
          {error}
        </p>
      )}
      <div className={styles.modelList}>
        {project.models.map((model, index) => (
          <ModelRow
            key={model.id}
            projectId={project.id}
            passcode={passcode}
            model={model}
            busy={busy}
            expanded={expandedId === model.id}
            onToggleExpanded={() => setExpandedId((current) => (current === model.id ? null : model.id))}
            isFirst={index === 0}
            isLast={index === project.models.length - 1}
            onMoveUp={() => void handleMove(index, -1)}
            onMoveDown={() => void handleMove(index, 1)}
            onDelete={() => void handleDelete(model)}
            onChanged={() => void refresh()}
          />
        ))}
      </div>

      {showAddForm ? (
        <AddModelForm
          passcode={passcode}
          projectId={project.id}
          onDone={() => {
            setShowAddForm(false)
            void refresh()
          }}
          onCancel={() => setShowAddForm(false)}
        />
      ) : (
        <button type="button" className={styles.addModelButton} onClick={() => setShowAddForm(true)}>
          + Add another model
        </button>
      )}
    </div>
  )
}

interface ModelRowProps {
  projectId: string
  passcode: string
  model: AdminProjectModel
  busy: boolean
  expanded: boolean
  onToggleExpanded: () => void
  isFirst: boolean
  isLast: boolean
  onMoveUp: () => void
  onMoveDown: () => void
  onDelete: () => void
  onChanged: () => void
}

function ModelRow({
  projectId,
  passcode,
  model,
  busy,
  expanded,
  onToggleExpanded,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onDelete,
  onChanged,
}: ModelRowProps) {
  return (
    <div className={styles.modelRow}>
      <div className={styles.modelSummary}>
        <div className={styles.modelSummaryMain}>
          <span className={styles.modelName}>{model.name}</span>
          <span className={styles.modelBadge}>{model.scalePreset}</span>
          {model.note && <span className={styles.modelNoteBadge}>{model.note}</span>}
        </div>
        <div className={styles.modelSummaryMeta}>
          <span>Created {formatDate(model.createdAt)}</span>
          <span>{model.viewCount} views</span>
        </div>
        <div className={styles.modelSummaryActions}>
          <a
            href={`/p/${projectId}?model=${model.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.smallButton}
          >
            Preview
          </a>
          <button type="button" className={styles.smallButton} onClick={onToggleExpanded}>
            {expanded ? 'Close' : 'Edit'}
          </button>
        </div>
      </div>
      {expanded && (
        <ModelEditForm
          model={model}
          passcode={passcode}
          busy={busy}
          isFirst={isFirst}
          isLast={isLast}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
          onDelete={onDelete}
          onChanged={onChanged}
        />
      )}
    </div>
  )
}

interface ModelEditFormProps {
  model: AdminProjectModel
  passcode: string
  busy: boolean
  isFirst: boolean
  isLast: boolean
  onMoveUp: () => void
  onMoveDown: () => void
  onDelete: () => void
  onChanged: () => void
}

function ModelEditForm({ model, passcode, busy, isFirst, isLast, onMoveUp, onMoveDown, onDelete, onChanged }: ModelEditFormProps) {
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
      await updateAdminModel(passcode, {
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
    <div className={styles.editForm}>
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
  passcode: string
  projectId: string
  onDone: () => void
  onCancel: () => void
}

function AddModelForm({ passcode, projectId, onDone, onCancel }: AddModelFormProps) {
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
      await addAdminModel(passcode, projectId, {
        name: name.trim() || 'New model',
        // A model file is required by NewProjectModel's shape -- see the
        // same note this had in the old AdminProjectEditor.tsx: an
        // IFC-only add still needs some viewable geometry, and
        // converting IFC to a GLB here would duplicate
        // ProjectCreateForm.tsx's conversion logic for a case admins can
        // also cover by uploading a GLB alongside the IFC.
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
