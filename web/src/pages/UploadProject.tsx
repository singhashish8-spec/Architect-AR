import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ScalePresetSelect } from '../components/ScalePresetSelect'
import { createProject, uploadIfcFile, uploadModelFile } from '../services/projectService'
import type { ScalePreset } from '../types/ScalePreset'

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
    <main>
      <h1>New project</h1>
      <form onSubmit={(event) => void handleSubmit(event)}>
        <div>
          <label htmlFor="name">Project name</label>
          <input
            id="name"
            type="text"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>

        <div>
          <label htmlFor="model-file">Model file (glTF / GLB)</label>
          <input
            id="model-file"
            type="file"
            accept=".glb,.gltf"
            required
            onChange={(event) => setModelFile(event.target.files?.[0] ?? null)}
          />
        </div>

        <div>
          <label htmlFor="ifc-file">IFC file (optional — enables tap-to-inspect)</label>
          <input
            id="ifc-file"
            type="file"
            accept=".ifc"
            onChange={(event) => setIfcFile(event.target.files?.[0] ?? null)}
          />
        </div>

        <div>
          <label htmlFor="scale-preset">Scale</label>
          <ScalePresetSelect id="scale-preset" value={scalePreset} onChange={setScalePreset} />
        </div>

        {error && <p role="alert">{error}</p>}

        <button type="submit" disabled={submitting || !modelFile || !scalePreset}>
          {submitting ? 'Uploading…' : 'Create shareable link'}
        </button>
      </form>
    </main>
  )
}
