import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ModelViewer } from '../viewer/ModelViewer'
import { ARHandoff } from '../viewer/ARHandoff'
import { ElementDataPanel } from '../components/ElementDataPanel'
import { ProjectQRCode } from '../components/ProjectQRCode'
import { useIfcElementData } from '../ifc/useIfcElementData'
import { getProject } from '../services/projectService'
import type { Project } from '../types/Project'
import type { IfcElementData } from '../types/IfcElementData'

export function ProjectView() {
  const { projectId } = useParams<{ projectId: string }>()
  const [project, setProject] = useState<Project | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selectedElement, setSelectedElement] = useState<IfcElementData | null>(null)
  // Tracks "the user tapped something and we're resolving it" --
  // deliberately separate from useIfcElementData's `loading` (the
  // whole-file background parse). Using the whole-file flag here would
  // show the data panel automatically on page load, before any tap.
  const [selecting, setSelecting] = useState(false)
  const [showQr, setShowQr] = useState(false)

  const { getElementDataByGlobalId } = useIfcElementData(project?.ifcUrl ?? null)

  useEffect(() => {
    if (!projectId) return
    let cancelled = false

    void (async () => {
      try {
        const result = await getProject(projectId)
        if (!cancelled) {
          setProject(result)
          if (!result) setLoadError('This link doesn’t match a project.')
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Failed to load this project.')
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [projectId])

  async function handleElementSelect(globalId: string) {
    setSelecting(true)
    try {
      const data = await getElementDataByGlobalId(globalId)
      setSelectedElement(data)
    } finally {
      setSelecting(false)
    }
  }

  if (loadError) return <p role="alert">{loadError}</p>
  if (!project) return <p>Loading…</p>

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      <ModelViewer
        modelUrl={project.modelUrl}
        scalePreset={project.scalePreset}
        onElementSelect={project.ifcUrl ? (id) => void handleElementSelect(id) : undefined}
      />
      <div style={{ position: 'absolute', bottom: '1rem', right: '1rem', width: 96, height: 96 }}>
        <ARHandoff modelUrl={project.modelUrl} scalePreset={project.scalePreset} alt={project.name} />
      </div>
      <div style={{ position: 'absolute', top: '1rem', left: '1rem' }}>
        <button type="button" onClick={() => setShowQr((current) => !current)}>
          {showQr ? 'Hide QR code' : 'Get QR code for a printed sheet'}
        </button>
        {showQr && (
          <div style={{ background: '#fff', padding: '1rem', marginTop: '0.5rem' }}>
            <ProjectQRCode url={window.location.href} projectName={project.name} />
          </div>
        )}
      </div>
      <ElementDataPanel
        data={selectedElement}
        loading={selecting}
        onClose={() => setSelectedElement(null)}
      />
    </div>
  )
}
