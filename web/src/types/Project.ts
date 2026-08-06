import type { ScalePreset } from './ScalePreset'

// Mirrors the `projects` table in web/supabase/schema.sql.
export interface Project {
  id: string
  name: string
  modelUrl: string
  ifcUrl: string | null
  scalePreset: ScalePreset
  createdAt: string
}

// Fields the architect provides at upload time -- everything else
// (id, createdAt) is assigned by the database.
export interface NewProject {
  name: string
  modelUrl: string
  ifcUrl: string | null
  scalePreset: ScalePreset
}
