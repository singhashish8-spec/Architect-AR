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
-- Project and model creation/editing/deletion (Phase 3) all go through
-- admin_*() functions further down (admin_create_project(),
-- admin_add_model(), etc.) -- every one of them re-verifies the admin
-- passcode server-side before writing anything, same pattern
-- verify_admin_passcode() established for reads. Neither `projects` nor
-- `project_models` has an anon INSERT/UPDATE/DELETE policy as a result --
-- there's nothing for one to usefully allow once every write path is a
-- passcode-gated SECURITY DEFINER function instead.
--
-- Known Phase 1 gap, still open: the `project-files` Storage bucket's
-- upload policy (further down) is still open to the anon role -- there's
-- no real per-role Supabase Auth session to scope Storage writes to,
-- admin-ness here is just a passcode check in a Postgres function, not a
-- Storage-level identity. Locking that down would need real auth
-- infrastructure; tracked in docs/roadmap/decisions.md, not solved here.

-- Supabase's own convention: extensions live in the `extensions` schema,
-- not `public` -- see the search_path comment on admin_create_project()
-- below for why that matters.
create extension if not exists "pgcrypto" with schema extensions;

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- Set only via admin_create_project() below, never a direct client
  -- insert -- null means the project has no passcode (default: anyone
  -- with the link can open it).
  passcode_hash text,
  -- Optional free-text blurb shown on the share card (QR + link + this
  -- text) alongside the project name -- see
  -- docs/features/project-share-card.md. Null/blank means no description
  -- was given at upload time.
  description text,
  -- Organizing tag for a growing project list in /admin (Phase 3) --
  -- purely presentational, doesn't affect who can view a project's own
  -- link. See docs/features/full-admin-dashboard.md.
  status text not null default 'active' check (status in ('active', 'sent_to_client', 'archived')),
  created_at timestamptz not null default now()
);

alter table projects enable row level security;

-- No direct anon INSERT policy on `projects` -- admin_create_project()
-- below is the only creation path (SECURITY DEFINER, hashes the
-- passcode itself and re-verifies the admin passcode), so there's
-- nothing for a plain insert policy to usefully allow.

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
  -- Short free-text note per model (e.g. "final", "client requested
  -- changes") -- purely for the architect's own reference in /admin.
  note text,
  created_at timestamptz not null default now()
);

alter table project_models enable row level security;

-- No anon INSERT policy here either (Phase 3) -- admin_add_model()
-- below is the only creation path now. See the top-of-file security
-- note.

