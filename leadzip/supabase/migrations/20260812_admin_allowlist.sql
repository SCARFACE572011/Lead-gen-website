-- Move the auto-admin list out of the signup trigger's source code.
--
-- handle_new_user() hardcoded two email addresses that receive
-- role='admin', plan='agency' automatically on signup. Two problems:
--   1. Anyone who can register that address inherits the admin panel. The
--      addresses are dormant while the accounts exist, but a deleted account
--      or a recycled address re-arms the grant silently.
--   2. Revoking an admin required a code change and a migration, so the live
--      grant list was invisible to anyone reading the app.
--
-- The list becomes a locked-down table instead: service-role only, readable by
-- nobody through the API. Existing admins are seeded first, so this migration
-- cannot lock the owner out. Removing an admin is now a DELETE, not a deploy.
--
-- Idempotent and non-destructive: safe to run more than once.

create table if not exists public.admin_allowlist (
  email      text primary key,
  note       text,
  created_at timestamptz not null default now()
);

alter table public.admin_allowlist enable row level security;

-- No policies are defined on purpose. With RLS on and zero policies, anon and
-- authenticated callers can do nothing; the service role bypasses RLS. Revoke
-- the table grants too, so the allowlist never appears through PostgREST.
revoke all on public.admin_allowlist from anon, authenticated;

-- Seed the addresses that are already admins so behavior is unchanged today.
insert into public.admin_allowlist (email, note)
values
  ('scarface572011@live.com', 'Owner account, migrated from hardcoded trigger'),
  ('jezdangomez@gmail.com',   'Owner account, migrated from hardcoded trigger')
on conflict (email) do nothing;

-- Trigger now consults the table rather than a literal list.
create or replace function public.handle_new_user()
returns trigger as $$
declare
  v_role text := 'user';
  v_plan text := 'free';
begin
  if exists (
    select 1 from public.admin_allowlist
    where email = lower(new.email)
  ) then
    v_role := 'admin';
    v_plan := 'agency';
  end if;

  insert into public.users_profile (id, email, full_name, role, plan)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', v_role, v_plan);

  insert into public.usage_limits (user_id) values (new.id);

  return new;
end;
$$ language plpgsql security definer
set search_path = public, pg_temp;

-- To revoke an admin later:
--   delete from public.admin_allowlist where email = 'someone@example.com';
--   update public.users_profile set role = 'user', plan = 'free'
--     where lower(email) = 'someone@example.com';
--
-- To audit who is currently privileged:
--   select email, role, plan from public.users_profile where role = 'admin';
