import type { ConversionProgress } from '../ifc/ifcToGlb'
import type { FbxConversionProgress } from '../viewer/fbxToGlb'
import type { PipelineProgressBarProps } from '../components/PipelineProgressBar'
import { formatBytes } from './formatBytes'

// Turns each of the three real progress sources (IFC conversion, FBX
// conversion, R2 upload) into the one shape PipelineProgressBar actually
// renders -- kept here rather than inline in every upload form so
// ProjectCreateForm.tsx and AdminProjectModels.tsx's two forms don't each
// reimplement the same phase-label/percent mapping.

const IFC_PHASE_LABELS: Record<ConversionProgress['phase'], string> = {
  parsing: 'Reading IFC file…',
  geometry: 'Building 3D shapes…',
  exporting: 'Finishing conversion…',
}

export function ifcProgressToBar(progress: ConversionProgress): PipelineProgressBarProps {
  return {
    label: IFC_PHASE_LABELS[progress.phase],
    percent: progress.total > 0 ? (progress.current / progress.total) * 100 : null,
    detail: progress.total > 1 ? `${progress.current} of ${progress.total} elements` : undefined,
  }
}

const FBX_PHASE_LABELS: Record<FbxConversionProgress['phase'], string> = {
  parsing: 'Reading FBX file…',
  'loading textures': 'Loading materials and textures…',
  exporting: 'Finishing conversion…',
}

// FBXLoader never exposes real per-item counts (unlike IFC's own
// per-mesh loop) -- every phase is shown indeterminate, never a
// fabricated percentage. See docs/features/fbx-upload.md.
export function fbxProgressToBar(progress: FbxConversionProgress): PipelineProgressBarProps {
  return { label: FBX_PHASE_LABELS[progress.phase], percent: null }
}

export function uploadProgressToBar(label: string, loaded: number, total: number): PipelineProgressBarProps {
  return {
    label,
    percent: total > 0 ? (loaded / total) * 100 : 0,
    detail: `${formatBytes(loaded)} of ${formatBytes(total)}`,
  }
}
