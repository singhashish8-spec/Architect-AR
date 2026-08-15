import styles from './PipelineProgressBar.module.css'

// The one progress bar for the whole "convert then upload" pipeline --
// replaces what used to be three separate components (ConversionProgressBar,
// FbxConversionStatus, UploadProgressBar) that got mounted one after
// another. Showing three differently-styled bars in sequence read as
// unrelated processes and could flash more than one at once; this is
// always exactly one bar, whose label and fill just change as the real
// underlying stage changes -- see docs/features/large-file-storage.md and
// docs/features/fbx-upload.md.
//
// `percent` is 0-100, or `null` for a stage with no real progress data to
// show (IFC/FBX parsing and exporting never expose per-item counts the
// way IFC's own geometry-building loop does) -- rendered as an
// indeterminate sliding fill rather than a fabricated percentage.
// `detail` is an optional second line for stages that do have real
// numbers (e.g. "45.2 MB of 198.3 MB", or "142 of 300 elements").
export interface PipelineProgressBarProps {
  label: string
  percent: number | null
  detail?: string
}

export function PipelineProgressBar({ label, percent, detail }: PipelineProgressBarProps) {
  const indeterminate = percent === null
  const clamped = indeterminate ? 0 : Math.round(Math.min(100, Math.max(0, percent)))

  return (
    <div className={styles.wrapper} role="status" aria-live="polite">
      <p className={styles.label}>
        {label}
        {!indeterminate && ` (${clamped}%)`}
        {detail && ` — ${detail}`}
      </p>
      <div className={styles.track}>
        <div
          className={indeterminate ? styles.fillIndeterminate : styles.fill}
          style={indeterminate ? undefined : { width: `${clamped}%` }}
        />
      </div>
    </div>
  )
}
