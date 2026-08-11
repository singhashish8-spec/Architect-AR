import { getSupabase } from './supabaseClient'
import { MODEL_BUCKET, extractStoragePath } from './projectService'
import type { NewProject, ProjectStatus } from '../types/Project'
import type { AdminProjectModel, NewProjectModel } from '../types/ProjectModel'
import { isScalePreset } from '../types/ScalePreset'

// Only files under services/ talk to Supabase directly -- see
// docs/engineering/folder-structure.md. Split out from projectService.ts
// (public viewer reads) and analyticsService.ts (view tracking) since
// this is a distinct concern: the full admin management console (Phase 3
// -- see docs/features/full-admin-dashboard.md). Every write here goes
// through an admin_*() RPC that re-verifies p_passcode server-side --
// see web/supabase/schema.sql.

export interface AdminProject {
  id: string
  name: string
  description: string | null
  status: ProjectStatus
  createdAt: string
  hasPasscode: boolean
  models: AdminProjectModel[]
  viewCount: number
  lastViewedAt: string | null
  avgDurationSeconds: number | null
}

interface AdminModelJson {
  id: string
  name: string
  modelUrl: string
  ifcUrl: string | null
  scalePreset: string
  note: string | null
  createdAt: string
  viewCount: number
}

interface AdminProjectRow {
  project_id: string
  project_name: string
  description: string | null
  status: string
  created_at: string
  has_passcode: boolean
  models: AdminModelJson[]
  view_count: number
  last_viewed_at: string | null
  avg_duration_seconds: number | null
}

function fromModelJson(projectId: string, model: AdminModelJson): AdminProjectModel {
  if (!isScalePreset(model.scalePreset)) {
    throw new Error(`Unknown scale preset "${model.scalePreset}" on project ${projectId}`)
  }
  return {
    id: model.id,
    name: model.name,
    modelUrl: model.modelUrl,
    ifcUrl: model.ifcUrl,
    scalePreset: model.scalePreset,
    note: model.note,
    createdAt: model.createdAt,
    viewCount: model.viewCount,
  }
}

function isProjectStatus(value: string): value is ProjectStatus {
  return value === 'active' || value === 'sent_to_client' || value === 'archived'
}

function fromRow(row: AdminProjectRow): AdminProject {
  if (!isProjectStatus(row.status)) {
    throw new Error(`Unknown project status "${row.status}" on project ${row.project_id}`)
  }
  return {
    id: row.project_id,
    name: row.project_name,
    description: row.description,
    status: row.status,
    createdAt: row.created_at,
    hasPasscode: row.has_passcode,
    models: row.models.map((model) => fromModelJson(row.project_id, model)),
    viewCount: row.view_count,
    lastViewedAt: row.last_viewed_at,
    avgDurationSeconds: row.avg_duration_seconds,
  }
}

export async function listAdminProjects(passcode: string): Promise<AdminProject[]> {
  const result = (await getSupabase().rpc('get_admin_projects', { p_passcode: passcode })) as {
    data: AdminProjectRow[] | null
    error: Error | null
  }
  if (result.error) throw result.error
  return (result.data ?? []).map(fromRow)
}

export interface ProjectViewRecord {
  viewedAt: string
  durationSeconds: number | null
  modelId: string | null
  modelName: string | null
}

interface ProjectViewRow {
  viewed_at: string
  duration_seconds: number | null
  model_id: string | null
  model_name: string | null
}

// Raw per-visit rows behind get_admin_projects()'s own aggregated
// view_count/last_viewed_at/avg_duration_seconds -- used by the
// Analytics tab's chart, history table, and CSV export, none of which
// can be built from the aggregate alone. See migration 010.
export async function getProjectViewHistory(passcode: string, projectId: string, limit = 500): Promise<ProjectViewRecord[]> {
  const result = (await getSupabase().rpc('get_project_view_history', {
    p_admin_passcode: passcode,
    p_project_id: projectId,
    p_limit: limit,
  })) as { data: ProjectViewRow[] | null; error: Error | null }
  if (result.error) throw result.error
  return (result.data ?? []).map((row) => ({
    viewedAt: row.viewed_at,
    durationSeconds: row.duration_seconds,
    modelId: row.model_id,
    modelName: row.model_name,
  }))
}

