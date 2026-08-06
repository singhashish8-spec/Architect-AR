import { supabase } from './supabaseClient'
import type { NewProject, Project } from '../types/Project'
import { isScalePreset } from '../types/ScalePreset'

// Only this module talks to Supabase directly -- see
// docs/engineering/folder-structure.md.

const MODEL_BUCKET = 'project-files'

interface ProjectRow {
  id: string
  name: string
  model_url: string
  ifc_url: string | null
  scale_preset: string
  created_at: string
}

function fromRow(row: ProjectRow): Project {
  if (!isScalePreset(row.scale_preset)) {
    throw new Error(`Unknown scale preset "${row.scale_preset}" on project ${row.id}`)
  }
  return {
    id: row.id,
    name: row.name,
    modelUrl: row.model_url,
    ifcUrl: row.ifc_url,
    scalePreset: row.scale_preset,
    createdAt: row.created_at,
  }
}

async function uploadFile(assetId: string, file: File): Promise<string> {
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

export async function createProject(project: NewProject): Promise<Project> {
  const { data, error } = await supabase
    .from('projects')
    .insert({
      name: project.name,
      model_url: project.modelUrl,
      ifc_url: project.ifcUrl,
      scale_preset: project.scalePreset,
    })
    .select()
    .single<ProjectRow>()

  if (error) throw error
  return fromRow(data)
}

export async function getProject(id: string): Promise<Project | null> {
  // Cast the whole response in one place rather than destructuring an
  // `any`-typed result -- without a generated Database type passed to
  // createClient(), supabase-js's rpc() return type isn't inferred.
  const result = (await supabase.rpc('get_project', { p_id: id })) as {
    data: ProjectRow[] | null
    error: Error | null
  }
  if (result.error) throw result.error
  const row = result.data?.[0]
  return row ? fromRow(row) : null
}
