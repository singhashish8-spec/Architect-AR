import { getSupabase } from './supabaseClient'

// Only files under services/ talk to Supabase directly -- see
// docs/engineering/folder-structure.md. Split out from projectService.ts
// since this is a distinct concern (view tracking + the admin dashboard),
// not project CRUD.

// Records one real page view and returns its id, so the caller can send
// periodic duration updates against the same row later (see
// updateProjectViewDuration below). The id is generated client-side, same
// pattern services/adminService.ts's write functions use -- project_views
// has no SELECT policy (see docs/features/analytics-and-admin-dashboard.md),
// so there's nothing to read back after inserting anyway.
//
// modelId is whichever model was active at the moment the view was
// recorded -- powers the admin Models tab's per-model view count (Phase
// 3). Optional/nullable since a view is still meaningful even without
// one (e.g. a project between models momentarily, or an older row from
// before this existed).
export async function recordProjectView(projectId: string, modelId: string | null = null): Promise<string> {
  const id = crypto.randomUUID()
  const { error } = await getSupabase()
    .from('project_views')
    .insert({ id, project_id: projectId, model_id: modelId })
  if (error) throw error
  return id
}

// Called periodically while the viewer tab stays open and visible (see
// pages/ProjectView.tsx) -- not a one-shot call on page close, since
// navigator.sendBeacon can't carry the auth headers a Supabase call
// needs. Best-effort: a failure here shouldn't interrupt anyone actually
// looking at the model, so callers should swallow errors rather than
// surface them.
export async function updateProjectViewDuration(viewId: string, durationSeconds: number): Promise<void> {
  const { error } = await getSupabase()
    .from('project_views')
    .update({ duration_seconds: Math.round(durationSeconds) })
    .eq('id', viewId)
  if (error) throw error
}

// The admin dashboard's own passcode gate calls this first, separately
// from services/adminService.ts's listAdminProjects() (Phase 3), for
// real "wrong passcode" feedback -- see pages/AdminDashboard.tsx.
export async function verifyAdminPasscode(passcode: string): Promise<boolean> {
  const result = (await getSupabase().rpc('verify_admin_passcode', { p_passcode: passcode })) as {
    data: boolean | null
    error: Error | null
  }
  if (result.error) throw result.error
  return result.data === true
}
