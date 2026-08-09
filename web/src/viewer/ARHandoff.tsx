import { useRef } from 'react'
import '@google/model-viewer'
import type { ModelViewerElement } from '@google/model-viewer'
import type { ScalePreset } from '../types/ScalePreset'
import { visualScale } from '../types/ScalePreset'
import styles from './ARHandoff.module.css'

interface ARHandoffProps {
  modelUrl: string
  scalePreset: ScalePreset
  alt: string
}

// Wraps Google's <model-viewer> web component for the one-tap "View in
// AR" handoff to Scene Viewer (Android) / Quick Look (iOS). Deliberately
// a thin wrapper, not a custom AR implementation -- that's Phase 4's job.
// See docs/roadmap/architecture.md#frontend-and-viewer-architecture.
//
// <model-viewer> renders its own full 3D scene wherever it's mounted --
// earlier this component sized that scene to fill the visible button
// itself, which meant a second, redundant render of the whole model sat
// on screen next to the real viewer. It's kept mounted (off-screen, not
// display:none, since some browsers pause a display:none element's
// rendering loop and model-viewer needs to actually load and stay ready
// to hand off) purely so its activateAR() method can be called -- the
// visible control is our own styled button.
export function ARHandoff({ modelUrl, scalePreset, alt }: ARHandoffProps) {
  const scale = visualScale(scalePreset)
  const viewerRef = useRef<ModelViewerElement>(null)

  return (
    <>
      <model-viewer
        ref={viewerRef}
        src={modelUrl}
        alt={alt}
        ar
        ar-modes="scene-viewer quick-look"
        ar-scale="fixed"
        scale={`${scale} ${scale} ${scale}`}
        className={styles.hiddenViewer}
      />
      <button
        type="button"
        className={styles.button}
        onClick={() => void viewerRef.current?.activateAR()}
      >
        <svg
          className={styles.icon}
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
          <path d="M12 2 3 7v10l9 5 9-5V7l-9-5Z" />
          <path d="M3 7l9 5 9-5" />
          <path d="M12 12v10" />
        </svg>
        View in AR
      </button>
    </>
  )
}
