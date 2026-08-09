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

// A model as managed from /admin (Phase 3) -- same shape as ProjectModel
// plus the short free-text note field admin_add_model()/
// admin_update_model() support. Kept separate from ProjectModel rather
// than adding `note` there, since the public viewer (ProjectView.tsx,
// LocalPreview.tsx) never needs or reads it.
export interface AdminProjectModel extends ProjectModel {
  note: string | null
}