-- Shared by every admin_*() write function below -- raises instead of
-- silently no-op'ing on a wrong passcode, unlike verify_admin_passcode()
-- itself (further down, used for reads), so a write RPC's caller gets a
-- real error to show rather than an ambiguous "did that work?".
--
-- Calls verify_admin_passcode(), which is defined later in this file (in
-- the admin_settings section) -- a forward reference, but a harmless one:
-- Postgres only checks a plpgsql function body's syntax at creation
-- time, not that every function it calls already exists, so this is
-- fine as long as the whole script (not just this statement) runs
-- before anything actually calls assert_admin().
create or replace function assert_admin(p_passcode text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not verify_admin_passcode(p_passcode) then
    raise exception 'Invalid admin passcode';
  end if;
end;
$$;

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
create or replace function admin_create_project(
  p_admin_passcode text,
  p_id uuid,
  p_name text,
  p_passcode text default null,
  p_description text default null,
  p_status text default 'active'
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform assert_admin(p_admin_passcode);

  insert into projects (id, name, passcode_hash, description, status)
  values (
    p_id,
    p_name,
    case
      when p_passcode is not null and length(trim(p_passcode)) > 0
        then crypt(p_passcode, gen_salt('bf'))
      else null
    end,
    nullif(trim(coalesce(p_description, '')), ''),
    p_status
  );
end;
$$;

grant execute on function admin_create_project(text, uuid, text, text, text, text) to anon;

-- Name/description/status only -- passcode changes go through
-- admin_set_project_passcode() below, kept separate since it's a more
-- sensitive change worth its own explicit action in the UI rather than
-- bundled into every save of the basic details.
create or replace function admin_update_project(
  p_admin_passcode text,
  p_id uuid,
  p_name text,
  p_description text default null,
  p_status text default 'active'
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform assert_admin(p_admin_passcode);

  update projects
  set name = p_name,
      description = nullif(trim(coalesce(p_description, '')), ''),
      status = p_status
  where id = p_id;
end;
$$;

grant execute on function admin_update_project(text, uuid, text, text, text) to anon;

-- Set, change, or remove a project's passcode after creation -- blank/
-- null p_passcode clears it (the project goes back to open-by-default,
-- same meaning as never having set one).
create or replace function admin_set_project_passcode(
  p_admin_passcode text,
  p_id uuid,
  p_passcode text default null
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform assert_admin(p_admin_passcode);

  update projects
  set passcode_hash = case
    when p_passcode is not null and length(trim(p_passcode)) > 0
      then crypt(p_passcode, gen_salt('bf'))
    else null
  end
  where id = p_id;
end;
$$;

grant execute on function admin_set_project_passcode(text, uuid, text) to anon;

-- Deletes the project row (cascades to project_models and project_views
-- via their existing "on delete cascade" foreign keys). Deliberately
-- does NOT touch Storage -- deleting rows from storage.objects directly
-- in SQL does not reliably delete the underlying file bytes on
-- Supabase's hosted storage, so the client removes the actual files via
-- the Storage API first (see services/adminService.ts), then calls this
-- to remove the database rows once that's confirmed to have worked.
create or replace function admin_delete_project(
  p_admin_passcode text,
  p_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform assert_admin(p_admin_passcode);

  delete from projects where id = p_id;
end;
$$;

grant execute on function admin_delete_project(text, uuid) to anon;

-- Appends a model to an existing project -- sort_order picks up right
-- after the current highest one, so a newly added model lands at the
-- end of the list by default (reorder afterwards via
-- admin_reorder_models() below if it needs to go somewhere else).
create or replace function admin_add_model(
  p_admin_passcode text,
  p_id uuid,
  p_project_id uuid,
  p_name text,
  p_model_url text,
  p_ifc_url text default null,
  p_scale_preset text default '1:1',
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_next_sort_order integer;
begin
  perform assert_admin(p_admin_passcode);

  select coalesce(max(sort_order) + 1, 0) into v_next_sort_order
  from project_models where project_id = p_project_id;

  insert into project_models (id, project_id, name, model_url, ifc_url, scale_preset, sort_order, note)
  values (p_id, p_project_id, p_name, p_model_url, p_ifc_url, p_scale_preset, v_next_sort_order, nullif(trim(coalesce(p_note, '')), ''));
end;
$$;

grant execute on function admin_add_model(text, uuid, uuid, text, text, text, text, text) to anon;

-- Rename, replace the file, change the scale, or update the note on an
-- existing model -- the client always sends the full current-plus-edited
-- object (there's no partial-update convenience here, same as
-- admin_update_project above).
create or replace function admin_update_model(
  p_admin_passcode text,
  p_model_id uuid,
  p_name text,
  p_model_url text,
  p_ifc_url text default null,
  p_scale_preset text default '1:1',
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform assert_admin(p_admin_passcode);

  update project_models
  set name = p_name,
      model_url = p_model_url,
      ifc_url = p_ifc_url,
      scale_preset = p_scale_preset,
      note = nullif(trim(coalesce(p_note, '')), '')
  where id = p_model_id;
end;
$$;

grant execute on function admin_update_model(text, uuid, text, text, text, text, text) to anon;

-- Deletes only the database row -- same reasoning as admin_delete_project
-- above, the client removes the model's actual files from Storage first.
create or replace function admin_delete_model(
  p_admin_passcode text,
  p_model_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform assert_admin(p_admin_passcode);

  delete from project_models where id = p_model_id;
end;
$$;

grant execute on function admin_delete_model(text, uuid) to anon;

-- p_ordered_ids is the full list of a project's model ids in the new
-- order (whatever the "move up"/"move down" buttons in the admin UI
-- computed client-side) -- sort_order becomes each id's position in that
-- array. Scoped to `where project_id = p_project_id` as a sanity check,
-- not just `where id = any(...)`, so a stray id from a different project
-- can't have its sort_order clobbered by mistake.
create or replace function admin_reorder_models(
  p_admin_passcode text,
  p_project_id uuid,
  p_ordered_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform assert_admin(p_admin_passcode);

  update project_models
  set sort_order = ordered.idx - 1
  from unnest(p_ordered_ids) with ordinality as ordered(id, idx)
  where project_models.id = ordered.id
    and project_models.project_id = p_project_id;
end;
$$;

grant execute on function admin_reorder_models(text, uuid, uuid[]) to anon;

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
-- This 500 MB bucket-level limit was never the real ceiling: Supabase's
-- Free plan enforces its own fixed, non-configurable 50 MB global upload
-- limit regardless of it (confirmed live, 2026-08-12). New model/IFC
-- uploads go to Cloudflare R2 instead as a result -- see
-- docs/features/large-file-storage.md. This bucket is kept (not
-- dropped) so every file uploaded before that change keeps working.
insert into storage.buckets (id, name, public, file_size_limit)
values ('project-files', 'project-files', true, 524288000) -- 500 MB
on conflict (id) do nothing;

-- Uploading still needs its own RLS policy regardless of the public flag
-- (that flag only affects reads). This is the one remaining open-to-
-- anon-key gap noted at the top of this file -- open until real auth
-- infrastructure exists to scope it further.
create policy "anon can upload to project-files"
  on storage.objects for insert
  to anon
  with check (bucket_id = 'project-files');

-- View analytics + a passcode-gated admin dashboard (Phase 2) -- see
-- docs/features/analytics-and-admin-dashboard.md.
--
-- Admin passcode is set to '1234' below (owner's choice, 2026-08-09) --
-- change it any time by re-running the insert/update statement below
-- with a different value.

-- One row per real page view. Duration is filled in afterwards by a
-- periodic "heartbeat" call while the tab stays open and visible (see
-- services/projectService.ts's updateProjectViewDuration), not a
-- beacon-on-page-close -- navigator.sendBeacon can't carry the API key/
-- auth headers a Supabase call needs, so there's no reliable way to
-- record a final duration exactly at the moment someone closes the tab.
create table if not exists project_views (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  -- Which model was active when this view was recorded -- nullable, and
  -- set null (not cascade-deleted) if that model is later removed, so a
  -- project's total view count stays accurate even after one of its
  -- models is gone. Powers the Models tab's per-model view count (Phase
  -- 3 -- see docs/features/full-admin-dashboard.md).
  model_id uuid references project_models(id) on delete set null,
  viewed_at timestamptz not null default now(),
  duration_seconds integer not null default 0
);

alter table project_views enable row level security;

-- Anyone can record a view and update its own duration -- the row id is
-- a random, unguessable UUID generated client-side (same trust model as
-- the "anon can upload to project-files" Storage policy above; there is
-- no real architect login yet -- see docs/roadmap/decisions.md). No
-- SELECT policy at all: reads only ever go through get_admin_projects()
-- below, gated by the admin passcode, so nobody who only has a project's
-- own link can see its view counts.
create policy "anon can insert project_views"
  on project_views for insert
  to anon
  with check (true);

create policy "anon can update project_views"
  on project_views for update
  to anon
  using (true)
  with check (true);

-- Always exactly one row -- a boolean primary key that must be true (the
-- check constraint blocks a second row with id=false, and the primary
-- key itself blocks a second id=true row) is a standard way to enforce a
-- single-row settings table in Postgres.
create table if not exists admin_settings (
  id boolean primary key default true,
  passcode_hash text not null,
  -- Account-wide Storage usage limit, in bytes -- defaults to Supabase's
  -- own free-tier allowance (1 GiB) as a starting guess; the real number
  -- depends on whichever plan the owner is actually on, which nothing in
  -- this codebase can know on its own, so admin_set_storage_limit() lets
  -- them correct it from the dashboard instead of it being a hardcoded
  -- value someone has to fix in the SQL editor. See get_storage_usage().
  storage_limit_bytes bigint not null default 1073741824,
  -- One account-wide company name -- shown as a permanent header across
  -- the whole admin dashboard, the public Quantity Takeoff page, and the
  -- Excel export's own title block. Null means nothing's been set yet;
  -- every place that shows it falls back to "Architect AR". See
  -- get_company_name()/admin_set_company_name() below -- reading it is
  -- deliberately public (no passcode), unlike every other column here.
  company_name text,
  constraint admin_settings_single_row check (id)
);

alter table admin_settings enable row level security;
-- Deliberately no policies at all on this table, not even anon SELECT --
-- the only access path is verify_admin_passcode()/get_admin_projects()
-- below, both SECURITY DEFINER, so the passcode hash itself is never
-- directly readable by anyone holding just the anon key.

insert into admin_settings (id, passcode_hash)
values (true, crypt('1234', gen_salt('bf')))
on conflict (id) do nothing;

create or replace function verify_admin_passcode(p_passcode text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
begin
  select passcode_hash into v_hash from admin_settings where id = true;
  return v_hash is not null and crypt(p_passcode, v_hash) = v_hash;
end;
$$;

grant execute on function verify_admin_passcode(text) to anon;

-- Returns nothing at all on a wrong passcode -- the admin dashboard page
-- calls verify_admin_passcode() separately first for real "wrong
-- passcode" feedback, so this doesn't need to double as that signal too.
--
-- Everything the admin UI needs to list, search, sort, and manage
-- projects in one call: the same view-analytics numbers Phase 2's
-- get_admin_stats() had, plus description/status/has_passcode and the
-- full models array (shaped the same way get_project()'s `models`
-- column already is), so opening the management view for a project
-- doesn't need a second round trip. Never returns passcode_hash itself
-- -- has_passcode is a plain boolean.
create or replace function get_admin_projects(p_passcode text)
returns table (
  project_id uuid,
  project_name text,
  description text,
  status text,
  created_at timestamptz,
  has_passcode boolean,
  models jsonb,
  view_count bigint,
  last_viewed_at timestamptz,
  avg_duration_seconds numeric
)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not verify_admin_passcode(p_passcode) then
    return;
  end if;

  -- Two separate lateral subqueries, not one flat double join -- joining
  -- project_models and project_views directly in the same query would
  -- cross-join every model row against every view row per project,
  -- duplicating entries in the models jsonb array (once per view) as a
  -- side effect. Aggregating each relation on its own side-steps that
  -- entirely.
  return query
    select
      p.id,
      p.name,
      p.description,
      p.status,
      p.created_at,
      p.passcode_hash is not null,
      coalesce(m.models, '[]'::jsonb),
      coalesce(vs.view_count, 0),
      vs.last_viewed_at,
      vs.avg_duration_seconds
    from projects p
    left join lateral (
      select jsonb_agg(
        jsonb_build_object(
          'id', pm.id,
          'name', pm.name,
          'modelUrl', pm.model_url,
          'ifcUrl', pm.ifc_url,
          'scalePreset', pm.scale_preset,
          'note', pm.note,
          'createdAt', pm.created_at,
          'viewCount', coalesce(mv.view_count, 0)
        )
        order by pm.sort_order, pm.created_at
      ) as models
      from project_models pm
      -- A second, nested lateral -- per-model view counts, same
      -- "aggregate its own relation separately, don't flat-join"
      -- reasoning as the outer vs. lateral below.
      left join lateral (
        select count(*) as view_count
        from project_views v
        where v.model_id = pm.id
      ) mv on true
      where pm.project_id = p.id
    ) m on true
    left join lateral (
      select
        count(v.id) as view_count,
        max(v.viewed_at) as last_viewed_at,
        -- nullif(..., 0) excludes views with no recorded duration yet
        -- (someone who opened the link seconds ago, before the first
        -- heartbeat fires) from dragging the average toward zero.
        avg(nullif(v.duration_seconds, 0)) as avg_duration_seconds
      from project_views v
      where v.project_id = p.id
    ) vs on true
    order by p.created_at desc;
end;
$$;

grant execute on function get_admin_projects(text) to anon;

-- Individual visits for one project, newest first -- the raw rows
-- get_admin_projects() above already aggregates (view_count/
-- last_viewed_at/avg_duration_seconds), just not truncated down to one
-- summary per project. p_limit defaults to 500 rather than being
-- unbounded: a client-facing project viewer for architecture
-- presentations realistically never approaches that many real visits,
-- and capping it keeps both the query and the admin's own history
-- table/CSV export bounded regardless.
create or replace function get_project_view_history(p_admin_passcode text, p_project_id uuid, p_limit int default 500)
returns table (
  viewed_at timestamptz,
  duration_seconds integer,
  model_id uuid,
  model_name text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not verify_admin_passcode(p_admin_passcode) then
    return;
  end if;

  return query
    select v.viewed_at, v.duration_seconds, v.model_id, m.name
    from project_views v
    left join project_models m on m.id = v.model_id
    where v.project_id = p_project_id
    order by v.viewed_at desc
    limit p_limit;
end;
$$;

grant execute on function get_project_view_history(text, uuid, int) to anon;

-- Reads storage.objects directly (Supabase Storage's own Postgres-backed
-- object metadata table, part of the `storage` schema every Supabase
-- project already has) rather than paginating through the client-side
-- Storage list() API -- a single indexed SUM over one bucket's rows is
-- far cheaper than walking every project's asset folder one Storage API
-- call at a time, and this table already carries each object's byte size
-- in its `metadata` jsonb column.
create or replace function get_storage_usage(p_admin_passcode text)
returns table (used_bytes bigint, limit_bytes bigint)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not verify_admin_passcode(p_admin_passcode) then
    return;
  end if;

  return query
    select
      coalesce(sum((o.metadata->>'size')::bigint), 0)::bigint,
      (select storage_limit_bytes from admin_settings where id = true)
    from storage.objects o
    where o.bucket_id = 'project-files';
end;
$$;

grant execute on function get_storage_usage(text) to anon;

create or replace function admin_set_storage_limit(p_admin_passcode text, p_limit_bytes bigint)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform assert_admin(p_admin_passcode);

  if p_limit_bytes <= 0 then
    raise exception 'Storage limit must be a positive number of bytes';
  end if;

  update admin_settings set storage_limit_bytes = p_limit_bytes where id = true;
end;
$$;

grant execute on function admin_set_storage_limit(text, bigint) to anon;

-- Deliberately public (no passcode argument) -- the client-facing
-- Quantity Takeoff page and the in-viewer Excel export both need to show
-- this same name without asking a visitor to unlock anything, and
-- unlike every other column on admin_settings (passcode_hash,
-- storage_limit_bytes), a company name isn't sensitive information.
create or replace function get_company_name()
returns text
language sql
security definer
set search_path = public, extensions
as $$
  select company_name from admin_settings where id = true;
$$;

grant execute on function get_company_name() to anon;

create or replace function admin_set_company_name(p_admin_passcode text, p_company_name text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform assert_admin(p_admin_passcode);

  -- Blank/whitespace-only clears it back to null (falls back to
  -- "Architect AR" wherever it's shown) rather than storing an empty
  -- string as if it were a real name.
  update admin_settings set company_name = nullif(trim(p_company_name), '') where id = true;
end;
$$;

grant execute on function admin_set_company_name(text, text) to anon;
