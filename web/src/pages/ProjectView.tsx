import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ModelViewer, type ModelViewerHandle } from '../viewer/ModelViewer'
import { ARHandoff } from '../viewer/ARHandoff'
import { ElementDataPanel } from '../components/ElementDataPanel'
import { ProjectShareCard } from '../components/ProjectShareCard'
import { PasscodeGate } from '../components/PasscodeGate'
import { LevelsPanel } from '../components/LevelsPanel'
import { CategoryPanel } from '../components/CategoryPanel'
import { LightingPresetPanel } from '../components/LightingPresetPanel'
import { SearchPanel } from '../components/SearchPanel'
import { useIfcElementData } from '../ifc/useIfcElementData'
import { getProject, projectRequiresPasscode } from '../services/projectService'
import type { Project } from '../types/Project'
import type { IfcElementData } from '../types/IfcElementData'
import type { LightingPreset } from '../types/LightingPreset'
import { getErrorMessage } from '../utils/errorMessage'
import styles from './ProjectView.module.css'
import labelStyles from '../styles/responsiveLabel.module.css'

export function ProjectView() {
  const { projectId } = useParams<{ projectId: string }>()
  const [project, setProject] = useState<Project | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  // null = still checking whether this project needs a passcode at all --
  // kept distinct from `false` so a passcode-free project renders exactly
  // as before, with no gate flashing on screen even briefly.
  const [passcodeRequired, setPasscodeRequired] = useState<boolean | null>(null)
  const [selectedModelIndex, setSelectedModelIndex] = useState(0)
  const [selectedElement, setSelectedElement] = useState<IfcElementData | null>(null)
  // Tracks "the user tapped something and we're resolving it" --
  // deliberately separate from useIfcElementData's `loading` (the
  // whole-file background parse). Using the whole-file flag here would
  // show the data panel automatically on page load, before any tap.
  const [selecting, setSelecting] = useState(false)
  const [showQr, setShowQr] = useState(false)
  const [hiddenGlobalIds, setHiddenGlobalIds] = useState<Set<string>>(new Set())
  const [lightingPreset, setLightingPreset] = useState<LightingPreset>('daylight')

  const activeModel = project?.models[selectedModelIndex] ?? null
  const { getElementDataByGlobalId, levels, categories } = useIfcElementData(activeModel?.ifcUrl ?? null)
  const viewerRef = useRef<ModelViewerHandle>(null)

  useEffect(() => {
    if (!projectId) return
    let cancelled = false

    void (async () => {
      try {
        const required = await projectRequiresPasscode(projectId)
        if (cancelled) return
        setPasscodeRequired(required)
        if (required) return // wait for PasscodeGate instead of loading yet

        const result = await getProject(projectId)
        if (!cancelled) {
          setProject(result)
          if (!result) setLoadError('This link doesn’t match a project.')
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(getErrorMessage(err, 'Failed to load this project.'))
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [projectId])

  // Returns whether the passcode was accepted -- PasscodeGate shows its
  // own "incorrect" message on false, nothing else to do here in that case.
  async function handlePasscodeSubmit(passcode: string): Promise<boolean> {
    if (!projectId) return false
    const result = await getProject(projectId, passcode)
    if (result) setProject(result)
    return result !== null
  }

  // Switching models should drop any data panel left over from the
  // previous one -- otherwise a tap on model A's wall would stay on
  // screen describing model A after switching to model B.
  function selectModel(index: number) {
    setSelectedModelIndex(index)
    setSelectedElement(null)
    setHiddenGlobalIds(new Set())
  }

  async function handleElementSelect(globalId: string) {
    setSelecting(true)
    try {
      const data = await getElementDataByGlobalId(globalId)
      setSelectedElement(data)
    } finally {
      setSelecting(false)
    }
  }

  if (loadError)
    return (
      <p role="alert" className={styles.status}>
        {loadError}
      </p>
    )
  if (passcodeRequired === null) return <p className={styles.status}>Loading…</p>
  if (passcodeRequired && !project) return <PasscodeGate onSubmit={handlePasscodeSubmit} />
  if (!project || !activeModel) return <p className={styles.status}>Loading…</p>

  return (
    <div className={styles.root}>
      <ModelViewer
        ref={viewerRef}
        modelUrl={activeModel.modelUrl}
        scalePreset={activeModel.scalePreset}
        onElementSelect={activeModel.ifcUrl ? (id) => void handleElementSelect(id) : undefined}
        hiddenGlobalIds={hiddenGlobalIds}
        lightingPreset={lightingPreset}
      />
      {project.models.length > 1 && (
        <div className={styles.modelSwitcher}>
          {project.models.map((model, index) => (
            <button
              key={model.id}
              type="button"
              className={index === selectedModelIndex ? styles.modelTabActive : styles.modelTab}
              onClick={() => selectModel(index)}
            >
              {model.name}
            </button>
          ))}
        </div>
      )}
      <div className={styles.arButton}>
        <ARHandoff modelUrl={activeModel.modelUrl} scalePreset={activeModel.scalePreset} alt={activeModel.name} />
      </div>
      <div className={styles.topRightCorner}>
        <LevelsPanel levels={levels} onJumpTo={(globalIds) => viewerRef.current?.focusOnGlobalIds(globalIds)} />
        <CategoryPanel categories={categories} onHiddenGlobalIdsChange={setHiddenGlobalIds} />
        <LightingPresetPanel value={lightingPreset} onChange={setLightingPreset} />
        <SearchPanel
          levels={levels}
          categories={categories}
          onIsolate={setHiddenGlobalIds}
          onJumpTo={(globalIds) => viewerRef.current?.focusOnGlobalIds(globalIds)}
        />
      </div>
      <div className={styles.qrCorner}>
        <button
          type="button"
          className={styles.qrToggle}
          onClick={() => setShowQr((current) => !current)}
          aria-label={showQr ? 'Hide share options' : 'Share this project'}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <line x1="14" y1="14" x2="14" y2="17" />
            <line x1="14" y1="14" x2="17" y2="14" />
            <line x1="21" y1="14" x2="21" y2="14.01" />
            <line x1="14" y1="21" x2="14" y2="21.01" />
            <line x1="17" y1="17" x2="21" y2="17" />
            <line x1="21" y1="21" x2="17" y2="21" />
            <line x1="21" y1="17" x2="21" y2="21" />
          </svg>
          <span className={labelStyles.label}>{showQr ? 'Hide share options' : 'Share this project'}</span>
        </button>
        {showQr && (
          <div className={styles.qrCode}>
            <ProjectShareCard url={window.location.href} projectName={project.name} description={project.description} />
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
