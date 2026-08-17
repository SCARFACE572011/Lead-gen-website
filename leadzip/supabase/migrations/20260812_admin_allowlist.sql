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
-- Email matching is case-insensitive end to end. Email local parts are
-- technically case-sensitive but no real mailbox relies on it, and the app
-- already normalizes: src/lib/adminPolicy.ts, src/lib/emailCredits.ts,
-- src/lib/productAccess.ts and src/lib/admin-auth.ts all lowercase before
-- comparing. Storing anything but lowercase here would therefore be a row that
-- the TypeScript checks can never match, so the table normalizes on write and
-- the trigger compares normalized values on both sides.
--
-- Idempotent and non-destructive: safe to run more than once, and valid inside
-- a single wrapping transaction (no CONCURRENTLY, no COMMIT).

create table if not exists public.admin_allowlist (
  email      text primary key,
  note       text,
  created_at timestamptz not null default now()
);

alter table public.admin_allowlist enable row level security;

-- Store lowercase, always. This runs before ON CONFLICT arbitration, so a
-- mixed-case insert of an address that is already listed is a no-op rather
-- than a duplicate row.
create or replace function public.normalize_admin_allowlist_email()
returns trigger as $$
begin
  new.email := lower(btrim(new.email));
  return new;
end;
$$ language plpgsql
set search_path = public, pg_temp;

drop trigger if exists normalize_admin_allowlist_email on public.admin_allowlist;
create trigger normalize_admin_allowlist_email
  before insert or update on public.admin_allowlist
  for each row execute function public.normalize_admin_allowlist_email();

-- Repair any row seeded before the trigger existed. Non-destructive: a row is
-- only rewritten when its normalized form is not already present, so nothing
-- is deleted and the primary key cannot collide. The two production rows are
-- already lowercase, so this is a no-op there.
update public.admin_allowlist a
   set email = lower(btrim(a.email))
 where a.email <> lower(btrim(a.email))
   and not exists (
     select 1 from public.admin_allowlist b
      where b.email = lower(btrim(a.email))
   );

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
  -- Case-insensitive on both sides. Stored emails are normalized by the
  -- trigger above, but normalizing here too keeps the check correct even if a
  -- row is ever loaded with the trigger disabled.
  if new.email is not null and exists (
    select 1 from public.admin_allowlist
    where lower(btrim(admin_allowlist.email)) = lower(btrim(new.email))
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

-- To add an admin later, any casing is accepted and stored lowercase:
--   insert into public.admin_allowlist (email, note)
--   values ('Someone@Example.com', 'why') on conflict (email) do nothing;
--
-- To revoke an admin later (match lowercase, that is how rows are stored):
--   delete from public.admin_allowlist
--     where email = lower('someone@example.com');
--   update public.users_profile set role = 'user', plan = 'free'
--     where lower(email) = lower('someone@example.com');
--
-- To audit who is currently privileged:
--   select email, role, plan from public.users_profile where role = 'admin';
