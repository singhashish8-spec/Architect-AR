-- Architect AR — Supabase schema
-- Run once via the Supabase SQL editor. See docs/engineering/build-sequence.md
-- step 12, docs/features/model-scale-presets.md,
-- docs/features/multiple-models-per-project.md, and
-- docs/features/passcode-protected-links.md for context.
--
-- Security note (read before running): this schema deliberately does NOT
-- grant the `anon` role a general SELECT policy on `projects` or
-- `project_models` — a permissive policy would let anyone with the public
-- anon key list every project via the auto-generated REST API, defeating
-- the "unlisted link" sharing model (docs/roadmap/architecture.md#sharing-model).
-- Instead, reads go through get_project(), a SECURITY DEFINER function
-- that only returns a row when the caller already knows its id (and, if
-- the project has a passcode set, the correct passcode too).
--
-- Known Phase 1 gap, not an oversight: INSERT is open to the anon role on
-- `project_models` (no architect login exists yet — auth isn't in scope
-- until it's tracked in docs/roadmap/decisions.md). `projects` itself is
-- NOT directly insertable by anon — see create_project() below, which is
-- the only way to create one, so a passcode (if set) is always hashed
-- server-side and never stored or transmitted in plain text.

-- Supabase's own convention: extensions live in the `extensions` schema,
-- not `public` -- see the search_path comment on create_project() below
-- for why that matters.
create extension if not exists "pgcrypto" with schema extensions;

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- Set only via create_project() below, never a direct client insert --
  -- null means the project has no passcode (Phase 1 default: anyone with
  -- the link can open it).
  passcode_hash text,
  -- Optional free-text blurb shown on the share card (QR + link + this
  -- text) alongside the project name -- see
  -- docs/features/project-share-card.md. Null/blank means no description
  -- was given at upload time.
  description text,
  created_at timestamptz not null default now()
);

alter table projects enable row level security;

-- No direct anon INSERT policy on `projects` -- create_project() is the
-- only creation path (SECURITY DEFINER, hashes the passcode itself), so
-- there's nothing for a plain insert policy to usefully allow.

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

-- The only way to create a project. SECURITY DEFINER so it can hash
-- p_passcode with pgcrypto's crypt()/gen_salt('bf') (bcrypt) itself --
-- the plain-text passcode passes through this one call and is never
-- stored anywhere. p_passcode null or blank means no passcode (matches
-- Phase 1's open-by-default behavior).
--
-- search_path includes `extensions`, not just `public` -- Supabase
-- installs pgcrypto into the `extensions` schema by default, not
-- `public`, so gen_salt()/crypt() below aren't found without it. Still
-- explicitly scoped (not the default search_path) for the usual
-- SECURITY DEFINER reason: prevents a same-named function in some other
-- schema from being called instead by search-path trickery.
create or replace function create_project(
  p_id uuid,
  p_name text,
  p_passcode text default null,
  p_description text default null
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  insert into projects (id, name, passcode_hash, description)
  values (
    p_id,
    p_name,
    case
      when p_passcode is not null and length(trim(p_passcode)) > 0
        then crypt(p_passcode, gen_salt('bf'))
      else null
    end,
    nullif(trim(coalesce(p_description, '')), '')
  );
end;
$$;

grant execute on function create_project(uuid, text, text, text) to anon;

-- Lets the viewer decide, before fetching any real project data, whether
-- to show a passcode-entry gate at all -- a project with no passcode set
-- should load exactly as before, no extra step. Returns null (not false)
-- for an id that doesn't exist; the client treats null the same as false
-- and lets get_project() below give the real "not found" outcome.
create or replace function project_requires_passcode(p_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select passcode_hash is not null from projects where id = p_id limit 1;
$$;

grant execute on function project_requires_passcode(uuid) to anon;

-- Signature changed from the original get_project(uuid) (Phase 1) to add
-- p_passcode, and its return columns changed again since to add
-- `description` -- drop the old one explicitly first, since a bare
-- `create or replace` with a different parameter list or return type
-- creates a second, ambiguously-overloaded function instead of replacing
-- it.
drop function if exists get_project(uuid);
drop function if exists get_project(uuid, text);

-- Deliberately no SELECT policy on `projects`/`project_models` above --
-- reads go through this SECURITY DEFINER function, which returns a
-- project together with its models in one call (as a jsonb array,
-- already shaped to match services/projectService.ts's camelCase
-- mapping) rather than needing a second round-trip per model. If the
-- project has a passcode set, a missing or wrong p_passcode gets exactly
-- the same "no rows" response as an id that doesn't exist at all --
-- deliberately not distinguishable from outside, so a wrong guess can't
-- be used to confirm a project id is real.
create or replace function get_project(p_id uuid, p_passcode text default null)
returns table (
  id uuid,
  name text,
  description text,
  created_at timestamptz,
  models jsonb
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_passcode_hash text;
begin
  -- `projects.id` must be qualified here -- `returns table (id uuid, ...)`
  -- above implicitly declares `id` as a plpgsql variable in scope for the
  -- whole function body, so a bare `id` is ambiguous with that variable,
  -- not just the table's column.
  select passcode_hash into v_passcode_hash from projects where projects.id = p_id;

  if v_passcode_hash is not null
     and (p_passcode is null or crypt(p_passcode, v_passcode_hash) <> v_passcode_hash) then
    return;
  end if;

  return query
    select
      p.id,
      p.name,
      p.description,
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
end;
$$;

grant execute on function get_project(uuid, text) to anon;

-- Storage bucket for uploaded model/IFC files (services/projectService.ts's
-- MODEL_BUCKET constant -- keep these in sync if either changes).
-- `public = true` makes uploaded files readable via their public URL
-- (getPublicUrl()) without needing a separate SELECT policy -- Supabase's
-- public-bucket flag governs the public URL route directly. It does NOT
-- grant listing a bucket's contents, so this doesn't reintroduce the
-- enumeration problem the `projects`/`project_models` SELECT policies
-- avoid above. Note this bucket's contents (the model/IFC files
-- themselves) are NOT passcode-gated even when a project is -- only the
-- get_project() lookup is. See docs/features/passcode-protected-links.md.
insert into storage.buckets (id, name, public, file_size_limit)
values ('project-files', 'project-files', true, 524288000) -- 500 MB
on conflict (id) do nothing;

-- Uploading still needs its own RLS policy regardless of the public flag
-- (that flag only affects reads). Same known Phase 1 gap as the anon
-- INSERT policy above: open to anyone with the anon key until real auth
-- exists.
create policy "anon can upload to project-files"
  on storage.objects for insert
  to anon
  with check (bucket_id = 'project-files');
