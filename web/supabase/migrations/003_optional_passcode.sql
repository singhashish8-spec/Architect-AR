-- One-time upgrade adding optional passcode-protected links (Phase 2).
-- Run this ONCE in the SQL editor, after 002_multiple_models_per_project.sql
-- has already been run. Safe to run again if needed -- every statement
-- either uses IF NOT EXISTS/OR REPLACE, or explicitly drops before
-- recreating.

create extension if not exists "pgcrypto";

alter table projects add column if not exists passcode_hash text;

-- No direct anon INSERT policy on `projects` any more -- create_project()
-- below is now the only creation path, so a passcode (if set) always gets
-- hashed server-side and the plain text never gets stored or read back.
drop policy if exists "anon can insert projects" on projects;

create or replace function create_project(p_id uuid, p_name text, p_passcode text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into projects (id, name, passcode_hash)
  values (
    p_id,
    p_name,
    case
      when p_passcode is not null and length(trim(p_passcode)) > 0
        then crypt(p_passcode, gen_salt('bf'))
      else null
    end
  );
end;
$$;

grant execute on function create_project(uuid, text, text) to anon;

create or replace function project_requires_passcode(p_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select passcode_hash is not null from projects where id = p_id limit 1;
$$;

grant execute on function project_requires_passcode(uuid) to anon;

-- Signature changed from get_project(uuid) to add p_passcode -- drop the
-- old one explicitly first (see schema.sql's comment on why).
drop function if exists get_project(uuid);

create or replace function get_project(p_id uuid, p_passcode text default null)
returns table (
  id uuid,
  name text,
  created_at timestamptz,
  models jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_passcode_hash text;
begin
  select passcode_hash into v_passcode_hash from projects where id = p_id;

  if v_passcode_hash is not null
     and (p_passcode is null or crypt(p_passcode, v_passcode_hash) <> v_passcode_hash) then
    return;
  end if;

  return query
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
end;
$$;

grant execute on function get_project(uuid, text) to anon;
