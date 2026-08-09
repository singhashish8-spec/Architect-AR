-- Architect AR — Supabase schema
-- Run once via the Supabase SQL editor. See docs/engineering/build-sequence.md
-- step 12, docs/features/model-scale-presets.md, and
-- docs/features/multiple-models-per-project.md for context.
--
-- Security note (read before running): this schema deliberately does NOT
-- grant the `anon` role a general SELECT policy on `projects` or
-- `project_models` — a permissive policy would let anyone with the public
-- anon key list every project via the auto-generated REST API, defeating
-- the "unlisted link" sharing model (docs/roadmap/architecture.md#sharing-model).
-- Instead, reads go through get_project(), a SECURITY DEFINER function
-- that only returns a row when the caller already knows its id.
--
-- Known Phase 1 gap, not an oversight: INSERT is currently open to the
-- anon role on both tables (no architect login exists yet — auth isn't in
-- scope until it's tracked in docs/roadmap/decisions.md). Anyone holding
-- the public anon key could create junk projects. This must be closed
-- with real auth before any public launch.

create extension if not exists "pgcrypto";

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

alter table projects enable row level security;

create policy "anon can insert projects"
  on projects for insert
  to anon
  with check (true);

-- One project can hold multiple models (Phase 2) -- e.g. different rooms,
-- or design options A/B, all reachable from the same shareable link. See
-- docs/features/multiple-models-per-project.md.
create table if not exists project_models (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  model_url text not null,
  ifc_url text,
  scale_preset text not null check (
    scale_preset in ('1:1', '1:5', '1:10', '1:20', '1:50', '1:100', '1:200', '1:500', '1:1000')
  ),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table project_models enable row level security;

create policy "anon can insert project_models"
  on project_models for insert
  to anon
  with check (true);

-- Deliberately no SELECT policy on either table above -- reads go through
-- get_project(), which returns a project together with its models in one
-- call (as a jsonb array, already shaped to match services/projectService.ts's
-- camelCase mapping) rather than needing a second round-trip per model.
create or replace function get_project(p_id uuid)
returns table (
  id uuid,
  name text,
  created_at timestamptz,
  models jsonb
)
language sql
security definer
set search_path = public
as $$
  select
    p.id,
    p.name,
    p.created_at,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', pm.id,
          'name', pm.name,
          'modelUrl', pm.model_url,
          'ifcUrl', pm.ifc_url,
          'scalePreset', pm.scale_preset
        )
        order by pm.sort_order, pm.created_at
      ) filter (where pm.id is not null),
      '[]'::jsonb
    ) as models
  from projects p
  left join project_models pm on pm.project_id = p.id
  where p.id = p_id
  group by p.id;
$$;

grant execute on function get_project(uuid) to anon;

-- Storage bucket for uploaded model/IFC files (services/projectService.ts's
-- MODEL_BUCKET constant -- keep these in sync if either changes).
-- `public = true` makes uploaded files readable via their public URL
-- (getPublicUrl()) without needing a separate SELECT policy -- Supabase's
-- public-bucket flag governs the public URL route directly. It does NOT
-- grant listing a bucket's contents, so this doesn't reintroduce the
-- enumeration problem the `projects`/`project_models` SELECT policies
-- avoid above.
insert into storage.buckets (id, name, public, file_size_limit)
values ('project-files', 'project-files', true, 524288000) -- 500 MB
on conflict (id) do nothing;

-- Uploading still needs its own RLS policy regardless of the public flag
-- (that flag only affects reads). Same known Phase 1 gap as the anon
-- INSERT policies above: open to anyone with the anon key until real auth
-- exists.
create policy "anon can upload to project-files"
  on storage.objects for insert
  to anon
  with check (bucket_id = 'project-files');
