import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ScalePresetSelect } from '../components/ScalePresetSelect'
import { createProject, uploadIfcFile, uploadModelFile } from '../services/projectService'
import type { ScalePreset } from '../types/ScalePreset'
import styles from '../styles/form.module.css'

export function UploadProject() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [modelFile, setModelFile] = useState<File | null>(null)
  const [ifcFile, setIfcFile] = useState<File | null>(null)
  const [scalePreset, setScalePreset] = useState<ScalePreset | ''>('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!modelFile || !scalePreset) return

    setSubmitting(true)
    setError(null)
    try {
      const modelUrl = await uploadModelFile(modelFile)
      const ifcUrl = ifcFile ? await uploadIfcFile(ifcFile) : null
      const project = await createProject({ name, modelUrl, ifcUrl, scalePreset })
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

          <div className={styles.field}>
            <label htmlFor="model-file" className={styles.label}>
              Model file (glTF / GLB)
            </label>
            <input
              id="model-file"
              type="file"
              accept=".glb,.gltf"
              required
              className={styles.fileInput}
              onChange={(event) => setModelFile(event.target.files?.[0] ?? null)}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="ifc-file" className={styles.label}>
              IFC file (optional — enables tap-to-inspect)
            </label>
            <input
              id="ifc-file"
              type="file"
              accept=".ifc"
              className={styles.fileInput}
              onChange={(event) => setIfcFile(event.target.files?.[0] ?? null)}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="scale-preset" className={styles.label}>
              Scale
            </label>
            <ScalePresetSelect
              id="scale-preset"
              className={styles.select}
              value={scalePreset}
              onChange={setScalePreset}
            />
          </div>

          {error && (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          )}

          <button type="submit" className={styles.button} disabled={submitting || !modelFile || !scalePreset}>
            {submitting ? 'Uploading…' : 'Create shareable link'}
          </button>
        </form>
      </div>
    </main>
  )
}
