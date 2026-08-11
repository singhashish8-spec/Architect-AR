-- One account-wide company name, shown as a permanent header across the
-- whole admin dashboard, the public Quantity Takeoff page, and the
-- Excel export's own title block (owner's own ask, 2026-08-11: "it has
-- to be the same company from my dashboard" -- not typed separately on
-- each export the way the previous local-only text field worked). Run
-- this ONCE in the SQL editor, after 010_richer_analytics_and_storage_usage.sql
-- has already been run. Safe to run again -- every statement uses
-- create-or-replace / add-column-if-not-exists.

-- Lives on the existing singleton admin_settings table (see schema.sql's
-- own comment on it) rather than anywhere project-scoped -- there's one
-- company for the whole dashboard, not one per project.
alter table admin_settings
  add column if not exists company_name text;

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
