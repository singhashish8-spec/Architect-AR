import { useEffect, useState } from 'react'
import { getCompanyName } from '../services/companyService'

// Read-only lookup for client-facing pages (pages/BoqView.tsx,
// pages/ProjectView.tsx, pages/LocalPreview.tsx) -- the admin dashboard
// manages this value itself (pages/admin/AdminLayout.tsx, which also
// needs to write it, not just read it, so it calls the service
// directly instead of using this hook). Never throws: a lookup failure
// here just means the branding header falls back to "Architect AR"
// wherever it's shown, not a broken page.
export function useCompanyName(): string | null {
  const [companyName, setCompanyName] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getCompanyName()
      .then((name) => {
        if (!cancelled) setCompanyName(name)
      })
      .catch(() => {
        // Falls back to null (-> "Architect AR" wherever it's shown).
      })
    return () => {
      cancelled = true
    }
  }, [])

  return companyName
}
