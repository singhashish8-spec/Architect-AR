import { getSupabase } from './supabaseClient'
import type { NewProject, Project } from '../types/Project'
import type { ProjectModel } from '../types/ProjectModel'
import { isScalePreset } from '../types/ScalePreset'

// Only this module talks to Supabase directly -- see
// docs/engineering/folder-structure.md.

const MODEL_BUCKET = 'project-files'

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
    createdAt: row.created_at,
    models: row.models.map((model) => fromModelJson(row.id, model)),
  }
}

async function uploadFile(assetId: string, file: File): Promise<string> {
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

export async function createProject(project: NewProject): Promise<Project> {
  // Generate every id client-side and skip .select() after each insert.
  // Postgres RLS applies SELECT policies to a RETURNING clause too (which
  // is what .select() triggers) -- since there's deliberately no SELECT
  // policy for anon on either table (see schema.sql), .select() would
  // always come back with zero rows and .single() would throw, even
  // though the insert itself succeeded. Supplying ids ourselves means we
  // already have everything needed to build the Project without reading
  // anything back.
  const id = crypto.randomUUID()
  const createdAt = new Date().toISOString()

  const { error: projectError } = await getSupabase()
    .from('projects')
    .insert({ id, name: project.name, created_at: createdAt })
  if (projectError) throw projectError

  const models: ProjectModel[] = project.models.map((model) => ({
    id: crypto.randomUUID(),
    name: model.name,
    modelUrl: model.modelUrl,
    ifcUrl: model.ifcUrl,
    scalePreset: model.scalePreset,
  }))

  const { error: modelsError } = await getSupabase()
    .from('project_models')
    .insert(
      models.map((model, index) => ({
        id: model.id,
        project_id: id,
        name: model.name,
        model_url: model.modelUrl,
        ifc_url: model.ifcUrl,
        scale_preset: model.scalePreset,
        sort_order: index,
      })),
    )
  if (modelsError) throw modelsError

  return { id, createdAt, name: project.name, models }
}

export async function getProject(id: string): Promise<Project | null> {
  // Cast the whole response in one place rather than destructuring an
  // `any`-typed result -- without a generated Database type passed to
  // createClient(), supabase-js's rpc() return type isn't inferred.
  const result = (await getSupabase().rpc('get_project', { p_id: id })) as {
    data: ProjectRow[] | null
    error: Error | null
  }
  if (result.error) throw result.error
  const row = result.data?.[0]
  return row ? fromRow(row) : null
}
