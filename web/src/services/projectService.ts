import { getSupabase } from './supabaseClient'
import { uploadToR2 } from './r2Service'
import type { Project } from '../types/Project'
import type { ProjectModel } from '../types/ProjectModel'
import { isScalePreset } from '../types/ScalePreset'

// Only files under services/ talk to Supabase (or R2) directly -- see
// docs/engineering/folder-structure.md.

// Exported for services/adminService.ts, which still needs this to
// delete/copy files uploaded before 2026-08-12 (see extractStorageRef()
// below) -- every *new* upload goes to R2 instead (see
// docs/features/large-file-storage.md), since Supabase's Free plan caps
// every upload at a fixed, non-configurable 50 MB, well under what a
// real IFC export needs.
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

// Model/IFC files now upload to R2 (see services/r2Service.ts), not
// Supabase Storage -- kept as one function (rather than inlining
// uploadToR2() at each call site) so callers don't need to know or care
// which storage backend is actually behind it.
export async function uploadModelFile(file: File): Promise<string> {
  return uploadToR2(file)
}

export async function uploadIfcFile(file: File): Promise<string> {
  return uploadToR2(file)
}

export type StorageProvider = 'supabase' | 'r2'

export interface StorageRef {
  provider: StorageProvider
  // Supabase's own Storage path, or an R2 object key -- same shape
  // either way ("<uuid>/<filename>"), just needed by a different API
  // depending on which provider actually holds the file.
  path: string
}

// A model/IFC url this app wrote itself is always either Supabase
// Storage's own getPublicUrl() output (every file uploaded before
// 2026-08-12) or R2's public-bucket URL (every file uploaded since --
// see services/r2Service.ts). services/adminService.ts's delete/copy
// need to know which, since each provider needs its own API call. No
// project ever stores a mix of markers to detect against for R2 (unlike
// Supabase's own `/project-files/` path segment) -- R2's public base
// URL is only known server-side (api/_lib/r2.ts's R2_PUBLIC_URL), so
// this treats "not a Supabase Storage url" as "must be R2" rather than
// pattern-matching a second known prefix. Returns null only for a url
// that isn't in this bucket at all (defensive -- shouldn't happen for
// data this app wrote itself, but a null return is a safer failure mode
// than deleting or copying the wrong thing from a malformed split).
export function extractStorageRef(url: string): StorageRef | null {
  const supabaseMarker = `/${MODEL_BUCKET}/`
  const supabaseIndex = url.indexOf(supabaseMarker)
  if (supabaseIndex !== -1) {
    return { provider: 'supabase', path: url.slice(supabaseIndex + supabaseMarker.length) }
  }

  if (!/^https?:\/\//.test(url)) return null
  const afterHost = url.replace(/^https?:\/\/[^/]+\//, '')
  if (!afterHost || afterHost === url) return null
  return { provider: 'r2', path: afterHost }
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
