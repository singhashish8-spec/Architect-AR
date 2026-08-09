import styles from './BrandMark.module.css'

// Text-only stand-in for a real logo file -- the owner doesn't have a
// usable PNG/SVG yet (a blurry chat screenshot isn't one), so this
// renders the firm name/initials styled in their described navy/indigo
// instead of blocking on the file. Swap the markup here for a real
// <img> the moment a real logo file shows up; nothing else needs to
// change, since every caller already just renders <BrandMark />. Used
// only on the upload form and share card, per the owner's own scoping
// decision (never the 3D viewer itself) -- see
// docs/features/text-branding.md.
export function BrandMark() {
  return (
    <div className={styles.mark}>
      <span className={styles.initials}>HSA</span>
      <span className={styles.name}>Hiten Sethi &amp; Associates</span>
    </div>
  )
}
