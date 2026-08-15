import styles from './BrandMark.module.css'

// Text-only stand-in for a real logo file -- the owner doesn't have a
// usable PNG/SVG yet (a blurry chat screenshot isn't one), so this
// renders the firm name/initials styled in their described navy/indigo
// instead of blocking on the file. Swap the markup here for a real
// <img> the moment a real logo file shows up; nothing else needs to
// change, since every caller already just renders <BrandMark />. Used on
// the share card and, as of 2026-08-15, every page's permanent header
// (components/BrandingHeader.tsx) -- the owner's own ask, having seen
// the header showing the generic "Architect AR" text fallback instead
// of this mark: "I want header to look like the one in share card...
// Not that Architect Ar." See docs/features/text-branding.md.
export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? `${styles.mark} ${styles.compact}` : styles.mark}>
      <span className={styles.initials}>HSA</span>
      <span className={styles.name}>Hiten Sethi &amp; Associates</span>
    </div>
  )
}