export interface StorageUsage {
  usedBytes: number
  limitBytes: number
}

// Account-wide (one Storage bucket shared by every project), not
// per-project -- see migration 010's own comment for why this reads
// storage.objects directly instead of paginating the Storage list() API.
export async function getStorageUsage(passcode: string): Promise<StorageUsage> {
  const result = (await getSupabase().rpc('get_storage_usage', { p_admin_passcode: passcode })) as {
    data: { used_bytes: number; limit_bytes: number }[] | null
    error: Error | null
  }
  if (result.error) throw result.error
  const row = result.data?.[0]
  return { usedBytes: row?.used_bytes ?? 0, limitBytes: row?.limit_bytes ?? 0 }
}

export async function setStorageLimit(passcode: string, limitBytes: number): Promise<void> {
  const { error } = await getSupabase().rpc('admin_set_storage_limit', {
    p_admin_passcode: passcode,
    p_limit_bytes: limitBytes,
  })
  if (error) throw error
}

// Mirrors projectService.ts's old createProject(), now admin-gated --
// creates the project row, then adds each model one at a time (not a
// bulk insert) so admin_add_model()'s own sort_order-picking logic gives
// them a stable, predictable order matching the array order given here.
export async function createAdminProject(
  passcode: string,
  project: NewProject & { status?: ProjectStatus },
): Promise<string> {
  const id = crypto.randomUUID()
  const { error: projectError } = await getSupabase().rpc('admin_create_project', {
    p_admin_passcode: passcode,
    p_id: id,
    p_name: project.name,
    p_passcode: project.passcode || null,
    p_description: project.description || null,
    p_status: project.status ?? 'active',
  })
  if (projectError) throw projectError

  for (const model of project.models) {
    await addAdminModel(passcode, id, model)
  }

  return id
}

export async function updateAdminProjectDetails(
  passcode: string,
  id: string,
  fields: { name: string; description: string | null; status: ProjectStatus },
): Promise<void> {
  const { error } = await getSupabase().rpc('admin_update_project', {
    p_admin_passcode: passcode,
    p_id: id,
    p_name: fields.name,
    p_description: fields.description,
    p_status: fields.status,
  })
  if (error) throw error
}

// newPasscode null/blank removes the passcode -- the project link goes
// back to open-by-default.
export async function setAdminProjectPasscode(passcode: string, id: string, newPasscode: string | null): Promise<void> {
  const { error } = await getSupabase().rpc('admin_set_project_passcode', {
    p_admin_passcode: passcode,
    p_id: id,
    p_passcode: newPasscode || null,
  })
  if (error) throw error
}

// Removes the project's own uploaded files from Storage first (the
// Storage API, not raw SQL -- see admin_delete_project()'s comment in
// schema.sql for why), then deletes the database rows. If the Storage
// removal fails, the database delete never runs, so a retry starts from
// the same consistent state instead of half-deleting.
export async function deleteAdminProject(passcode: string, project: AdminProject): Promise<void> {
  await removeModelFiles(project.models)
  const { error } = await getSupabase().rpc('admin_delete_project', {
    p_admin_passcode: passcode,
    p_id: project.id,
  })
  if (error) throw error
}

// "Starting point for a similar one" -- copies the underlying model/IFC
// files to new Storage paths (not just re-pointing at the originals),
// so the duplicate stays intact even if the original project is deleted
// later. Passcode is deliberately NOT carried over (the admin only ever
// has the hash, never the plain text to copy) -- the duplicate starts
// open, same as any newly created project.
export async function duplicateAdminProject(passcode: string, project: AdminProject): Promise<string> {
  const newId = await createAdminProject(passcode, {
    name: `${project.name} (copy)`,
    description: project.description ?? undefined,
    status: 'active',
    models: [],
  })

  for (const model of project.models) {
    const modelUrl = await copyStorageFile(model.modelUrl)
    const ifcUrl = model.ifcUrl ? await copyStorageFile(model.ifcUrl) : null
    await addAdminModel(passcode, newId, {
      name: model.name,
      modelUrl,
      ifcUrl,
      scalePreset: model.scalePreset,
      note: model.note,
    })
  }

  return newId
}

