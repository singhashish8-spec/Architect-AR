import '@google/model-viewer'
import type { ScalePreset } from '../types/ScalePreset'
import { visualScale } from '../types/ScalePreset'

interface ARHandoffProps {
  modelUrl: string
  scalePreset: ScalePreset
  alt: string
}

// Wraps Google's <model-viewer> web component for the one-tap "View in
// AR" handoff to Scene Viewer (Android) / Quick Look (iOS). Deliberately
// a thin wrapper, not a custom AR implementation -- that's Phase 4's job.
// See docs/roadmap/architecture.md#frontend-and-viewer-architecture.
export function ARHandoff({ modelUrl, scalePreset, alt }: ARHandoffProps) {
  const scale = visualScale(scalePreset)

  return (
    <model-viewer
      src={modelUrl}
      alt={alt}
      ar
      ar-modes="scene-viewer quick-look"
      ar-scale="fixed"
      scale={`${scale} ${scale} ${scale}`}
      camera-controls
      style={{ width: '100%', height: '100%' }}
    />
  )
}
