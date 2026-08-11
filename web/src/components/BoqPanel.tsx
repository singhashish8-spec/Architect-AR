import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ElementCategory } from '../ifc/ifcCategories'
import type { BoqElementDetail, BoqDebugSample, BoqDetailsResult } from '../ifc/ifcBoqDetails'
import { BoqContent } from './BoqContent'
import { getErrorMessage } from '../utils/errorMessage'
import styles from './BoqPanel.module.css'
import labelStyles from '../styles/responsiveLabel.module.css'

interface BoqPanelProps {
  // Just used for the early "is there anything to show at all" check --
  // the real detailed data comes from getBoqDetails() below, fetched
  // lazily once this panel is actually opened. Same categories the old
  // Schedule panel took directly.
  categories: ElementCategory[]
  getBoqDetails: (onProgress?: (done: number, total: number) => void) => Promise<BoqDetailsResult>
  debugBoqElement: (expressId: number, elementName: string) => Promise<BoqDebugSample | null>
  // Only used to label the Excel export's title block -- optional since
  // pages/LocalPreview.tsx has no real project to name.
  projectName?: string
  modelName?: string
  onIsolate: (hiddenGlobalIds: Set<string>) => void
  onJumpTo: (globalIds: string[]) => void
  // See SchedulePanel's original comment on this prop (same containing-
  // block bug this panel would otherwise inherit) -- BoqPanel replaces
  // SchedulePanel outright, portalContainer included.
  portalContainer: HTMLElement | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

// The corner-button entry point into the BOQ while looking at the 3D
// model -- toggle button + the portaled slide-in shell (same
// containing-block fix SchedulePanel needed, see its own history in
// docs/features/search-and-schedule.md). All the actual content (the
// Discipline/Category tree, search, CSV export) lives in
// components/BoqContent.tsx, shared with the standalone
// pages/BoqView.tsx page the admin Models tab's "BOQ" link opens
// instead of this overlay -- see docs/features/boq.md.
export function BoqPanel({
  categories,
  getBoqDetails,
  debugBoqElement,
  projectName,
  modelName,
  onIsolate,
  onJumpTo,
  portalContainer,
  open,
  onOpenChange,
}: BoqPanelProps) {
  const [details, setDetails] = useState<BoqElementDetail[] | null>(null)
  const [debugSample, setDebugSample] = useState<BoqDebugSample | null>(null)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Lazy: only actually fetches once the panel is opened for the first
  // time, not on every model load -- see useIfcElementData.ts's
  // getBoqDetails() for why (two extra WASM calls per element).
  useEffect(() => {
    if (!open || details !== null) return
    let cancelled = false

    void (async () => {
      setError(null)
      try {
        const result = await getBoqDetails((done, total) => {
          if (!cancelled) setProgress({ done, total })
        })
        if (!cancelled) {
          setDetails(result.details)
          setDebugSample(result.debugSample)
        }
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err, 'Could not load quantities for this model.'))
      }
    })()

    return () => {
      cancelled = true
    }
  }, [open, details, getBoqDetails])

  if (categories.length === 0) return null

  return (
    <>
      <button
        type="button"
        className={styles.toggle}
        onClick={() => onOpenChange(!open)}
        aria-label={open ? 'Hide Quantity Takeoff' : 'Quantity Takeoff'}
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
          <path d="M9 2h6l1 3H8l1-3z" />
          <path d="M4 7h16l-1 14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1L4 7z" />
          <line x1="9" y1="11" x2="15" y2="11" />
          <line x1="9" y1="15" x2="15" y2="15" />
        </svg>
        <span className={labelStyles.label}>{open ? 'Hide Quantity Takeoff' : 'Quantity Takeoff'}</span>
      </button>
      {open &&
        portalContainer &&
        createPortal(
          <aside className={styles.panel}>
            <button type="button" className={styles.closeButton} onClick={() => onOpenChange(false)} aria-label="Close">
              ×
            </button>
            <h2 className={styles.title}>Quantity Takeoff</h2>
            <BoqContent
              details={details}
              progress={progress}
              error={error}
              csvFileName="quantity-takeoff.csv"
              projectName={projectName}
              modelName={modelName}
              debugSample={debugSample}
              debugBoqElement={debugBoqElement}
              onIsolate={onIsolate}
              onJumpTo={onJumpTo}
            />
          </aside>,
          portalContainer,
        )}
    </>
  )
}
