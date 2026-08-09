import type { ScalePreset } from './ScalePreset'

// One model within a project (Phase 2: a project can hold several --
// different rooms, or design options A/B -- all reachable from the same
// shareable link). Mirrors a row of `project_models` in
// web/supabase/schema.sql.
export interface ProjectModel {
  id: string
  name: string
  modelUrl: string
  ifcUrl: string | null
  scalePreset: ScalePreset
}

// Fields the architect provides at upload time for one model -- id is
// assigned by the database.
export interface NewProjectModel {
  name: string
  modelUrl: string
  ifcUrl: string | null
  scalePreset: ScalePreset
}
