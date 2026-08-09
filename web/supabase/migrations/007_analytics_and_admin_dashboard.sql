-- One-time upgrade adding view analytics and a passcode-gated admin
-- dashboard (Phase 2 -- see docs/features/analytics-and-admin-dashboard.md).
-- Run this ONCE in the SQL editor, after 006_project_description.sql has
-- already been run. Safe to run again if needed -- every statement
-- either uses IF NOT EXISTS/OR REPLACE, or explicitly drops before
-- recreating.
--
-- Admin passcode is set to '1234' below (owner's choice, 2026-08-09) --
-- change it any time by re-running just the final insert/update
-- statement with a different value, then re-running this whole file.

create extension if not exists "pgcrypto" with schema extensions;

-- One row per real page view. Duration is filled in afterwards by a
-- periodic "heartbeat" call while the tab stays open and visible (see
-- services/projectService.ts's updateProjectViewDuration), not a
-- beacon-on-page-close -- navigator.sendBeacon can't carry the API key/
-- auth headers a Supabase call needs, so there's no reliable way to
-- record a final duration exactly at the moment someone closes the tab.
create table if not exists project_views (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  duration_seconds integer not null default 0
);

alter table project_views enable row level security;

-- Anyone can record a view and update its own duration -- the row id is
-- a random, unguessable UUID generated client-side (same trust model as
-- project_models' existing anon insert policy; there is no real
-- architect login yet -- see docs/roadmap/decisions.md). No SELECT
-- policy at all: reads only ever go through get_admin_stats() below,
-- gated by the admin passcode, so nobody who only has a project's own
-- link can see its view counts.
drop policy if exists "anon can insert project_views" on project_views;
create policy "anon can insert project_views"
  on project_views for insert
  to anon
  with check (true);

drop policy if exists "anon can update project_views" on project_views;
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
  constraint admin_settings_single_row check (id)
);

alter table admin_settings enable row level security;
-- Deliberately no policies at all on this table, not even anon SELECT --
-- the only access path is verify_admin_passcode()/get_admin_stats()
-- below, both SECURITY DEFINER, so the passcode hash itself is never
-- directly readable by anyone holding just the anon key.

insert into admin_settings (id, passcode_hash)
values (true, crypt('1234', gen_salt('bf')))
on conflict (id) do update set passcode_hash = excluded.passcode_hash;

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
create or replace function get_admin_stats(p_passcode text)
returns table (
  project_id uuid,
  project_name text,
  created_at timestamptz,
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
      p.created_at,
      count(v.id),
      max(v.viewed_at),
      -- nullif(..., 0) excludes views with no recorded duration yet
      -- (someone who opened the link seconds ago, before the first
      -- heartbeat fires) from dragging the average toward zero.
      avg(nullif(v.duration_seconds, 0))
    from projects p
    left join project_views v on v.project_id = p.id
    group by p.id
    order by p.created_at desc;
end;
$$;

grant execute on function get_admin_stats(text) to anon;
