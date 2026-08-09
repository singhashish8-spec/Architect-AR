import { getSupabase } from './supabaseClient'

// Only files under services/ talk to Supabase directly -- see
// docs/engineering/folder-structure.md. Split out from projectService.ts
// since this is a distinct concern (view tracking + the admin dashboard),
// not project CRUD.

// Records one real page view and returns its id, so the caller can send
// periodic duration updates against the same row later (see
// updateProjectViewDuration below). The id is generated client-side, same
// pattern createProject() uses -- project_views has no SELECT policy (see
// docs/features/analytics-and-admin-dashboard.md), so there's nothing to
// read back after inserting anyway.
export async function recordProjectView(projectId: string): Promise<string> {
  const id = crypto.randomUUID()
  const { error } = await getSupabase().from('project_views').insert({ id, project_id: projectId })
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

export async function verifyAdminPasscode(passcode: string): Promise<boolean> {
  const result = (await getSupabase().rpc('verify_admin_passcode', { p_passcode: passcode })) as {
    data: boolean | null
    error: Error | null
  }
  if (result.error) throw result.error
  return result.data === true
}

export interface AdminProjectStats {
  projectId: string
  projectName: string
  createdAt: string
  viewCount: number
  lastViewedAt: string | null
  avgDurationSeconds: number | null
}

interface AdminStatsRow {
  project_id: string
  project_name: string
  created_at: string
  view_count: number
  last_viewed_at: string | null
  avg_duration_seconds: number | null
}

// Empty (not an error) if the passcode is wrong -- callers should verify
// with verifyAdminPasscode() first for real "wrong passcode" feedback
// rather than reading that from an empty list here, which is
// indistinguishable from "correct passcode, zero projects yet".
export async function getAdminStats(passcode: string): Promise<AdminProjectStats[]> {
  const result = (await getSupabase().rpc('get_admin_stats', { p_passcode: passcode })) as {
    data: AdminStatsRow[] | null
    error: Error | null
  }
  if (result.error) throw result.error
  return (result.data ?? []).map((row) => ({
    projectId: row.project_id,
    projectName: row.project_name,
    createdAt: row.created_at,
    viewCount: row.view_count,
    lastViewedAt: row.last_viewed_at,
    avgDurationSeconds: row.avg_duration_seconds,
  }))
}
