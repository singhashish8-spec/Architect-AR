-- Fixes "function gen_salt(unknown) does not exist" from
-- 003_optional_passcode.sql. Cause: Supabase installs the pgcrypto
-- extension into its `extensions` schema, not `public` -- the two
-- functions below explicitly set search_path = public (a normal
-- SECURITY DEFINER precaution) which left gen_salt()/crypt()
-- unreachable. Re-creates both with `extensions` added to that
-- search_path. Safe to run again if needed.

create or replace function create_project(p_id uuid, p_name text, p_passcode text default null)
returns void
language plpgsql
security definer
set search_path = public, extensions
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
