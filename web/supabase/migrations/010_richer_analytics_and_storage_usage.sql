-- Richer per-visit analytics + a storage usage tracker (Phase 3, both
-- previously flagged as "still open" in full-admin-dashboard.md). Run
-- this ONCE in the SQL editor, after 009_per_model_view_stats.sql has
-- already been run. Safe to run again -- every statement uses
-- create-or-replace / add-column-if-not-exists.

-- Individual visits for one project, newest first -- the raw rows
-- get_admin_projects() already aggregates (view_count/last_viewed_at/
-- avg_duration_seconds), just not truncated down to one summary per
-- project. p_limit defaults to 500 rather than being unbounded: a
-- client-facing project viewer for architecture presentations realistically
-- never approaches that many real visits, and capping it keeps both the
-- query and the admin's own history table/CSV export bounded regardless.
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

-- Storage usage is account-wide (one Supabase Storage bucket shared by
-- every project), not per-project, so it lives on admin_settings (the
-- existing single-row settings table) rather than anywhere project-scoped.
-- Defaults to 1 GiB -- Supabase's own free-tier storage allowance -- as a
-- reasonable starting point; the real number depends on whichever plan
-- the owner is actually on, which nothing in this codebase can know on
-- its own. admin_set_storage_limit() below lets the owner correct it
-- themselves from the dashboard instead of this being a hardcoded guess
-- someone has to come back and change in the SQL editor.
alter table admin_settings
  add column if not exists storage_limit_bytes bigint not null default 1073741824;

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
