// Optional override for the origin used when building shareable links
// (the admin Share tab, ProjectView's own share popup) -- without it,
// share links use window.location.origin, whatever host the app
// happens to be running on right now. On a Vercel preview deployment
// that's a URL embedding the branch name (and "vercel.app"), which
// isn't something worth a client seeing. Once a real custom domain is
// pointed at the production deployment, set VITE_PUBLIC_SITE_URL to it
// (e.g. "https://share.example.com") and every share link uses that
// instead, regardless of which URL admin itself is currently being
// viewed from. See docs/features/full-admin-dashboard.md.
export function getPublicOrigin(): string {
  const configured = import.meta.env.VITE_PUBLIC_SITE_URL
  if (configured) return configured.replace(/\/+$/, '')
  return window.location.origin
}
