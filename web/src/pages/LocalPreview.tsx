import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ModelViewer } from '../viewer/ModelViewer'
import { ElementDataPanel } from '../components/ElementDataPanel'
import { ScalePresetSelect } from '../components/ScalePresetSelect'
import { useIfcElementData } from '../ifc/useIfcElementData'
import type { IfcElementData } from '../types/IfcElementData'
import type { ScalePreset } from '../types/ScalePreset'
import styles from '../styles/form.module.css'

// Loads a model straight from the visitor's own device via a local blob
// URL -- no upload, no Supabase, no size limits, works before any backend
// exists. Deliberately does NOT offer the "View in AR" handoff: Scene
// Viewer/Quick Look are separate native apps that need a real internet
// URL to fetch the model from, and can't reach into this tab's memory for
// a blob: URL. See docs/features/client-presentation-viewer.md.
export function LocalPreview() {
  const [modelFile, setModelFile] = useState<File | null>(null)
  const [ifcFile, setIfcFile] = useState<File | null>(null)
  const [scalePreset, setScalePreset] = useState<ScalePreset | ''>('1:1')
  const [modelUrl, setModelUrl] = useState<string | null>(null)
  const [ifcUrl, setIfcUrl] = useState<string | null>(null)
  const [selectedElement, setSelectedElement] = useState<IfcElementData | null>(null)
  const [selecting, setSelecting] = useState(false)

  const { getElementDataByGlobalId } = useIfcElementData(ifcUrl)

  // Blob URLs must be revoked when no longer needed, or the browser keeps
  // the file data alive in memory for the life of the tab. setState calls
  // deferred into an inner function -- same react-hooks/set-state-in-effect
  // workaround used in ifc/useIfcElementData.ts.
  useEffect(() => {
    if (!modelFile) {
      ;(() => setModelUrl(null))()
      return
    }
    const url = URL.createObjectURL(modelFile)
    ;(() => setModelUrl(url))()
    return () => URL.revokeObjectURL(url)
  }, [modelFile])

  useEffect(() => {
    if (!ifcFile) {
      ;(() => setIfcUrl(null))()
      return
    }
    const url = URL.createObjectURL(ifcFile)
    ;(() => setIfcUrl(url))()
    return () => URL.revokeObjectURL(url)
  }, [ifcFile])

  async function handleElementSelect(globalId: string) {
    setSelecting(true)
    try {
      const data = await getElementDataByGlobalId(globalId)
      setSelectedElement(data)
    } finally {
      setSelecting(false)
    }
  }

  return (
    <main className={styles.stack}>
      <div className={styles.card}>
        <p className={styles.subtitle}>
          <Link to="/" className={styles.link}>
            ← Back
          </Link>
        </p>
        <h1 className={styles.title}>Preview a file from your device</h1>
        <p className={styles.subtitle}>
          Nothing here is uploaded anywhere — the file stays on your device and is only read by
          your browser. Good for a quick look, but the "View in AR" handoff needs a real hosted
          link (see the main upload flow) since your phone's AR app can't reach a file that's
          only local to this tab.
        </p>

        <div className={styles.field}>
          <label htmlFor="local-model-file" className={styles.label}>
            Model file (glTF / GLB)
          </label>
          <input
            id="local-model-file"
            type="file"
            accept=".glb,.gltf"
            className={styles.fileInput}
            onChange={(event) => setModelFile(event.target.files?.[0] ?? null)}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="local-ifc-file" className={styles.label}>
            IFC file (optional — enables tap-to-inspect)
          </label>
          <input
            id="local-ifc-file"
            type="file"
            accept=".ifc"
            className={styles.fileInput}
            onChange={(event) => setIfcFile(event.target.files?.[0] ?? null)}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="local-scale-preset" className={styles.label}>
            Scale
          </label>
          <ScalePresetSelect
            id="local-scale-preset"
            className={styles.select}
            value={scalePreset}
            onChange={setScalePreset}
          />
        </div>
      </div>

      {modelUrl && scalePreset && (
        <div className={styles.viewer}>
          <ModelViewer
            modelUrl={modelUrl}
            scalePreset={scalePreset}
            onElementSelect={ifcUrl ? (id) => void handleElementSelect(id) : undefined}
          />
          <ElementDataPanel
            data={selectedElement}
            loading={selecting}
            onClose={() => setSelectedElement(null)}
          />
        </div>
      )}
    </main>
  )
}
