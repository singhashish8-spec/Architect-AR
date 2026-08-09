import { useEffect } from 'react'
import { recordProjectView, updateProjectViewDuration } from '../services/analyticsService'

// Real-world "did the client open the link, how long did they look"
// numbers, only ever visible via the passcode-gated /admin dashboard --
// see docs/features/analytics-and-admin-dashboard.md.
const HEARTBEAT_INTERVAL_MS = 20_000

// Records one real page view once a project successfully loads (pass
// null while still loading or behind a passcode gate -- this only starts
// once there's a real project on screen to attribute a view to), then
// sends periodic duration updates while the tab stays open and visible.
// Best-effort throughout: a failure here should never be visible to
// whoever's actually looking at the model, so every call swallows its
// own errors rather than surfacing them.
export function useProjectViewTracking(projectId: string | null): void {
  useEffect(() => {
    if (!projectId) return

    let cancelled = false
    let viewId: string | null = null
    const startedAt = Date.now()

    void recordProjectView(projectId)
      .then((id) => {
        if (!cancelled) viewId = id
      })
      .catch(() => {
        // No project view was recorded -- nothing else depends on this,
        // so there's nothing more to do here.
      })

    const interval = setInterval(() => {
      if (!viewId || document.visibilityState !== 'visible') return
      const elapsedSeconds = (Date.now() - startedAt) / 1000
      void updateProjectViewDuration(viewId, elapsedSeconds).catch(() => {})
    }, HEARTBEAT_INTERVAL_MS)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [projectId])
}
