import { useState, type FormEvent } from 'react'
import { ScalePresetSelect } from './ScalePresetSelect'
import { ModelFileDropzone } from './ModelFileDropzone'
import { PipelineProgressBar, type PipelineProgressBarProps } from './PipelineProgressBar'
import { createAdminProject } from '../services/adminService'
import { uploadIfcFile, uploadModelFile } from '../services/projectService'
import { convertIfcToGlb } from '../ifc/ifcToGlb'
import { ifcProgressToBar, fbxProgressToBar, uploadProgressToBar } from '../utils/pipelineProgress'
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
  // Only meaningful when modelFile is an FBX (see viewer/fbxToGlb.ts) --
  // ignored entirely for a plain GLB/glTF upload, which never goes
  // through conversion at all. Defaults to true: the whole reason to
  // prefer FBX over IFC is real materials, so textures should be on by
  // default, not something someone has to remember to opt into.
  includeTextures: boolean
}

function emptyModel(): ModelDraft {
  return { name: '', modelFile: null, ifcFile: null, scalePreset: '', includeTextures: true }
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
  // One progress bar for the whole convert-then-upload pipeline, per
  // model being submitted -- see components/PipelineProgressBar.tsx for
  // why this replaced three separate progress states/components.
  const [pipeline, setPipeline] = useState<{ modelIndex: number; bar: PipelineProgressBarProps } | null>(null)

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
          // Dynamically imported -- three-stdlib's FBXLoader/GLTFExporter
          // add a real, measurable chunk to the main bundle (confirmed via
          // a production build, 2026-08-12), so this only ever loads for
          // someone who actually submits a model file, not every visitor
          // of this form.
          const { uploadModelFileWithConversion } = await import('../viewer/fbxToGlb')
          modelUrl = await uploadModelFileWithConversion(
            draft.modelFile,
            { includeTextures: draft.includeTextures },
            (progress) => setPipeline({ modelIndex: index, bar: fbxProgressToBar(progress) }),
            (loaded, total) =>
              setPipeline({ modelIndex: index, bar: uploadProgressToBar('Uploading model…', loaded, total) }),
          )
        } else {
          const glbBlob = await convertIfcToGlb(draft.ifcFile!, (progress) => {
            setPipeline({ modelIndex: index, bar: ifcProgressToBar(progress) })
          })
          const glbFile = new File([glbBlob], `${draft.ifcFile!.name.replace(/\.ifc$/i, '')}.glb`, {
            type: 'model/gltf-binary',
          })
          modelUrl = await uploadModelFile(glbFile, (loaded, total) =>
            setPipeline({ modelIndex: index, bar: uploadProgressToBar('Uploading model…', loaded, total) }),
          )
        }
        const ifcUrl = draft.ifcFile
          ? await uploadIfcFile(draft.ifcFile, (loaded, total) =>
              setPipeline({ modelIndex: index, bar: uploadProgressToBar('Uploading IFC file…', loaded, total) }),
            )
          : null
        setPipeline(null)
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
      setPipeline(null)
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
            <label className={styles.label}>Model / IFC files</label>
            <ModelFileDropzone
              id={`new-model-dropzone-${index}`}
              modelFile={model.modelFile}
              ifcFile={model.ifcFile}
              onModelFileChange={(file) => updateModel(index, { modelFile: file })}
              onIfcFileChange={(file) => updateModel(index, { ifcFile: file })}
              includeTextures={model.includeTextures}
              onIncludeTexturesChange={(value) => updateModel(index, { includeTextures: value })}
            />
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

          {pipeline?.modelIndex === index && (
            <PipelineProgressBar label={pipeline.bar.label} percent={pipeline.bar.percent} detail={pipeline.bar.detail} />
          )}
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
        {submitting ? (pipeline ? 'Working…' : 'Creating…') : 'Create project'}
      </button>
    </form>
  )
}
