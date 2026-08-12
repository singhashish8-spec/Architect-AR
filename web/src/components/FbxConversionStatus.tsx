import type { FbxConversionProgress } from '../viewer/fbxToGlb'
import styles from './FbxConversionStatus.module.css'

// The FBX counterpart to ConversionProgressBar.tsx (IFC's own) --
// separate component rather than a shared one since the two report
// genuinely different things: IFC's own conversion knows real per-mesh
// counts as it goes, FBXLoader doesn't expose anything like that, so
// this only ever has three named phases to show, with an indeterminate
// (not percent) fill.
const PHASE_LABELS: Record<FbxConversionProgress['phase'], string> = {
  parsing: 'Reading FBX file…',
  'loading textures': 'Loading materials and textures…',
  exporting: 'Finishing up…',
}

export function FbxConversionStatus({ progress }: { progress: FbxConversionProgress }) {
  return (
    <div className={styles.wrapper} role="status" aria-live="polite">
      <p className={styles.label}>{PHASE_LABELS[progress.phase]}</p>
      <div className={styles.track}>
        <div className={styles.fill} />
      </div>
    </div>
  )
}
