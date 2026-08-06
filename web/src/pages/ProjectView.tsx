import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ModelViewer } from '../viewer/ModelViewer'
import { ARHandoff } from '../viewer/ARHandoff'
import { ElementDataPanel } from '../components/ElementDataPanel'
import { useIfcElementData } from '../ifc/useIfcElementData'
import { getProject } from '../services/projectService'
import type { Project } from '../types/Project'
import type { IfcElementData } from '../types/IfcElementData'

export function ProjectView() {
  const { projectId } = useParams<{ projectId: string }>()
  const [project, setProject] = useState<Project | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selectedElement, setSelectedElement] = useState<IfcElementData | null>(null)

  const { loading: ifcLoading, getElementDataByGlobalId } = useIfcElementData(
    project?.ifcUrl ?? null,
  )

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
    const data = await getElementDataByGlobalId(globalId)
    setSelectedElement(data)
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
      <ElementDataPanel
        data={selectedElement}
        loading={ifcLoading}
        onClose={() => setSelectedElement(null)}
      />
    </div>
  )
}
