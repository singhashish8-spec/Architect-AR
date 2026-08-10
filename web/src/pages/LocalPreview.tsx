import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ModelViewer, type ModelViewerHandle } from '../viewer/ModelViewer'
import { ElementDataPanel } from '../components/ElementDataPanel'
import { ScalePresetSelect } from '../components/ScalePresetSelect'
import { LevelsPanel } from '../components/LevelsPanel'
import { CategoryPanel } from '../components/CategoryPanel'
import { LightingPresetPanel } from '../components/LightingPresetPanel'
import { SearchPanel } from '../components/SearchPanel'
import { SchedulePanel } from '../components/SchedulePanel'
import { ConversionProgressBar } from '../components/ConversionProgressBar'
import { useIfcElementData } from '../ifc/useIfcElementData'
import { convertIfcToGlb, type ConversionProgress } from '../ifc/ifcToGlb'
import type { IfcElementData } from '../types/IfcElementData'
import type { ScalePreset } from '../types/ScalePreset'
import type { LightingPreset } from '../types/LightingPreset'
import type { CornerPanelKey } from '../types/CornerPanel'
import { getErrorMessage } from '../utils/errorMessage'
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
  const [hiddenGlobalIds, setHiddenGlobalIds] = useState<Set<string>>(new Set())
  const [conversionProgress, setConversionProgress] = useState<ConversionProgress | null>(null)
  const [conversionError, setConversionError] = useState<string | null>(null)
  const [lightingPreset, setLightingPreset] = useState<LightingPreset>('daylight')
  // Which one corner panel is open, at most one at a time -- see
  // ProjectView.tsx's matching comment.
  const [openPanel, setOpenPanel] = useState<CornerPanelKey | null>(null)
  // SchedulePanel portals its actual panel content here -- see its own
  // comment for why (the containing-block bug this fixes).
  const [viewerEl, setViewerEl] = useState<HTMLDivElement | null>(null)

  const { getElementDataByGlobalId, levels, categories, loading: ifcLoading } = useIfcElementData(ifcUrl)
  const viewerRef = useRef<ModelViewerHandle>(null)

  // Blob URLs must be revoked when no longer needed, or the browser keeps
  // the file data alive in memory for the life of the tab. setState calls
  // deferred into an async IIFE -- same react-hooks/set-state-in-effect
  // workaround used in ifc/useIfcElementData.ts.
  //
  // When only an IFC file is given (no GLB), there's nothing to point a
  // blob URL at yet -- build one ourselves from the IFC's own geometry
  // (ifc/ifcToGlb.ts) instead of requiring a separately-exported model
  // file. See docs/features/ifc-only-upload.md.
  useEffect(() => {
    if (modelFile) {
      const url = URL.createObjectURL(modelFile)
      ;(() => {
        setConversionProgress(null)
        setConversionError(null)
        setModelUrl(url)
      })()
      return () => URL.revokeObjectURL(url)
    }

    if (!ifcFile) {
      ;(() => {
        setModelUrl(null)
        setConversionProgress(null)
        setConversionError(null)
      })()
      return
    }

    let cancelled = false
    let generatedUrl: string | null = null

    void (async () => {
      setModelUrl(null)
      setConversionError(null)
      setConversionProgress({ phase: 'parsing', current: 0, total: 1 })
      try {
        const blob = await convertIfcToGlb(ifcFile, (progress) => {
          if (!cancelled) setConversionProgress(progress)
        })
        if (cancelled) return
        generatedUrl = URL.createObjectURL(blob)
        setModelUrl(generatedUrl)
      } catch (err) {
        if (!cancelled) {
          setConversionError(getErrorMessage(err, 'Could not build a 3D view from this IFC file.'))
        }
      } finally {
        if (!cancelled) setConversionProgress(null)
      }
    })()

    return () => {
      cancelled = true
      if (generatedUrl) URL.revokeObjectURL(generatedUrl)
    }
  }, [modelFile, ifcFile])

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
            Model file (glTF / GLB) — optional
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
            IFC file — required if no model file is given above; also enables tap-to-inspect
          </label>
          <input
            id="local-ifc-file"
            type="file"
            accept=".ifc"
            className={styles.fileInput}
            onChange={(event) => setIfcFile(event.target.files?.[0] ?? null)}
          />
          {!modelFile && ifcFile && (
            <p className={styles.subtitle}>
              No model file given — building a 3D view straight from this IFC file's own shapes.
              Materials will show as flat colors, not real textures, since IFC doesn't carry those.
            </p>
          )}
        </div>

        {conversionProgress && <ConversionProgressBar progress={conversionProgress} />}
        {conversionError && (
          <p role="alert" className={styles.error}>
            {conversionError}
          </p>
        )}

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
        <div className={styles.viewer} ref={setViewerEl}>
          <ModelViewer
            ref={viewerRef}
            modelUrl={modelUrl}
            scalePreset={scalePreset}
            onElementSelect={ifcUrl ? (id) => void handleElementSelect(id) : undefined}
            hiddenGlobalIds={hiddenGlobalIds}
            lightingPreset={lightingPreset}
          />
          <div className={styles.viewerTopRightCorner}>
            {/* See pages/ProjectView.tsx's matching comment -- waiting for
                the whole IFC parse to settle before showing any of these
                avoids the button row visibly reshuffling as each slice of
                data becomes ready at a slightly different moment. */}
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
                <SchedulePanel
                  categories={categories}
                  onIsolate={setHiddenGlobalIds}
                  onJumpTo={(globalIds) => viewerRef.current?.focusOnGlobalIds(globalIds)}
                  portalContainer={viewerEl}
                  open={openPanel === 'schedule'}
                  onOpenChange={(open) => setOpenPanel(open ? 'schedule' : null)}
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
      )}
    </main>
  )
}
