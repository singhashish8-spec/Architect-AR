import { getSupabase } from './supabaseClient'
import type { Project } from '../types/Project'
import type { ProjectModel } from '../types/ProjectModel'
import { isScalePreset } from '../types/ScalePreset'

// Only files under services/ talk to Supabase directly -- see
// docs/engineering/folder-structure.md.

// Exported for services/adminService.ts, which uploads/deletes/copies
// files in this same bucket for project and model management (Phase 3).
export const MODEL_BUCKET = 'project-files'

interface ProjectModelJson {
  id: string
  name: string
  modelUrl: string
  ifcUrl: string | null
  scalePreset: string
}

interface ProjectRow {
  id: string
  name: string
  description: string | null
  created_at: string
  models: ProjectModelJson[]
}

function fromModelJson(projectId: string, model: ProjectModelJson): ProjectModel {
  if (!isScalePreset(model.scalePreset)) {
    throw new Error(`Unknown scale preset "${model.scalePreset}" on project ${projectId}`)
  }
  return {
    id: model.id,
    name: model.name,
    modelUrl: model.modelUrl,
    ifcUrl: model.ifcUrl,
    scalePreset: model.scalePreset,
  }
}

function fromRow(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    createdAt: row.created_at,
    models: row.models.map((model) => fromModelJson(row.id, model)),
  }
}

// Exported for services/adminService.ts -- model/IFC files are still
// uploaded the same way whether the project is brand new or an existing
// one being edited.
export async function uploadFile(assetId: string, file: File): Promise<string> {
  const supabase = getSupabase()
  const path = `${assetId}/${file.name}`
  const { error } = await supabase.storage.from(MODEL_BUCKET).upload(path, file)
  if (error) throw error
  const { data } = supabase.storage.from(MODEL_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

export async function uploadModelFile(file: File): Promise<string> {
  return uploadFile(crypto.randomUUID(), file)
}

export async function uploadIfcFile(file: File): Promise<string> {
  return uploadFile(crypto.randomUUID(), file)
}

// A model/IFC url is always this bucket's own getPublicUrl() output --
// pulls the storage path back out of it so services/adminService.ts can
// delete or copy the underlying file (the Storage API needs the path,
// not the public url). Returns null for anything that isn't actually a
// url in this bucket (defensive -- shouldn't happen for data this app
// wrote itself, but a null return is a safer failure mode than deleting
// the wrong thing from a malformed split).
export function extractStoragePath(publicUrl: string): string | null {
  const marker = `/${MODEL_BUCKET}/`
  const index = publicUrl.indexOf(marker)
  if (index === -1) return null
  return publicUrl.slice(index + marker.length)
}

// Checked before ever calling getProject(), so a project with no passcode
// set loads exactly as before -- no gate, no extra round trip's worth of
// UI delay beyond this one cheap boolean lookup.
export async function projectRequiresPasscode(id: string): Promise<boolean> {
  const result = (await getSupabase().rpc('project_requires_passcode', { p_id: id })) as {
    data: boolean | null
    error: Error | null
  }
  if (result.error) throw result.error
  return result.data === true
}

export async function getProject(id: string, passcode?: string | null): Promise<Project | null> {
  // Cast the whole response in one place rather than destructuring an
  // `any`-typed result -- without a generated Database type passed to
  // createClient(), supabase-js's rpc() return type isn't inferred.
  const result = (await getSupabase().rpc('get_project', { p_id: id, p_passcode: passcode ?? null })) as {
    data: ProjectRow[] | null
    error: Error | null
  }
  if (result.error) throw result.error
  const row = result.data?.[0]
  return row ? fromRow(row) : null
}
