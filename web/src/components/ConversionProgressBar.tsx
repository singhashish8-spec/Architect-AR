import type { ConversionProgress } from '../ifc/ifcToGlb'
import styles from './ConversionProgressBar.module.css'

// Converting a real building's worth of IFC geometry can take a
// noticeable moment -- shown with real, per-mesh progress (not a fake
// spinner) so someone waiting doesn't assume the page has frozen. See
// docs/features/ifc-only-upload.md.
const PHASE_LABELS: Record<ConversionProgress['phase'], string> = {
  parsing: 'Reading IFC file…',
  geometry: 'Building 3D shapes…',
  exporting: 'Finishing up…',
}

export function ConversionProgressBar({ progress }: { progress: ConversionProgress }) {
  const percent = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0

  return (
    <div className={styles.wrapper} role="status" aria-live="polite">
      <p className={styles.label}>
        {PHASE_LABELS[progress.phase]}
        {progress.total > 1 && ` (${progress.current} of ${progress.total})`}
      </p>
      <div className={styles.track}>
        <div className={styles.fill} style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}
