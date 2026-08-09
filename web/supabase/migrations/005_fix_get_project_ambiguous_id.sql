-- Fixes 'column reference "id" is ambiguous' from get_project().
-- Cause: `returns table (id uuid, ...)` implicitly declares `id` as a
-- plpgsql variable in scope for the whole function body -- the bare
-- `where id = p_id` inside was ambiguous between that variable and
-- `projects.id`. Qualifies it. Safe to run again if needed.

create or replace function get_project(p_id uuid, p_passcode text default null)
returns table (
  id uuid,
  name text,
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
