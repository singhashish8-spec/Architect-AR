import { BrandMark } from './BrandMark'
import styles from './BrandingHeader.module.css'

// Permanent header for every non-admin page -- the admin dashboard has
// its own separate editable version (pages/admin/AdminLayout.tsx's
// CompanyBrandBar, which manages the account-wide `company_name` used
// in the Quantity Takeoff/Excel export, a different thing from this).
// This is the owner's own explicit ask, 2026-08-15: "any page I go I
// see that... anything we built in past and anything we will build in
// future... every page to have that header" -- resolving what had been
// an open question (see docs/roadmap/decisions.md) about whether the
// full-screen 3D viewer specifically should carry it too. It now does.
//
// Renders BrandMark (the firm's own navy/indigo "HSA" mark, previously
// only on the share card) rather than the plain `company_name` text --
// a follow-up correction the same day, after the owner saw the generic
// "Architect AR" fallback text and asked for this to "look like the one
// in share card... Not that Architect Ar."
//
// Two variants for two kinds of page:
// - 'bar': a full-width sticky top bar, for ordinary document-flow pages
//   (pages/BoqView.tsx, pages/LocalPreview.tsx).
// - 'overlay': a small pill anchored to a corner, for a full-screen
//   immersive page with no header slot to push content down from
//   (pages/ProjectView.tsx) -- matches that page's own corner-overlay
//   conventions (ProjectView.module.css's .topRightCorner/.modelSwitcher).
interface BrandingHeaderProps {
  variant?: 'bar' | 'overlay'
  // Escape hatch for a page with its own deliberately fixed, non-theme-
  // reactive look (pages/BoqView.tsx's .brand -- hardcoded dark to match
  // components/BoqContent.module.css's always-dark styling, documented
  // in BoqView.module.css). When given, this fully replaces the
  // variant's own default class rather than layering on top of it, so
  // the caller owns the visual treatment.
  className?: string
}

export function BrandingHeader({ variant = 'bar', className }: BrandingHeaderProps) {
  return (
    <div className={className ?? (variant === 'overlay' ? styles.overlay : styles.bar)}>
      <BrandMark compact />
    </div>
  )
}
