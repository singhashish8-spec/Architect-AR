import { useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { ModelViewer, type ModelViewerHandle } from '../viewer/ModelViewer'
import { ARHandoff } from '../viewer/ARHandoff'
import { ElementDataPanel } from '../components/ElementDataPanel'
import { PasscodeGate } from '../components/PasscodeGate'
import { LevelsPanel } from '../components/LevelsPanel'
import { CategoryPanel } from '../components/CategoryPanel'
import { LightingPresetPanel } from '../components/LightingPresetPanel'
import { SearchPanel } from '../components/SearchPanel'
import { BoqPanel } from '../components/BoqPanel'
import { useIfcElementData } from '../ifc/useIfcElementData'
import { useProjectViewTracking } from '../hooks/useProjectViewTracking'
import { useProjectAccess } from '../hooks/useProjectAccess'
import type { IfcElementData } from '../types/IfcElementData'
import type { LightingPreset } from '../types/LightingPreset'
import type { CornerPanelKey } from '../types/CornerPanel'
import styles from './ProjectView.module.css'

export function ProjectView() {
  const { projectId } = useParams<{ projectId: string }>()
  // ?model=<id> deep-links a specific model within the project -- the
  // admin Models tab's "Preview" link for a specific model relies on
  // this (Phase 3, see docs/features/full-admin-dashboard.md). Absent
  // or unrecognized just falls through to the first model, same as
  // before this existed.
  const [searchParams, setSearchParams] = useSearchParams()
  const { project, loadError, passcodeRequired, handlePasscodeSubmit } = useProjectAccess(projectId)
  const [selectedElement, setSelectedElement] = useState<IfcElementData | null>(null)
  // Tracks "the user tapped something and we're resolving it" --
  // deliberately separate from useIfcElementData's `loading` (the
  // whole-file background parse). Using the whole-file flag here would
  // show the data panel automatically on page load, before any tap.
  const [selecting, setSelecting] = useState(false)
  const [hiddenGlobalIds, setHiddenGlobalIds] = useState<Set<string>>(new Set())
  const [lightingPreset, setLightingPreset] = useState<LightingPreset>('daylight')
  // Which one of the corner panels (Levels/Categories/Lighting/Search/
  // BOQ) is open, at most one at a time -- previously each panel
  // tracked its own open state, so several could be open together,
  // which (combined with the panels' anchored-dropdown positioning) let
  // them visually overlap each other on a narrow screen. Owned here
  // instead of by each panel so opening one always closes whichever
  // other was open, matching how a normal menu bar behaves.
  const [openPanel, setOpenPanel] = useState<CornerPanelKey | null>(null)
  // BoqPanel portals its actual panel content here (see its own comment
  // for why) -- a state, not a plain ref, so the portal target is
  // available by the time anything tries to render into it.
  const [rootEl, setRootEl] = useState<HTMLDivElement | null>(null)

  // Derived from the URL on every render rather than its own state --
  // the ?model= param (if present and valid) picks the index directly;
  // no param, or one that doesn't match any of this project's models,
  // falls back to the first one. This is what lets selectModel() below
  // just update the URL and let the new index fall out of this
  // computation, instead of keeping two things (state + URL) in sync by
  // hand.
  const requestedModelId = searchParams.get('model')
  const selectedModelIndex = project
    ? Math.max(
        0,
        project.models.findIndex((model) => model.id === requestedModelId),
      )
    : 0
  const activeModel = project?.models[selectedModelIndex] ?? null
  const { getElementDataByGlobalId, levels, categories, getBoqDetails, loading: ifcLoading } = useIfcElementData(
    activeModel?.ifcUrl ?? null,
  )
  const viewerRef = useRef<ModelViewerHandle>(null)

  // Only starts once a project has actually, really loaded -- not while
  // still checking for a passcode gate or waiting on one to be entered,
  // so a view only ever gets recorded for someone who actually saw the
  // model. See docs/features/analytics-and-admin-dashboard.md.
  useProjectViewTracking(project?.id ?? null, activeModel?.id ?? null)

  // Switching models should drop any data panel left over from the
  // previous one -- otherwise a tap on model A's wall would stay on
  // screen describing model A after switching to model B. Updates the
  // URL (replace, not push -- switching models isn't its own
  // browser-history stop); selectedModelIndex above then falls out of
  // that on the next render, rather than being set here directly.
  function selectModel(index: number) {
    setSelectedElement(null)
    setHiddenGlobalIds(new Set())
    const model = project?.models[index]
    if (model) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.set('model', model.id)
          return next
        },
        { replace: true },
      )
    }
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
    <div className={styles.root} ref={setRootEl}>
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
      <button
        type="button"
        className={styles.recenterButton}
        onClick={() => viewerRef.current?.centerPivotOnCamera()}
        aria-label="Look around from here"
        title="Rotate around where you're standing, instead of around the room/model"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
        </svg>
      </button>
      <div className={styles.topRightCorner}>
        {/* Levels/Categories/Search/BOQ all wait for the same
            ifcLoading flag rather than each independently deciding
            they're ready the moment their own slice of IFC data shows
            up -- those slices don't all finish parsing at exactly the
            same instant, so rendering them individually as each one
            became ready made the button row visibly reflow/reshuffle
            for a moment on every load (a real bug the owner caught and
            screenshotted). Waiting for the whole parse to settle first
            means they all appear together, once, instead of trickling
            in one at a time. LightingPresetPanel doesn't depend on IFC
            data at all, so it stays outside this gate. */}
        {!ifcLoading && (
          <>
            <LevelsPanel
              levels={levels}
              onJumpTo={(globalIds) => viewerRef.current?.focusOnGlobalIds(globalIds)}
              open={openPanel === 'levels'}
              onOpenChange={(open) => setOpenPanel(open ? 'levels' : null)}
            />
            <CategoryPanel
              categories={categories}
              onHiddenGlobalIdsChange={setHiddenGlobalIds}
              open={openPanel === 'categories'}
              onOpenChange={(open) => setOpenPanel(open ? 'categories' : null)}
            />
          </>
        )}
        <LightingPresetPanel
          value={lightingPreset}
          onChange={setLightingPreset}
          open={openPanel === 'lighting'}
          onOpenChange={(open) => setOpenPanel(open ? 'lighting' : null)}
        />
        {!ifcLoading && (
          <>
            <SearchPanel
              levels={levels}
              categories={categories}
              onIsolate={setHiddenGlobalIds}
              onJumpTo={(globalIds) => viewerRef.current?.focusOnGlobalIds(globalIds)}
              open={openPanel === 'search'}
              onOpenChange={(open) => setOpenPanel(open ? 'search' : null)}
            />
            <BoqPanel
              categories={categories}
              getBoqDetails={getBoqDetails}
              onIsolate={setHiddenGlobalIds}
              onJumpTo={(globalIds) => viewerRef.current?.focusOnGlobalIds(globalIds)}
              portalContainer={rootEl}
              open={openPanel === 'boq'}
              onOpenChange={(open) => setOpenPanel(open ? 'boq' : null)}
            />
          </>
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
