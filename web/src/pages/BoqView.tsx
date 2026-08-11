import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { PasscodeGate } from '../components/PasscodeGate'
import { BoqContent } from '../components/BoqContent'
import { useIfcElementData } from '../ifc/useIfcElementData'
import { useProjectAccess } from '../hooks/useProjectAccess'
import type { BoqElementDetail, BoqDebugSample } from '../ifc/ifcBoqDetails'
import { getErrorMessage } from '../utils/errorMessage'
import styles from './BoqView.module.css'

// The BOQ, reachable without ever opening the 3D viewer -- what the
// admin Models tab's "BOQ" link now points to, instead of deep-linking
// into pages/ProjectView.tsx with the panel pre-opened (the original
// version of this feature). The owner's own correction, 2026-08-11:
// clicking it shouldn't load the 3D model at all, just go straight to
// the quantities. Since useIfcElementData() only ever needs the
// model's *IFC* url, this page genuinely never touches the GLB/Three.js
// pipeline -- not just visually simpler, actually lighter to load. See
// docs/features/boq.md.
export function BoqView() {
  const { projectId } = useParams<{ projectId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const { project, loadError, passcodeRequired, handlePasscodeSubmit } = useProjectAccess(projectId)

  const requestedModelId = searchParams.get('model')
  const selectedModelIndex = project
    ? Math.max(
        0,
        project.models.findIndex((model) => model.id === requestedModelId),
      )
    : 0
  const activeModel = project?.models[selectedModelIndex] ?? null

  const { getBoqDetails, loading: ifcLoading } = useIfcElementData(activeModel?.ifcUrl ?? null)

  const [details, setDetails] = useState<BoqElementDetail[] | null>(null)
  const [debugSample, setDebugSample] = useState<BoqDebugSample | null>(null)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // Unconditionally fetches once the IFC parse is ready -- unlike
  // BoqPanel's own lazy load-on-open, this entire page's only reason to
  // exist IS the BOQ, so there's no "wait until someone actually asks
  // for it" step here.
  useEffect(() => {
    if (!activeModel?.ifcUrl || ifcLoading) return
    let cancelled = false

    void (async () => {
      setDetails(null)
      setFetchError(null)
      try {
        const result = await getBoqDetails((done, total) => {
          if (!cancelled) setProgress({ done, total })
        })
        if (!cancelled) {
          setDetails(result.details)
          setDebugSample(result.debugSample)
        }
      } catch (err) {
        if (!cancelled) setFetchError(getErrorMessage(err, 'Could not load quantities for this model.'))
      }
    })()

    return () => {
      cancelled = true
    }
  }, [activeModel?.ifcUrl, ifcLoading, getBoqDetails])

  function selectModel(index: number) {
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

  if (loadError)
    return (
      <p role="alert" className={styles.status}>
        {loadError}
      </p>
    )
  if (passcodeRequired === null) return <p className={styles.status}>Loading…</p>
  if (passcodeRequired && !project) {
    return (
      <PasscodeGate
        onSubmit={handlePasscodeSubmit}
        description="This project is protected. Ask whoever shared this link for the passcode."
        submitLabel="View BOQ"
      />
    )
  }
  if (!project || !activeModel) return <p className={styles.status}>Loading…</p>

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div>
            <p className={styles.eyebrow}>{project.name}</p>
            <h1 className={styles.title}>Bill of Quantities</h1>
          </div>
          <Link to={`/p/${project.id}?model=${activeModel.id}`} className={styles.viewerLink}>
            Open 3D viewer →
          </Link>
        </div>

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

        {activeModel.ifcUrl ? (
          <BoqContent
            details={details}
            progress={progress}
            error={fetchError}
            csvFileName={`${project.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-boq.csv`}
            debugSample={debugSample}
          />
        ) : (
          <p className={styles.status}>"{activeModel.name}" doesn't have an IFC file attached, so there's no BOQ data for it.</p>
        )}
      </div>
    </main>
  )
}
