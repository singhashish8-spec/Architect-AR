import { useCompanyName } from '../hooks/useCompanyName'
import styles from './BrandingHeader.module.css'

// Read-only company-name display for every non-admin page -- the admin
// dashboard has its own editable version (pages/admin/AdminLayout.tsx's
// CompanyBrandBar, which also needs to write the value, not just read
// it). This is the owner's own explicit ask, 2026-08-15: "any page I go
// I see that... anything we built in past and anything we will build in
// future... every page to have that header" -- resolving what had been
// an open question (see docs/roadmap/decisions.md) about whether the
// full-screen 3D viewer specifically should carry it too. It now does.
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
  // reactive look (pages/BoqView.tsx's .brand -- hardcoded white-on-dark
  // to match components/BoqContent.module.css's always-dark styling,
  // documented in BoqView.module.css). When given, this fully replaces
  // the variant's own default class rather than layering on top of it,
  // so the caller owns the visual treatment; the company-name lookup and
  // "Architect AR" fallback stay shared either way.
  className?: string
}

export function BrandingHeader({ variant = 'bar', className }: BrandingHeaderProps) {
  const companyName = useCompanyName()

  return (
    <div className={className ?? (variant === 'overlay' ? styles.overlay : styles.bar)}>
      <span className={styles.name}>{companyName || 'Architect AR'}</span>
    </div>
  )
}
