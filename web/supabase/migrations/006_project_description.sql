-- One-time upgrade adding an optional project description (Phase 2's
-- share card -- see docs/features/project-share-card.md). Run this ONCE
-- in the SQL editor, after 005_fix_get_project_ambiguous_id.sql has
-- already been run. Safe to run again if needed -- every statement
-- either uses IF NOT EXISTS/OR REPLACE, or explicitly drops before
-- recreating.

alter table projects add column if not exists description text;

-- Signature changed from create_project(uuid, text, text) to add
-- p_description -- create or replace with a different parameter list is
-- fine for create_project() specifically (no caller relies on positional
-- args beyond p_id/p_name/p_passcode, and the new param is appended at
-- the end with a default), unlike get_project() below which needs an
-- explicit drop first (see schema.sql's comment on why that one differs).
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

-- Signature changed from get_project(uuid, text) to add `description` to
-- the returned columns -- drop the old one explicitly first, since a bare
-- `create or replace` with a different return type creates a second,
-- ambiguously-overloaded function instead of replacing it (same reason
-- 003_optional_passcode.sql had to drop get_project(uuid) first).
drop function if exists get_project(uuid, text);

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
