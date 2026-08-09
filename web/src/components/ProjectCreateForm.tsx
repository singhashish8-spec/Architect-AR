import { useState, type FormEvent } from 'react'
import { ScalePresetSelect } from './ScalePresetSelect'
import { ConversionProgressBar } from './ConversionProgressBar'
import { createAdminProject } from '../services/adminService'
import { uploadIfcFile, uploadModelFile } from '../services/projectService'
import { convertIfcToGlb, type ConversionProgress } from '../ifc/ifcToGlb'
import type { NewProjectModel } from '../types/ProjectModel'
import type { ScalePreset } from '../types/ScalePreset'
import { getErrorMessage } from '../utils/errorMessage'
import styles from '../styles/form.module.css'

// Creating a project moved behind the admin passcode entirely (Phase 3,
// owner's call 2026-08-09) -- this is the same form pages/UploadProject.tsx
// used to render at the public "/" route, now embedded in
// pages/AdminDashboard.tsx instead and calling the admin-gated
// createAdminProject() rather than the old public createProject(). See
// docs/features/full-admin-dashboard.md.

interface ModelDraft {
  name: string
  modelFile: File | null
  ifcFile: File | null
  scalePreset: ScalePreset | ''
}

function emptyModel(): ModelDraft {
  return { name: '', modelFile: null, ifcFile: null, scalePreset: '' }
}

interface ProjectCreateFormProps {
  adminPasscode: string
  onCreated: (projectId: string) => void
}

export function ProjectCreateForm({ adminPasscode, onCreated }: ProjectCreateFormProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [models, setModels] = useState<ModelDraft[]>([emptyModel()])
  const [passcode, setPasscode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conversion, setConversion] = useState<{ modelIndex: number; progress: ConversionProgress } | null>(
    null,
  )

  function updateModel(index: number, patch: Partial<ModelDraft>) {
    setModels((current) => current.map((model, i) => (i === index ? { ...model, ...patch } : model)))
  }

  function addModel() {
    setModels((current) => [...current, emptyModel()])
  }

  function removeModel(index: number) {
    setModels((current) => current.filter((_, i) => i !== index))
  }

  function reset() {
    setName('')
    setDescription('')
    setModels([emptyModel()])
    setPasscode('')
  }

  const canSubmit = name.trim().length > 0 && models.every((model) => (model.modelFile || model.ifcFile) && model.scalePreset)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!canSubmit) return

    setSubmitting(true)
    setError(null)
    try {
      const uploadedModels: NewProjectModel[] = []
      for (const [index, draft] of models.entries()) {
        if (!(draft.modelFile || draft.ifcFile) || !draft.scalePreset) continue

        let modelUrl: string
        if (draft.modelFile) {
          modelUrl = await uploadModelFile(draft.modelFile)
        } else {
          const glbBlob = await convertIfcToGlb(draft.ifcFile!, (progress) => {
            setConversion({ modelIndex: index, progress })
          })
          setConversion(null)
          const glbFile = new File([glbBlob], `${draft.ifcFile!.name.replace(/\.ifc$/i, '')}.glb`, {
            type: 'model/gltf-binary',
          })
          modelUrl = await uploadModelFile(glbFile)
        }
        const ifcUrl = draft.ifcFile ? await uploadIfcFile(draft.ifcFile) : null
        uploadedModels.push({
          name: draft.name.trim() || `Model ${index + 1}`,
          modelUrl,
          ifcUrl,
          scalePreset: draft.scalePreset,
        })
      }
      const id = await createAdminProject(adminPasscode, {
        name,
        models: uploadedModels,
        passcode,
        description,
      })
      reset()
      onCreated(id)
    } catch (err) {
      setError(getErrorMessage(err, 'Could not create this project. Please try again.'))
    } finally {
      setConversion(null)
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)}>
      <div className={styles.field}>
        <label htmlFor="new-project-name" className={styles.label}>
          Project name
        </label>
        <input
          id="new-project-name"
          type="text"
          required
          className={styles.input}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="new-project-description" className={styles.label}>
          Project details (optional — shown on the share card sent to clients)
        </label>
        <textarea
          id="new-project-description"
          className={styles.textarea}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder={'e.g. "3BHK renovation, Bandra — walkthrough for client review"'}
          rows={3}
        />
      </div>

      {models.map((model, index) => (
        <div key={index} className={styles.modelGroup}>
          <div className={styles.modelHeader}>
            <h3 className={styles.modelTitle}>Model {index + 1}</h3>
            {models.length > 1 && (
              <button type="button" className={styles.removeButton} onClick={() => removeModel(index)}>
                Remove
              </button>
            )}
          </div>

          <div className={styles.field}>
            <label htmlFor={`new-model-name-${index}`} className={styles.label}>
              Model name (optional — e.g. "Kitchen" or "Option A")
            </label>
            <input
              id={`new-model-name-${index}`}
              type="text"
              className={styles.input}
              value={model.name}
              onChange={(event) => updateModel(index, { name: event.target.value })}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor={`new-model-file-${index}`} className={styles.label}>
              Model file (glTF / GLB) — optional
            </label>
            <input
              id={`new-model-file-${index}`}
              type="file"
              accept=".glb,.gltf"
              className={styles.fileInput}
              onChange={(event) => updateModel(index, { modelFile: event.target.files?.[0] ?? null })}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor={`new-ifc-file-${index}`} className={styles.label}>
              IFC file — required if no model file is given above; also enables tap-to-inspect
            </label>
            <input
              id={`new-ifc-file-${index}`}
              type="file"
              accept=".ifc"
              className={styles.fileInput}
              onChange={(event) => updateModel(index, { ifcFile: event.target.files?.[0] ?? null })}
            />
            {!model.modelFile && model.ifcFile && (
              <p className={styles.subtitle}>
                No model file given — we'll build the 3D view straight from this IFC file when you submit.
                Materials will show as flat colors, not real textures, since IFC doesn't carry those.
              </p>
            )}
          </div>

          <div className={styles.field}>
            <label htmlFor={`new-scale-preset-${index}`} className={styles.label}>
              Scale
            </label>
            <ScalePresetSelect
              id={`new-scale-preset-${index}`}
              className={styles.select}
              value={model.scalePreset}
              onChange={(value) => updateModel(index, { scalePreset: value })}
            />
          </div>

          {conversion?.modelIndex === index && <ConversionProgressBar progress={conversion.progress} />}
        </div>
      ))}

      <button type="button" className={styles.addButton} onClick={addModel}>
        + Add another model
      </button>

      <div className={styles.field}>
        <label htmlFor="new-project-passcode" className={styles.label}>
          Passcode (optional — leave blank for an open link)
        </label>
        <input
          id="new-project-passcode"
          type="text"
          className={styles.input}
          value={passcode}
          onChange={(event) => setPasscode(event.target.value)}
          placeholder="Anyone with this link and the passcode can view it"
        />
      </div>

      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}

      <button type="submit" className={styles.button} disabled={submitting || !canSubmit}>
        {submitting ? (conversion ? 'Converting…' : 'Creating…') : 'Create project'}
      </button>
    </form>
  )
}
