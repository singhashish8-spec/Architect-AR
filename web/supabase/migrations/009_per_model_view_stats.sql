-- Per-model view stats + created date in the admin Models tab (Phase 3
-- -- see docs/features/full-admin-dashboard.md). Run this ONCE in the
-- SQL editor, after 008_full_admin_dashboard.sql has already been run.
-- Safe to run again if needed.
--
-- Owner's call (2026-08-09): with several models ("versions") per
-- project becoming normal, the Models tab needed each one's own created
-- date and its own view count, not just the project-wide aggregate.

-- Nullable, and set null (not cascade-deleted) when the model is
-- removed -- a view genuinely happened while that model existed, so the
-- project's own total view count must stay accurate even after the
-- model referenced by an old view row is gone. Only the "which model"
-- breakdown for that one historical row is lost.
alter table project_views
  add column if not exists model_id uuid references project_models(id) on delete set null;

-- Replaces get_admin_projects() from 008 -- same shape, plus createdAt
-- and viewCount on each model in the jsonb array.
drop function if exists get_admin_projects(text);

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
      -- "aggregate its own relation separately, don't flat-join" reasoning
      -- as the outer query (see the comment on the vs. lateral below).
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
        avg(nullif(v.duration_seconds, 0)) as avg_duration_seconds
      from project_views v
      where v.project_id = p.id
    ) vs on true
    order by p.created_at desc;
end;
$$;

grant execute on function get_admin_projects(text) to anon;
