import type { NewProjectModel, ProjectModel } from './ProjectModel'

// Mirrors the `projects` table in web/supabase/schema.sql, joined with its
// `project_models` rows (see get_project() in that file). A project always
// has at least one model -- createProject() in services/projectService.ts
// requires it.
export interface Project {
  id: string
  name: string
  createdAt: string
  models: ProjectModel[]
}

// Fields the architect provides at upload time -- everything else
// (id, createdAt, each model's id) is assigned by the database.
export interface NewProject {
  name: string
  models: NewProjectModel[]
}
