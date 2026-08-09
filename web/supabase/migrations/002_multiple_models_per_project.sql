-- One-time upgrade for a Supabase project that already ran the original
-- (single-model) schema.sql -- moves `projects.model_url` / `ifc_url` /
-- `scale_preset` out to a new `project_models` table so one project can
-- hold multiple models (Phase 2). Run this ONCE in the SQL editor, then
-- re-run the current schema.sql (its `create table if not exists` /
-- `create or replace function` statements are safe to run again after
-- this and will finish the upgrade -- they won't touch the projects table
-- itself since it already exists).
--
-- Safe to run against a project with existing test data: any row already
-- in `projects` with a model_url gets migrated into `project_models`
-- rather than dropped. Only run this once -- running it twice is harmless
-- (the drops below use IF EXISTS) but the migrate step would otherwise
-- fail after the columns are gone the first time.

create extension if not exists "pgcrypto";

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

drop policy if exists "anon can insert project_models" on project_models;
create policy "anon can insert project_models"
  on project_models for insert
  to anon
  with check (true);

-- Migrate any existing single-model project into the new table, using the
-- project's own name as that model's name (existing data has no separate
-- model name to draw from).
insert into project_models (project_id, name, model_url, ifc_url, scale_preset, sort_order)
select id, name, model_url, ifc_url, scale_preset, 0
from projects
where model_url is not null;

alter table projects drop column if exists model_url;
alter table projects drop column if exists ifc_url;
alter table projects drop column if exists scale_preset;
