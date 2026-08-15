import styles from './ConversionProgressBar.module.css'

// A large model/IFC file now uploads to R2 in multiple independently-
// retried chunks (see services/r2Service.ts) specifically so a dropped
// connection partway through doesn't have to restart from zero -- but
// that only actually helps if someone waiting can see it's still making
// progress rather than assuming the page has frozen, the same reasoning
// ConversionProgressBar was built on. `fraction` is 0..1; only rendered
// while a large-enough file is actually uploading (small files upload in
// one PUT with nothing meaningful to report partway through).
export function UploadProgressBar({ fraction, label = 'Uploading…' }: { fraction: number; label?: string }) {
  const percent = Math.round(Math.min(1, Math.max(0, fraction)) * 100)

  return (
    <div className={styles.wrapper} role="status" aria-live="polite">
      <p className={styles.label}>
        {label} ({percent}%)
      </p>
      <div className={styles.track}>
        <div className={styles.fill} style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}
