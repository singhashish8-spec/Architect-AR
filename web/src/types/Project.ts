import type { NewProjectModel, ProjectModel } from './ProjectModel'

// Mirrors the `projects` table in web/supabase/schema.sql, joined with its
// `project_models` rows (see get_project() in that file). A project always
// has at least one model -- admin_create_project() in
// services/adminService.ts requires it.
export interface Project {
  id: string
  name: string
  // Optional free-text blurb the architect can fill in at upload time --
  // shown on the share card (QR + link + this text) alongside the
  // project name. Null when none was given. See
  // docs/features/project-share-card.md.
  description: string | null
  createdAt: string
  models: ProjectModel[]
}

// Organizing tag shown in /admin (Phase 3) -- purely presentational,
// doesn't affect who can view a project's own link. Mirrors the check
// constraint on `projects.status` in web/supabase/schema.sql.
export type ProjectStatus = 'active' | 'sent_to_client' | 'archived'

// Fields the architect provides when creating a project from /admin --
// everything else (id, createdAt, each model's id) is assigned by the
// database. See services/adminService.ts.
export interface NewProject {
  name: string
  models: NewProjectModel[]
  // Optional passcode gating the shareable link. Hashed server-side by
  // admin_create_project() in web/supabase/schema.sql -- the plain text
  // never gets stored, and this value never comes back out of
  // getProject(). Undefined/blank means no passcode (open-by-default).
  passcode?: string
  // Optional -- see Project.description above.
  description?: string
}
