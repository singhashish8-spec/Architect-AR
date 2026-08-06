-- Architect AR — Supabase schema
-- Run once via the Supabase SQL editor. See docs/engineering/build-sequence.md
-- step 12 and docs/features/model-scale-presets.md for context.
--
-- Security note (read before running): this schema deliberately does NOT
-- grant the `anon` role a general SELECT policy on `projects` — a
-- permissive policy would let anyone with the public anon key list every
-- project via the auto-generated REST API, defeating the "unlisted link"
-- sharing model (docs/roadmap/architecture.md#sharing-model). Instead,
-- reads go through get_project(), a SECURITY DEFINER function that only
-- returns a row when the caller already knows its id.
--
-- Known Phase 1 gap, not an oversight: INSERT is currently open to the
-- anon role (no architect login exists yet — Phase 1's build-sequence
-- doesn't include auth). Anyone holding the public anon key could create
-- junk projects. This must be closed with real auth before any public
-- launch — tracked in docs/roadmap/decisions.md.

create extension if not exists "pgcrypto";

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  model_url text not null,
  ifc_url text,
  scale_preset text not null check (
    scale_preset in ('1:1', '1:5', '1:10', '1:20', '1:50', '1:100', '1:200', '1:500', '1:1000')
  ),
  created_at timestamptz not null default now()
);

alter table projects enable row level security;

-- Anyone can create a project (Phase 1 has no architect auth yet -- see
-- the security note above).
create policy "anon can insert projects"
  on projects for insert
  to anon
  with check (true);

-- Deliberately no SELECT policy here -- reads go through get_project().

create or replace function get_project(p_id uuid)
returns setof projects
language sql
security definer
set search_path = public
as $$
  select * from projects where id = p_id limit 1;
$$;

grant execute on function get_project(uuid) to anon;
