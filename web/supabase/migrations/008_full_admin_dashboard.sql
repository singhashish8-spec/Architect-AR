-- Full admin dashboard, part 1: project + model management (Phase 3 --
-- see docs/features/full-admin-dashboard.md). Run this ONCE in the SQL
-- editor, after 007_analytics_and_admin_dashboard.sql has already been
-- run. Safe to run again if needed -- every statement either uses IF
-- NOT EXISTS/OR REPLACE, or explicitly drops before recreating.
--
-- Owner's call (2026-08-09): project creation moves entirely behind the
-- admin passcode. The public upload form is removed from the app, and
-- this migration closes the matching server-side door: the old
-- create_project() RPC and the open "anon can insert project_models"
-- policy are both dropped, replaced by admin_create_project()/
-- admin_add_model() below, which re-verify the admin passcode
-- server-side before writing anything -- same pattern
-- verify_admin_passcode()/get_admin_stats() already established.
--
-- Note this does NOT close the "anon can upload to project-files"
-- Storage policy below (still needed -- there's no real per-role
-- Supabase Auth session to scope Storage writes to, admin-ness here is
-- just a passcode check in a Postgres function, not a Storage-level
-- identity). Uploading a file to the bucket still only needs the public
-- anon key; what's now actually gated is whether a *database row*
-- pointing at that file can be created at all. Locking down Storage
-- itself would need real auth infrastructure -- out of scope here, same
-- as the pre-existing Phase 1 gap noted in schema.sql.

alter table projects
  add column if not exists status text not null default 'active';

alter table projects
  drop constraint if exists projects_status_check;

alter table projects
  add constraint projects_status_check
  check (status in ('active', 'sent_to_client', 'archived'));

alter table project_models
  add column if not exists note text;

-- Creation is now admin-only -- see the file header. project_models rows
-- are only ever written by admin_add_model() below (SECURITY DEFINER,
-- bypasses RLS same as every other admin_* function here), so there's
-- nothing left for an anon INSERT policy to usefully allow.
drop policy if exists "anon can insert project_models" on project_models;

-- Superseded by admin_create_project() below -- the public upload form
-- that called this is gone, and leaving this reachable by anon would
-- have meant anyone with the anon key could still create a project row
-- directly, defeating the point of gating creation behind the admin
-- passcode.
drop function if exists create_project(uuid, text, text, text);

-- Shared by every admin_* write function below -- raises instead of
-- silently no-op'ing on a wrong passcode, unlike verify_admin_passcode()
-- itself, so a write RPC's caller gets a real error to show rather than
-- an ambiguous "did that work?".
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

-- The only way to create a project now. Same shape as the old
-- create_project() (still hashes p_passcode server-side, still never
-- stores or returns it in plain text) plus the admin gate and the new
-- status field.
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

-- Replaces get_admin_stats() -- same view-analytics numbers, plus
-- everything the admin UI needs to list, search, sort, and manage
-- projects without a second round trip per project (description,
-- status, whether a passcode is set, and the full models array, shaped
-- the same way get_project()'s `models` column already is). Never
-- returns passcode_hash itself -- has_passcode is a plain boolean.
drop function if exists get_admin_stats(text);

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
          'note', pm.note
        )
        order by pm.sort_order, pm.created_at
      ) as models
      from project_models pm
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
