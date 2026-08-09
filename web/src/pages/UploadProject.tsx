import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ScalePresetSelect } from '../components/ScalePresetSelect'
import { createProject, uploadIfcFile, uploadModelFile } from '../services/projectService'
import type { NewProjectModel } from '../types/ProjectModel'
import type { ScalePreset } from '../types/ScalePreset'
import styles from '../styles/form.module.css'

// One in-progress model entry in the form -- turned into a
// NewProjectModel (with real uploaded URLs) at submit time. Kept
// separate from that type since the files themselves aren't URLs yet.
interface ModelDraft {
  name: string
  modelFile: File | null
  ifcFile: File | null
  scalePreset: ScalePreset | ''
}

function emptyModel(): ModelDraft {
  return { name: '', modelFile: null, ifcFile: null, scalePreset: '' }
}

export function UploadProject() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [models, setModels] = useState<ModelDraft[]>([emptyModel()])
  const [passcode, setPasscode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function updateModel(index: number, patch: Partial<ModelDraft>) {
    setModels((current) => current.map((model, i) => (i === index ? { ...model, ...patch } : model)))
  }

  function addModel() {
    setModels((current) => [...current, emptyModel()])
  }

  function removeModel(index: number) {
    setModels((current) => current.filter((_, i) => i !== index))
  }

  const canSubmit = models.every((model) => model.modelFile && model.scalePreset)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!canSubmit) return

    setSubmitting(true)
    setError(null)
    try {
      const uploadedModels: NewProjectModel[] = []
      for (const [index, draft] of models.entries()) {
        // canSubmit already guarantees these, but TS can't see that here.
        if (!draft.modelFile || !draft.scalePreset) continue
        const modelUrl = await uploadModelFile(draft.modelFile)
        const ifcUrl = draft.ifcFile ? await uploadIfcFile(draft.ifcFile) : null
        uploadedModels.push({
          name: draft.name.trim() || `Model ${index + 1}`,
          modelUrl,
          ifcUrl,
          scalePreset: draft.scalePreset,
        })
      }
      const project = await createProject({ name, models: uploadedModels, passcode })
      await navigate(`/p/${project.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>New project</h1>
        <p className={styles.subtitle}>
          <Link to="/local" className={styles.link}>
            Just want to preview a file from your device, no upload? →
          </Link>
        </p>
        <form onSubmit={(event) => void handleSubmit(event)}>
          <div className={styles.field}>
            <label htmlFor="name" className={styles.label}>
              Project name
            </label>
            <input
              id="name"
              type="text"
              required
              className={styles.input}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          {models.map((model, index) => (
            <div key={index} className={styles.modelGroup}>
              <div className={styles.modelHeader}>
                <h2 className={styles.modelTitle}>Model {index + 1}</h2>
                {models.length > 1 && (
                  <button type="button" className={styles.removeButton} onClick={() => removeModel(index)}>
                    Remove
                  </button>
                )}
              </div>

              <div className={styles.field}>
                <label htmlFor={`model-name-${index}`} className={styles.label}>
                  Model name (optional — e.g. "Kitchen" or "Option A")
                </label>
                <input
                  id={`model-name-${index}`}
                  type="text"
                  className={styles.input}
                  value={model.name}
                  onChange={(event) => updateModel(index, { name: event.target.value })}
                />
              </div>

              <div className={styles.field}>
                <label htmlFor={`model-file-${index}`} className={styles.label}>
                  Model file (glTF / GLB)
                </label>
                <input
                  id={`model-file-${index}`}
                  type="file"
                  accept=".glb,.gltf"
                  required
                  className={styles.fileInput}
                  onChange={(event) => updateModel(index, { modelFile: event.target.files?.[0] ?? null })}
                />
              </div>

              <div className={styles.field}>
                <label htmlFor={`ifc-file-${index}`} className={styles.label}>
                  IFC file (optional — enables tap-to-inspect)
                </label>
                <input
                  id={`ifc-file-${index}`}
                  type="file"
                  accept=".ifc"
                  className={styles.fileInput}
                  onChange={(event) => updateModel(index, { ifcFile: event.target.files?.[0] ?? null })}
                />
              </div>

              <div className={styles.field}>
                <label htmlFor={`scale-preset-${index}`} className={styles.label}>
                  Scale
                </label>
                <ScalePresetSelect
                  id={`scale-preset-${index}`}
                  className={styles.select}
                  value={model.scalePreset}
                  onChange={(value) => updateModel(index, { scalePreset: value })}
                />
              </div>
            </div>
          ))}

          <button type="button" className={styles.addButton} onClick={addModel}>
            + Add another model
          </button>

          <div className={styles.field}>
            <label htmlFor="passcode" className={styles.label}>
              Passcode (optional — leave blank for an open link)
            </label>
            <input
              id="passcode"
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
            {submitting ? 'Uploading…' : 'Create shareable link'}
          </button>
        </form>
      </div>
    </main>
  )
}
