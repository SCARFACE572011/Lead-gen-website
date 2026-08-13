-- ============================================================
-- Admin Setup (manual, one-off)
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================
-- This file lives outside supabase/migrations/ and is run by hand, so it is
-- written to be idempotent AND to be harmless if it is re-run months later
-- against a database that migrations have since tightened.
--
-- SECURITY HISTORY (2026-08-12 review), both fixed below:
--   1. It recreated `"Service role can manage cache" ON public.leads_cache
--      FOR ALL USING (true)`. A FOR ALL policy with USING but no WITH CHECK
--      applies the USING expression to WITH CHECK, so `true` meant the anon
--      key could INSERT/UPDATE/DELETE cached search results (cache poisoning).
--      That policy is not live: 20260810_security_and_integrity.sql drops it.
--      But this file's `IF NOT EXISTS` guard now finds nothing, so re-running
--      it would have recreated the hole. It is replaced, not guarded.
--   2. It redefined handle_new_user() to auto-grant role='admin' and
--      plan='agency' to a hardcoded email address. Anyone who controls that
--      mailbox becomes an admin simply by signing up, and the grant is
--      invisible in the app UI. The auto-grant is removed; admin is now an
--      explicit, deliberate action taken below.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Promote a specific existing account to admin (opt in)
--    No email is hardcoded. Postgres cannot read process env, so set the
--    address here for this run only, then leave it blank again. With the
--    default empty value this block is a no-op, so an accidental run of the
--    whole file cannot grant admin to anyone.
-- ────────────────────────────────────────────────────────────
do $$
declare
  -- EDIT FOR THIS RUN ONLY, then set back to ''.
  v_admin_email text := '';
  v_rows integer;
begin
  if v_admin_email = '' then
    raise notice 'admin-setup: v_admin_email is empty, skipping the admin grant.';
    return;
  end if;

  update public.users_profile
  set role = 'admin', plan = 'agency', updated_at = now()
  where lower(email) = lower(v_admin_email);

  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    raise notice 'admin-setup: no users_profile row matched %, nothing granted.', v_admin_email;
  else
    -- The platform-admin grant has two independent halves. The allowlist makes
    -- the account an explicit platform owner; role='admin' alone is
    -- insufficient in the application. Paid Agency customers are never
    -- inserted here.
    insert into public.admin_allowlist (email, note)
    values (lower(v_admin_email), 'Explicit owner grant via admin-setup.sql')
    on conflict (email) do nothing;

    raise notice 'admin-setup: granted admin + agency to %.', v_admin_email;
  end if;
end $$;

-- ────────────────────────────────────────────────────────────
-- 2. leads_cache table
--    Access model (matches migrations/20260811_leads_cache.sql, which is the
--    source of truth): public SELECT so logged-out search can read the cache,
--    and NO write policy at all. The service role bypasses RLS, so it stays
--    the only writer and the anon key can never poison cached results.
-- ────────────────────────────────────────────────────────────
create table if not exists public.leads_cache (
  id uuid default gen_random_uuid() primary key,
  cache_key text not null unique,
  leads jsonb not null default '[]',
  total integer not null default 0,
  source text not null default 'osm',
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.leads_cache enable row level security;

-- Unconditionally remove the old permissive policy. This is NOT wrapped in an
-- "if not exists" guard on purpose: the guard is what made re-running this file
-- dangerous once a migration had already dropped the policy.
drop policy if exists "Service role can manage cache" on public.leads_cache;

drop policy if exists "leads_cache_public_read" on public.leads_cache;
create policy "leads_cache_public_read"
  on public.leads_cache for select
  to anon, authenticated
  using (true);

-- ────────────────────────────────────────────────────────────
-- 3. increment_searches RPC (if not already created)
--    SECURITY DEFINER so it can write usage_limits, which is service-role-write
--    only after migrations/20260812_lock_usage_counters.sql.
-- ────────────────────────────────────────────────────────────
create or replace function public.increment_searches(uid uuid)
returns void as $$
begin
  update public.usage_limits
  set
    searches_this_month = searches_this_month + 1,
    updated_at = now()
  where user_id = uid;
end;
$$ language plpgsql security definer;

-- ────────────────────────────────────────────────────────────
-- 4. New-user trigger function
--    Creates the profile and usage row. It does NOT grant admin to anyone.
--    An "if new.email = '<address>' then role := 'admin'" branch here is a
--    privilege backdoor: whoever controls that mailbox gets admin just by
--    signing up, no audit trail, and the branch is easy to miss in review.
--    Admin is granted deliberately in section 1 instead.
--    NOTE: migrations/20260811_admin_emails.sql still installs a version of
--    this function WITH a hardcoded auto-admin list. Running this file after
--    that migration intentionally replaces it with the version below.
-- ────────────────────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users_profile (id, email, full_name, role, plan)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    'user',
    'free'
  );

  insert into public.usage_limits (user_id)
  values (new.id);

  return new;
end;
$$ language plpgsql security definer;

-- ────────────────────────────────────────────────────────────
-- 5. Verification
-- ────────────────────────────────────────────────────────────

-- Who currently holds admin?
select id, email, role, plan
from public.users_profile
where role = 'admin'
order by email;

-- Is an auto-admin-by-email backdoor installed right now? Inspect the live
-- function body: if the definition contains an email literal next to
-- role/plan assignment, the backdoor is active.
select pg_get_functiondef(p.oid) as handle_new_user_definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'handle_new_user';

-- Is the trigger that calls it actually attached to auth.users?
select tgname, tgenabled
from pg_trigger
where tgrelid = 'auth.users'::regclass
  and not tgisinternal;

-- No write policy should exist on leads_cache (SELECT only).
select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'leads_cache';