export async function addAdminModel(
  passcode: string,
  projectId: string,
  model: NewProjectModel & { note?: string | null },
): Promise<void> {
  const { error } = await getSupabase().rpc('admin_add_model', {
    p_admin_passcode: passcode,
    p_id: crypto.randomUUID(),
    p_project_id: projectId,
    p_name: model.name,
    p_model_url: model.modelUrl,
    p_ifc_url: model.ifcUrl,
    p_scale_preset: model.scalePreset,
    p_note: model.note ?? null,
  })
  if (error) throw error
}

// createdAt/viewCount are server-derived and never sent to
// admin_update_model() (there's nothing for it to do with them) -- Omit
// rather than requiring callers to pass through values they aren't
// actually editing.
export async function updateAdminModel(
  passcode: string,
  model: Omit<AdminProjectModel, 'createdAt' | 'viewCount'>,
): Promise<void> {
  const { error } = await getSupabase().rpc('admin_update_model', {
    p_admin_passcode: passcode,
    p_model_id: model.id,
    p_name: model.name,
    p_model_url: model.modelUrl,
    p_ifc_url: model.ifcUrl,
    p_scale_preset: model.scalePreset,
    p_note: model.note,
  })
  if (error) throw error
}

// A project must always keep at least one model -- enforced in the
// admin UI (see pages/AdminDashboard.tsx), not here, since this
// function's own job is just "delete the one model given to it".
export async function deleteAdminModel(passcode: string, model: AdminProjectModel): Promise<void> {
  await removeModelFiles([model])
  const { error } = await getSupabase().rpc('admin_delete_model', {
    p_admin_passcode: passcode,
    p_model_id: model.id,
  })
  if (error) throw error
}

export async function reorderAdminModels(passcode: string, projectId: string, orderedIds: string[]): Promise<void> {
  const { error } = await getSupabase().rpc('admin_reorder_models', {
    p_admin_passcode: passcode,
    p_project_id: projectId,
    p_ordered_ids: orderedIds,
  })
  if (error) throw error
}

// Shared by deleteAdminProject/deleteAdminModel -- collects every real
// Storage path referenced by the given models (both the model file and,
// if present, the IFC file) and removes them in one batched call.
// extractStoragePath() returning null (shouldn't happen for urls this
// app wrote itself) is skipped rather than thrown on, so one malformed
// entry can't block deleting the rest.
async function removeModelFiles(models: AdminProjectModel[]): Promise<void> {
  const paths = models
    .flatMap((model) => [model.modelUrl, model.ifcUrl])
    .filter((url): url is string => url !== null)
    .map(extractStoragePath)
    .filter((path): path is string => path !== null)
  if (paths.length === 0) return
  const { error } = await getSupabase().storage.from(MODEL_BUCKET).remove(paths)
  if (error) throw error
}

// Copies a model/IFC file to a fresh Storage path (new random asset id,
// same filename) and returns its public url -- used by
// duplicateAdminProject() so a duplicate owns independent files rather
// than sharing the original's, which would break if the original is
// later deleted.
async function copyStorageFile(sourceUrl: string): Promise<string> {
  const sourcePath = extractStoragePath(sourceUrl)
  if (!sourcePath) throw new Error(`Could not determine the storage path for ${sourceUrl}`)
  const filename = sourcePath.split('/').pop() ?? sourcePath
  const destPath = `${crypto.randomUUID()}/${filename}`
  const supabase = getSupabase()
  const { error } = await supabase.storage.from(MODEL_BUCKET).copy(sourcePath, destPath)
  if (error) throw error
  const { data } = supabase.storage.from(MODEL_BUCKET).getPublicUrl(destPath)
  return data.publicUrl
}
