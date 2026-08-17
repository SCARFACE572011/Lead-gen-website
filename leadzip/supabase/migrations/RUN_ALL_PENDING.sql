-- ==========================================================================
-- LeadZipp: every pending migration, in one paste.
--
-- GENERATED FILE. Do not edit by hand.
--   Regenerate with: npm run build:migrations
--   Edit the individual files in supabase/migrations/ instead.
--
-- HOW TO RUN
--   Supabase Dashboard -> SQL Editor -> New query -> paste all -> Run.
--   Runs inside a single transaction, so a failure applies nothing and
--   cannot leave the database half-built. Every statement is idempotent,
--   so running it twice is safe.
--
-- CONTENTS, in dependency order
--    1. 20260812_admin_allowlist           auto-admin moved out of the signup trigger
--    2. 20260812_audit_reports             shareable audit reports, no anon access
--    3. 20260812_daily_search_counter      tamper-proof daily counter for the fair-use cap
--    4. 20260812_gclid                     ad click id on the profile, for attribution
--    5. 20260812_lock_usage_counters       users can no longer edit their own usage counters
--    6. 20260812_pipeline                  CRM pipeline stage on saved leads
--    7. 20260812_saved_search_country      keeps country and km on saved searches
--    8. 20260813_bulk_save_entitlements    saved-lead entitlement enforcement
--    9. 20260815_product_allowances        metered live-search allowances and workspace guards
--   10. 20260816_saved_lead_count_sync     keeps saved-lead counts honest
--   11. 20260817_feature_usage             per-feature usage metering
--   12. 20260818_email_credits             Email Finder credit ledger, accounts, purchases
--
-- AFTER RUNNING, deploy the application. The code is written to work in
-- both states, so deploying before this runs degrades rather than breaks,
-- but features stay inert until it is applied.
-- ==========================================================================

begin;

-- ============ 20260812_admin_allowlist.sql ============

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

-- ============ 20260812_audit_reports.sql ============

-- Audit reports: shareable public-link snapshots of a lead's digital health.
-- Generated by an agency user from a lead card; shared with the prospect as a
-- cold-outreach door opener at /audit/<slug>.
--
-- Access model:
--   * Owner (authenticated user) can insert/read/update/delete their own rows.
--   * Anyone holding the link can read a report, but ONLY through the server:
--     /audit/[slug] fetches the row with the service role key, which bypasses
--     RLS. The slug is the capability.
--
--     There is deliberately NO anon SELECT policy. A permissive
--     "FOR SELECT TO anon USING (true)" policy would have made every report
--     listable through PostgREST, letting anyone enumerate which businesses
--     every customer is prospecting. That prospect list is the customer's
--     competitive advantage, so the table is not exposed to anon at all and
--     anon's table privileges are revoked outright.
--
-- Idempotent: safe to run more than once.

CREATE TABLE IF NOT EXISTS public.audit_reports (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slug       text        NOT NULL UNIQUE,
  lead       jsonb       NOT NULL,  -- snapshot of the lead at generation time
  health     jsonb       NOT NULL,  -- HealthScoreResult {total, pillars, verified}
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_reports ENABLE ROW LEVEL SECURITY;

-- Owner read/write
DROP POLICY IF EXISTS "Owners manage their own audit reports" ON public.audit_reports;
CREATE POLICY "Owners manage their own audit reports"
  ON public.audit_reports FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Public sharing is served by the service role in the /audit/[slug] route, not
-- by a policy. Drop the enumerable policy if an earlier run of this file
-- created it.
DROP POLICY IF EXISTS "Public can read audit reports by link" ON public.audit_reports;

-- anon gets no access to this table at all.
REVOKE ALL ON public.audit_reports FROM anon;

CREATE INDEX IF NOT EXISTS audit_reports_user_id_idx ON public.audit_reports(user_id);

-- ============ 20260812_daily_search_counter.sql ============

-- Tamper-proof daily search counter.
--
-- The paid fair-use cap (150 live searches/day) counted rows in
-- search_history. But DELETE /api/history lets a user clear their own history,
-- and it runs with the service role, so any paid user could reset the cap by
-- clearing history between batches and then run unlimited billable Google
-- Places searches. The counter and the user-clearable UI history were the same
-- table, which is the bug.
--
-- This moves the count onto usage_limits, which users can read but never write
-- (see 20260812_lock_usage_counters.sql). Clearing search history no longer
-- touches billing enforcement.
--
-- Idempotent and non-destructive: safe to run more than once.

alter table if exists public.usage_limits
  add column if not exists searches_today      integer not null default 0,
  add column if not exists searches_today_date date;

-- Increments the caller's daily counter, rolling over automatically on the
-- first search of a new UTC day. SECURITY DEFINER so it still works once
-- direct writes to usage_limits are locked down.
--
-- The uid argument is NOT trusted. A SECURITY DEFINER function that acts on a
-- caller-supplied user id lets any authenticated user inflate a stranger's
-- counter and lock them out of search. When a session is present we always use
-- auth.uid() and ignore the argument; the argument is honored only when
-- auth.uid() is null, which means the caller is the service role.
create or replace function public.increment_daily_searches(uid uuid)
returns integer as $$
declare
  new_count integer;
  target_id uuid := coalesce(auth.uid(), uid);
begin
  if target_id is null then
    return 0;
  end if;

  update public.usage_limits
  set
    searches_today = case
      when searches_today_date is distinct from (now() at time zone 'utc')::date then 1
      else searches_today + 1
    end,
    searches_today_date = (now() at time zone 'utc')::date,
    searches_this_month = searches_this_month + 1,
    updated_at = now()
  where user_id = target_id
  returning searches_today into new_count;

  return coalesce(new_count, 0);
end;
$$ language plpgsql security definer
set search_path = public, pg_temp;

revoke all on function public.increment_daily_searches(uuid) from public, anon;
grant execute on function public.increment_daily_searches(uuid) to authenticated, service_role;

-- Same hardening for the pre-existing monthly counter, which had the identical
-- flaw: any authenticated user could call it with someone else's uid and burn
-- through that user's monthly search allowance.
create or replace function public.increment_searches(uid uuid)
returns void as $$
declare
  target_id uuid := coalesce(auth.uid(), uid);
begin
  if target_id is null then
    return;
  end if;

  update public.usage_limits
  set
    searches_this_month = searches_this_month + 1,
    updated_at = now()
  where user_id = target_id;
end;
$$ language plpgsql security definer
set search_path = public, pg_temp;

revoke all on function public.increment_searches(uuid) from public, anon;
grant execute on function public.increment_searches(uuid) to authenticated, service_role;

-- ============ 20260812_gclid.sql ============

-- ════════════════════════════════════════════════════════════
-- Google click id (gclid) on the user profile
--
-- Captured client side from a ?gclid=... landing URL into the first-party
-- lz_gclid cookie (see src/lib/analytics.ts), then written onto the profile row
-- at signup. The Stripe webhook reads it back when an invoice is paid and emits
-- an [offline-conversion] log line, which is the raw material for Google Ads
-- Offline Conversion Import.
--
-- Fully idempotent: safe to run repeatedly and safe to run on a database where
-- the column already exists. The application feature-detects this column and
-- keeps working if the migration has not been applied yet.
-- ════════════════════════════════════════════════════════════

alter table public.users_profile
  add column if not exists gclid text;

comment on column public.users_profile.gclid is
  'Google Ads click id captured at signup from the lz_gclid first-party cookie. Used for Offline Conversion Import. Not PII.';

-- Only a small fraction of rows carry a gclid, and lookups are always
-- "does this converting user have one", so a partial index stays tiny.
create index if not exists users_profile_gclid_idx
  on public.users_profile (gclid)
  where gclid is not null;

-- No RLS change needed. The existing "Users can update own profile" policy
-- already allows a user to write their own non-privileged columns, and the
-- users_profile_protect_privileged trigger only guards plan/role/status.

-- ============ 20260812_lock_usage_counters.sql ============

-- 20260812_lock_usage_counters.sql
-- Stop users from resetting their own metering to bypass search caps.
--
-- AUDIT (confirmed live 2026-08-12): usage_limits and search_history were
-- created (schema.sql) with `for all using (auth.uid() = user_id)` policies,
-- so a logged-in user could, with the public anon key + their own session:
--   update usage_limits set searches_this_month = 0 where user_id = <self>   -- reset free cap
--   delete from search_history where user_id = <self>                        -- reset daily fair-use cap
-- Both were verified returning HTTP 200. This defeats the free monthly cap
-- (25) and the paid daily fair-use cap (150), feeding the Google/Hunter bill.
--
-- FIX: users may SELECT their own rows; only the service role writes them.
--   - usage_limits: SELECT only for users. The increment_searches() RPC is
--     SECURITY DEFINER, and the app's write paths use the service-role client,
--     so counting still works. Users can no longer zero their counter.
--   - search_history: SELECT + INSERT for users (the app inserts one row per
--     billable search), but NO UPDATE/DELETE, so a user can't delete today's
--     rows to reset the daily fair-use count.
--
-- ── WHY THE DROPS ARE DONE BY QUERYING pg_policies ──────────────────────────
-- Postgres ORs permissive policies together. A leftover permissive
-- `FOR ALL USING (auth.uid() = user_id)` policy therefore keeps granting
-- UPDATE and DELETE no matter how restrictive the new SELECT-only policies
-- are: adding a policy can only widen access, never narrow it. The only way
-- to lock these tables down is to remove the old policy, and
-- `drop policy if exists "<name>"` is a SILENT no-op when the name is wrong.
--
-- The first version of this migration dropped guessed names
-- ("Users can view their own usage", "Users can manage their own search
-- history") that do not exist. The names actually created by
-- supabase/schema.sql are:
--   * "Users can view own usage limits"     on usage_limits   (FOR ALL, ~137-139)
--   * "Users can manage own search history" on search_history (FOR ALL, ~132-134)
-- So the earlier run dropped nothing and the FOR ALL policies survived.
--
-- Rather than trade one hardcoded guess for another, the blocks below drop
-- EVERY existing policy on the two tables by reading pg_policies, then create
-- exactly the intended ones. That is correct whether or not the earlier
-- version already ran, and it cannot drift again if a policy is renamed.
-- Nothing else needs a policy here: the service role bypasses RLS entirely,
-- and admin reads of these tables go through the service-role client.
--
-- Idempotent and safe to re-run. Run in Supabase: Dashboard (project
-- Leadzip-prod, ref oeotgkarnqrfvvdfnaya) -> SQL Editor -> paste + run.
-- RUN 20260810_security_and_integrity.sql FIRST (it blocks plan/role/status
-- self-escalation, the more severe hole).

-- ── usage_limits: read-only for users, service-role writes only ─────────────
alter table public.usage_limits enable row level security;

do $$
declare
  pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'usage_limits'
  loop
    execute format('drop policy %I on public.usage_limits', pol.policyname);
  end loop;
end $$;

create policy "usage_limits_select_own"
  on public.usage_limits for select
  to authenticated
  using (auth.uid() = user_id);

-- ── search_history: users may read and insert, but never update or delete ───
alter table public.search_history enable row level security;

do $$
declare
  pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'search_history'
  loop
    execute format('drop policy %I on public.search_history', pol.policyname);
  end loop;
end $$;

create policy "search_history_select_own"
  on public.search_history for select
  to authenticated
  using (auth.uid() = user_id);

create policy "search_history_insert_own"
  on public.search_history for insert
  to authenticated
  with check (auth.uid() = user_id);

-- ── subscriptions: one row per user, so the webhook + checkout-return
--    activation can't race into two rows (which then 500s every future sub
--    webhook). Safe if no duplicates exist yet (true on a fresh billing table).
create unique index if not exists subscriptions_user_id_key
  on public.subscriptions (user_id);

-- ── Verification: expect exactly the three policies created above, and no
--    UPDATE/DELETE/ALL row for either table.
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('usage_limits', 'search_history')
order by tablename, policyname;

-- ============ 20260812_pipeline.sql ============

-- 20260812_pipeline.sql
-- CRM Pipeline: per-lead sales stage on the saved leads table.
--
-- Adds two columns used by the Pipeline board on /saved:
--   pipeline_stage   - one of: new | contacted | replied | meeting | proposal | won | lost
--                      (validated server-side in /api/leads/pipeline; no CHECK constraint so
--                      future stage additions never need a migration)
--   stage_updated_at - when the lead last moved between stages
--
-- Idempotent and non-destructive: safe to run on a fresh or existing database.
-- Run in Supabase: Dashboard -> SQL Editor -> New query -> paste + run.

alter table if exists public.leads
  add column if not exists pipeline_stage   text not null default 'new',
  add column if not exists stage_updated_at timestamptz;

-- Board loads are always "this user's leads grouped by stage"
create index if not exists leads_user_stage_idx
  on public.leads (user_id, pipeline_stage);

-- ============ 20260812_saved_search_country.sql ============

-- 20260812_saved_search_country.sql
-- Worldwide saved searches: keep the country and the km radius the user picked.
--
-- WHY
-- saved_searches was designed for the US ZIP path only. It stores the location in
-- one text `zip` column (a ZIP, or free text like "Berlin, Germany" for worldwide
-- search) and the radius in an integer MILES column. Two things break for
-- international rows:
--
--   1. No country. Re-running a saved "Cambridge" with no country bias geocodes to
--      Cambridge, Massachusetts instead of Cambridge, UK, so the nightly alert
--      digest emails leads from the wrong continent and flags every one as new.
--      It also builds the cache key "intl::cambridge|..." (empty country segment),
--      which no interactive search can ever produce, so every run re-bills the
--      paid Places API and shares nothing back.
--
--   2. Lossy radius. km -> integer miles -> km does not round-trip for two of the
--      five radius options the UI offers: 1 km saves as 1 mi and re-keys as 2 km,
--      25 km saves as 16 mi and re-keys as 26 km. (5 / 10 / 50 km land back on
--      themselves.) Those two therefore never match the interactive cache pool.
--
-- Both columns are nullable and purely additive:
--   * country_code - ISO 3166-1 alpha-2, uppercase. NULL means "US intent",
--                    which is exactly how every legacy row already behaves.
--   * radius_km    - canonical radius for international rows. NULL means "use the
--                    legacy miles column", which is what US ZIP rows always do.
--
-- The legacy `zip` and `radius` columns keep their exact current meaning, so US
-- ZIP saved searches and their cache keys are untouched.
--
-- Idempotent and non-destructive: safe to run on a fresh or existing database, and
-- safe to re-run. Every reader and writer in the app feature-detects these columns
-- and degrades to the legacy behavior when they are absent, so applying this is
-- not a deploy blocker.
--
-- Run in Supabase: Dashboard -> SQL Editor -> New query -> paste + run.

alter table if exists public.saved_searches
  add column if not exists country_code text,
  add column if not exists radius_km    integer;

comment on column public.saved_searches.country_code is
  'ISO 3166-1 alpha-2 (uppercase) the search was run with. NULL = legacy US intent.';
comment on column public.saved_searches.radius_km is
  'Canonical radius in km for worldwide searches. NULL = use the legacy integer-miles radius column.';

-- Sanity constraints, added only once so re-running stays safe. Both allow NULL,
-- so every existing row satisfies them.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.saved_searches'::regclass
      and conname = 'saved_searches_country_code_format'
  ) then
    alter table public.saved_searches
      add constraint saved_searches_country_code_format
      check (country_code is null or country_code ~ '^[A-Z]{2}$');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.saved_searches'::regclass
      and conname = 'saved_searches_radius_km_range'
  ) then
    alter table public.saved_searches
      add constraint saved_searches_radius_km_range
      check (radius_km is null or (radius_km > 0 and radius_km <= 500));
  end if;
end $$;

-- ============ 20260813_bulk_save_entitlements.sql ============

-- Bulk save + per-plan saved-lead enforcement.
--
-- 1. The original leads.id primary key was a provider/place ID. That made it
--    globally unique, so two different LeadZipp customers could not save the
--    same real-world business. Give rows their own primary key and make the
--    provider ID unique only inside one user's list.
-- 2. Enforce Free (25) and Pro (1,000) storage limits in Postgres as well as
--    the route handler. Agency and owner/admin accounts remain unlimited.
-- 3. Serialize inserts per user with an advisory transaction lock so two
--    simultaneous Save All requests cannot race past the plan limit.
--
-- Idempotent. Apply through the normal Supabase migration workflow before the
-- bulk-save UI is released.

alter table if exists public.leads
  add column if not exists record_id uuid default gen_random_uuid();

update public.leads
set record_id = gen_random_uuid()
where record_id is null;

alter table if exists public.leads
  alter column record_id set default gen_random_uuid(),
  alter column record_id set not null;

do $$
declare
  current_primary_key text;
begin
  select constraint_name
    into current_primary_key
  from information_schema.table_constraints
  where table_schema = 'public'
    and table_name = 'leads'
    and constraint_type = 'PRIMARY KEY'
  limit 1;

  if current_primary_key is not null and current_primary_key <> 'leads_record_id_pkey' then
    execute format('alter table public.leads drop constraint %I', current_primary_key);
  end if;

  if not exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'leads'
      and constraint_type = 'PRIMARY KEY'
  ) then
    alter table public.leads
      add constraint leads_record_id_pkey primary key (record_id);
  end if;
end
$$;

create unique index if not exists leads_user_id_provider_id_key
  on public.leads (user_id, id);

create or replace function public.enforce_saved_lead_entitlement()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  account_plan text := 'free';
  account_role text := 'user';
  saved_limit integer := 25;
  current_count bigint;
begin
  if new.user_id is null then
    raise exception 'A saved lead must belong to a user.'
      using errcode = '23502';
  end if;

  -- One user-scoped lock closes concurrent count-then-insert races. It is held
  -- only for this transaction and does not serialize different customers.
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));

  -- An upsert of a row the user already owns is an update, not a new slot.
  if exists (
    select 1
    from public.leads
    where user_id = new.user_id
      and id = new.id
  ) then
    return new;
  end if;

  select coalesce(plan, 'free'), coalesce(role, 'user')
    into account_plan, account_role
  from public.users_profile
  where id = new.user_id;

  if not found then
    account_plan := 'free';
    account_role := 'user';
  end if;

  if account_role = 'admin' or account_plan = 'agency' then
    return new;
  end if;

  if account_plan = 'pro' then
    saved_limit := 1000;
  else
    saved_limit := 25;
  end if;

  select count(*)
    into current_count
  from public.leads
  where user_id = new.user_id;

  if current_count >= saved_limit then
    raise exception 'Saved lead limit reached for the % plan.', account_plan
      using
        errcode = '23514',
        detail = format('This plan allows %s saved leads.', saved_limit),
        hint = 'Remove a saved lead or upgrade the account plan.';
  end if;

  return new;
end;
$$;

drop trigger if exists leads_enforce_saved_entitlement on public.leads;
create trigger leads_enforce_saved_entitlement
  before insert on public.leads
  for each row execute function public.enforce_saved_lead_entitlement();

comment on column public.leads.record_id is
  'Internal row identity. leads.id is the provider/place ID and is unique per user.';

comment on function public.enforce_saved_lead_entitlement() is
  'Enforces saved-lead plan limits under a per-user transaction lock.';

-- ============ 20260815_product_allowances.sql ============

-- Transparent product allowances and atomic live-search metering.
--
-- A live search is a cache miss that is about to reach the provider path.
-- Cached reads/refinements remain free. Agency search usage is shared by the
-- workspace so adding seats cannot silently multiply upstream API spend.
--
-- Public allowances (also defined in src/lib/planPolicy.ts):
--   Free   25 live searches/month, 25/day, 25 saved leads
--   Pro   100 live searches/month, 50/day, 1,000 saved leads
--   Agency 300 live searches/month, 150/day, 10,000 saved leads
-- Platform admins are exempt. Idempotent and safe to re-run.

-- Workspace membership is server-managed. A browser may edit ordinary profile
-- fields, but cannot attach itself to an Agency workspace by writing a UUID.
create or replace function public.protect_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if (new.plan is distinct from old.plan
      or new.role is distinct from old.role
      or new.status is distinct from old.status
      or new.workspace_id is distinct from old.workspace_id)
     and auth.role() is not null
     and auth.role() <> 'service_role'
  then
    raise exception 'changing plan, role, status, or workspace requires the service role'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists users_profile_protect_privileged on public.users_profile;
create trigger users_profile_protect_privileged
  before update on public.users_profile
  for each row execute function public.protect_profile_privileged_columns();

-- Stripe webhooks are delivered at least once and may arrive out of order.
-- The version stores event.created plus an active/inactive precedence bit, so
-- application sync can reject stale state atomically even within one second.
alter table if exists public.subscriptions
  add column if not exists stripe_state_version bigint not null default 0,
  add column if not exists stripe_subscription_created bigint not null default 0;

create or replace function public.reserve_live_search(uid uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller_id uuid := auth.uid();
  requested_id uuid := coalesce(caller_id, uid);
  subject_id uuid := requested_id;
  account_plan text := 'free';
  account_role text := 'user';
  account_status text := 'active';
  account_email text;
  account_is_platform_admin boolean := false;
  workspace_id_value uuid;
  workspace_owner_id uuid;
  owner_plan text;
  owner_role text;
  owner_status text;
  owner_email text;
  owner_is_platform_admin boolean := false;
  owner_subscription_active boolean := false;
  own_subscription_plan text;
  subscription_status_value text;
  subscription_period_start timestamptz;
  monthly_limit integer := 25;
  daily_limit integer := 25;
  current_month integer := 0;
  current_day integer := 0;
  utc_today date := (now() at time zone 'utc')::date;
  utc_month date := date_trunc('month', now() at time zone 'utc')::date;
begin
  if requested_id is null then
    return jsonb_build_object('allowed', false, 'reason', 'unauthorized');
  end if;

  select
    coalesce(plan, 'free'),
    coalesce(role, 'user'),
    coalesce(status, 'active'),
    email,
    workspace_id
  into account_plan, account_role, account_status, account_email, workspace_id_value
  from public.users_profile
  where id = requested_id;

  if not found or account_status <> 'active' then
    return jsonb_build_object('allowed', false, 'reason', 'inactive');
  end if;

  account_is_platform_admin := account_role = 'admin' and exists (
    select 1 from public.admin_allowlist
    where lower(admin_allowlist.email) = lower(account_email)
  );

  -- Profile.plan is a denormalized display value, never billing authority.
  -- Every non-owner resolves from a currently active subscription or Free.
  if not account_is_platform_admin then
    own_subscription_plan := null;
    select plan into own_subscription_plan
    from public.subscriptions
    where user_id = requested_id
      and status in ('active', 'trialing')
      and plan in ('pro', 'agency')
    order by updated_at desc
    limit 1;
    account_plan := coalesce(own_subscription_plan, 'free');
    account_role := 'user';
  end if;

  -- Agency allowances belong to the workspace owner and are shared by every
  -- seat. A stale inherited `plan=agency` on a member is never trusted if the
  -- owner no longer has an active Agency entitlement.
  if workspace_id_value is not null
     and not account_is_platform_admin
     and exists (
       select 1 from public.workspace_members
       where workspace_id = workspace_id_value and user_id = requested_id
     ) then
    select owner_id into workspace_owner_id
    from public.workspaces
    where id = workspace_id_value;

    if workspace_owner_id is not null then
      select
        coalesce(plan, 'free'),
        coalesce(role, 'user'),
        coalesce(status, 'active'),
        email
      into owner_plan, owner_role, owner_status, owner_email
      from public.users_profile
      where id = workspace_owner_id;

      select exists (
        select 1 from public.subscriptions
        where user_id = workspace_owner_id
          and plan = 'agency'
          and status in ('active', 'trialing')
      ) into owner_subscription_active;

      owner_is_platform_admin := owner_status = 'active'
        and owner_role = 'admin'
        and exists (
          select 1 from public.admin_allowlist
          where lower(admin_allowlist.email) = lower(owner_email)
        );

      if owner_status = 'active'
         and (owner_is_platform_admin or (owner_plan = 'agency' and owner_subscription_active)) then
        subject_id := workspace_owner_id;
        account_plan := 'agency';
      else
        -- Restore the member's own paid entitlement, if one exists; otherwise
        -- use Free. This prevents an expired workspace from granting Agency.
        select plan into own_subscription_plan
        from public.subscriptions
        where user_id = requested_id
          and status in ('active', 'trialing')
          and plan in ('pro', 'agency')
        order by updated_at desc
        limit 1;

        subject_id := requested_id;
        account_plan := coalesce(own_subscription_plan, 'free');
        account_role := 'user';
      end if;
    elsif workspace_id_value is not null then
      -- A dangling workspace link must not preserve a copied Agency plan.
      select plan into own_subscription_plan
      from public.subscriptions
      where user_id = requested_id
        and status in ('active', 'trialing')
        and plan in ('pro', 'agency')
      order by updated_at desc
      limit 1;

      subject_id := requested_id;
      account_plan := coalesce(own_subscription_plan, 'free');
      account_role := 'user';
    end if;
  elsif workspace_id_value is not null and not account_is_platform_admin then
    -- A forged/stale profile workspace UUID without a matching membership row
    -- never inherits the copied Agency plan.
    select plan into own_subscription_plan
    from public.subscriptions
    where user_id = requested_id
      and status in ('active', 'trialing')
      and plan in ('pro', 'agency')
    order by updated_at desc
    limit 1;
    subject_id := requested_id;
    account_plan := coalesce(own_subscription_plan, 'free');
    account_role := 'user';
  end if;

  if account_is_platform_admin then
    return jsonb_build_object(
      'allowed', true,
      'reason', null,
      'plan', 'agency',
      'subjectUserId', subject_id,
      'monthlyUsed', 0,
      'monthlyLimit', null,
      'dailyUsed', 0,
      'dailyLimit', null
    );
  elsif account_plan = 'agency' then
    monthly_limit := 300;
    daily_limit := 150;
  elsif account_plan = 'pro' then
    monthly_limit := 100;
    daily_limit := 50;
  else
    account_plan := 'free';
    monthly_limit := 25;
    daily_limit := 25;
  end if;

  -- Trials remain genuinely useful, but do not expose a full month of paid
  -- provider spend before the first invoice: Pro gets 25 live searches and
  -- Agency gets 75 pooled live searches during its seven-day trial.
  select status, current_period_start
  into subscription_status_value, subscription_period_start
  from public.subscriptions
  where user_id = subject_id
    and status in ('active', 'trialing')
  order by updated_at desc
  limit 1;

  if subscription_status_value = 'trialing' then
    if account_plan = 'agency' then
      monthly_limit := 75;
      daily_limit := 75;
    elsif account_plan = 'pro' then
      monthly_limit := 25;
      daily_limit := 25;
    end if;
  end if;

  -- Serialize allowance checks by billing subject. The existing usage row can
  -- be missing for legacy users, so create it before taking the row lock.
  perform pg_advisory_xact_lock(hashtextextended(subject_id::text, 1));
  insert into public.usage_limits (user_id)
  values (subject_id)
  on conflict (user_id) do nothing;

  -- Calendar-month rollover happens inside the reservation itself; no cron is
  -- required for a customer to regain their allowance.
  update public.usage_limits
  set
    searches_this_month = case
      when subscription_status_value = 'trialing'
           and subscription_period_start is not null
           and last_reset_at < subscription_period_start then 0
      when subscription_status_value is distinct from 'trialing'
           and date_trunc('month', last_reset_at at time zone 'utc')::date < utc_month then 0
      else searches_this_month
    end,
    exports_count = case
      when subscription_status_value = 'trialing'
           and subscription_period_start is not null
           and last_reset_at < subscription_period_start then 0
      when subscription_status_value is distinct from 'trialing'
           and date_trunc('month', last_reset_at at time zone 'utc')::date < utc_month then 0
      else exports_count
    end,
    last_reset_at = case
      when subscription_status_value = 'trialing'
           and subscription_period_start is not null
           and last_reset_at < subscription_period_start then now()
      when subscription_status_value is distinct from 'trialing'
           and date_trunc('month', last_reset_at at time zone 'utc')::date < utc_month then now()
      else last_reset_at
    end,
    searches_today = case
      when searches_today_date is distinct from utc_today then 0
      else searches_today
    end,
    searches_today_date = utc_today,
    updated_at = now()
  where user_id = subject_id;

  select searches_this_month, searches_today
  into current_month, current_day
  from public.usage_limits
  where user_id = subject_id
  for update;

  if current_month >= monthly_limit then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'monthly',
      'plan', account_plan,
      'subjectUserId', subject_id,
      'monthlyUsed', current_month,
      'monthlyLimit', monthly_limit,
      'dailyUsed', current_day,
      'dailyLimit', daily_limit
    );
  end if;

  if current_day >= daily_limit then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'daily',
      'plan', account_plan,
      'subjectUserId', subject_id,
      'monthlyUsed', current_month,
      'monthlyLimit', monthly_limit,
      'dailyUsed', current_day,
      'dailyLimit', daily_limit
    );
  end if;

  update public.usage_limits
  set
    searches_this_month = searches_this_month + 1,
    searches_today = searches_today + 1,
    updated_at = now()
  where user_id = subject_id
  returning searches_this_month, searches_today
  into current_month, current_day;

  return jsonb_build_object(
    'allowed', true,
    'reason', null,
    'plan', account_plan,
    'subjectUserId', subject_id,
    'monthlyUsed', current_month,
    'monthlyLimit', monthly_limit,
    'dailyUsed', current_day,
    'dailyLimit', daily_limit
  );
end;
$$;

-- Saved searches are inexpensive, but alerts can trigger paid live refreshes.
-- Apply transparent storage/alert ceilings transactionally so parallel tabs or
-- Agency seats cannot race past them. Agency counts are pooled by workspace.
create or replace function public.enforce_saved_search_entitlement()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  account_plan text := 'free';
  account_role text := 'user';
  account_status text := 'active';
  account_email text;
  account_is_platform_admin boolean := false;
  workspace_id_value uuid;
  workspace_owner_id uuid;
  owner_plan text;
  owner_role text;
  owner_status text;
  owner_email text;
  owner_is_platform_admin boolean := false;
  owner_subscription_active boolean := false;
  saved_limit integer := 3;
  alert_limit integer := 0;
  saved_count bigint := 0;
  alert_count bigint := 0;
  lock_subject uuid := new.user_id;
  shared_workspace_id uuid;
  enabling_alert boolean := false;
begin
  select coalesce(plan, 'free'), coalesce(role, 'user'),
         coalesce(status, 'active'), email, workspace_id
  into account_plan, account_role, account_status, account_email, workspace_id_value
  from public.users_profile
  where id = new.user_id;

  if not found or account_status <> 'active' then
    raise exception 'An active account is required.' using errcode = '23514';
  end if;

  account_is_platform_admin := account_role = 'admin' and exists (
    select 1 from public.admin_allowlist
    where lower(admin_allowlist.email) = lower(account_email)
  );

  if not account_is_platform_admin then
    select coalesce((
      select plan from public.subscriptions
      where user_id = new.user_id
        and status in ('active', 'trialing')
        and plan in ('pro', 'agency')
      order by updated_at desc
      limit 1
    ), 'free') into account_plan;
    account_role := 'user';
  end if;

  if workspace_id_value is not null
     and not account_is_platform_admin
     and exists (
       select 1 from public.workspace_members
       where workspace_id = workspace_id_value and user_id = new.user_id
     ) then
    select owner_id into workspace_owner_id
    from public.workspaces
    where id = workspace_id_value;

    if workspace_owner_id is not null then
      select coalesce(plan, 'free'), coalesce(role, 'user'),
             coalesce(status, 'active'), email
      into owner_plan, owner_role, owner_status, owner_email
      from public.users_profile
      where id = workspace_owner_id;

      select exists (
        select 1 from public.subscriptions
        where user_id = workspace_owner_id
          and plan = 'agency'
          and status in ('active', 'trialing')
      ) into owner_subscription_active;

      owner_is_platform_admin := owner_status = 'active'
        and owner_role = 'admin'
        and exists (
          select 1 from public.admin_allowlist
          where lower(admin_allowlist.email) = lower(owner_email)
        );

      if owner_status = 'active'
         and (owner_is_platform_admin or (owner_plan = 'agency' and owner_subscription_active)) then
        account_plan := 'agency';
        lock_subject := workspace_owner_id;
        shared_workspace_id := workspace_id_value;
      else
        select coalesce((
          select plan
          from public.subscriptions
          where user_id = new.user_id
            and status in ('active', 'trialing')
            and plan in ('pro', 'agency')
          order by updated_at desc
          limit 1
        ), 'free') into account_plan;
      end if;
    else
      select coalesce((
        select plan
        from public.subscriptions
        where user_id = new.user_id
          and status in ('active', 'trialing')
          and plan in ('pro', 'agency')
        order by updated_at desc
        limit 1
      ), 'free') into account_plan;
    end if;
  elsif workspace_id_value is not null and not account_is_platform_admin then
    select coalesce((
      select plan
      from public.subscriptions
      where user_id = new.user_id
        and status in ('active', 'trialing')
        and plan in ('pro', 'agency')
      order by updated_at desc
      limit 1
    ), 'free') into account_plan;
  end if;

  if account_is_platform_admin then
    return new;
  elsif account_plan = 'agency' then
    saved_limit := 100;
    alert_limit := 50;
  elsif account_plan = 'pro' then
    saved_limit := 25;
    alert_limit := 10;
  else
    account_plan := 'free';
    saved_limit := 3;
    alert_limit := 0;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(lock_subject::text, 4));

  if tg_op = 'INSERT' then
    enabling_alert := new.alert_enabled;
  elsif tg_op = 'UPDATE' then
    enabling_alert := new.alert_enabled and not old.alert_enabled;
  end if;

  if tg_op = 'INSERT' then
    if shared_workspace_id is not null then
      select count(*) into saved_count
      from public.saved_searches as search
      where search.user_id = lock_subject
         or exists (
           select 1 from public.workspace_members as member
           where member.workspace_id = shared_workspace_id
             and member.user_id = search.user_id
         );
    else
      select count(*) into saved_count
      from public.saved_searches
      where user_id = new.user_id;
    end if;

    if saved_count >= saved_limit then
      raise exception 'Saved search limit reached for the % plan.', account_plan
        using
          errcode = '23514',
          detail = format('This plan includes %s saved searches.', saved_limit),
          hint = 'Delete a saved search or upgrade the account plan.';
    end if;
  end if;

  if enabling_alert then
    if shared_workspace_id is not null then
      select count(*) into alert_count
      from public.saved_searches as search
      where search.alert_enabled = true
        and (
          search.user_id = lock_subject
          or exists (
            select 1 from public.workspace_members as member
            where member.workspace_id = shared_workspace_id
              and member.user_id = search.user_id
          )
        );
    else
      select count(*) into alert_count
      from public.saved_searches
      where user_id = new.user_id
        and alert_enabled = true;
    end if;

    if alert_count >= alert_limit then
      raise exception 'Active alert limit reached for the % plan.', account_plan
        using
          errcode = '23514',
          detail = format('This plan includes %s active alerts.', alert_limit),
          hint = case when alert_limit = 0
            then 'Upgrade to Pro to turn on new-business alerts.'
            else 'Turn off an alert or upgrade the account plan.' end;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists saved_searches_enforce_entitlement_insert on public.saved_searches;
create trigger saved_searches_enforce_entitlement_insert
  before insert on public.saved_searches
  for each row execute function public.enforce_saved_search_entitlement();

drop trigger if exists saved_searches_enforce_entitlement_alert on public.saved_searches;
create trigger saved_searches_enforce_entitlement_alert
  before update of alert_enabled on public.saved_searches
  for each row execute function public.enforce_saved_search_entitlement();

create index if not exists saved_searches_user_alert_idx
  on public.saved_searches(user_id, alert_enabled);

create or replace function public.enforce_crm_connection_entitlement()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  account_plan text := 'free';
  account_role text := 'user';
  account_status text := 'active';
  account_email text;
  account_is_platform_admin boolean := false;
  workspace_id_value uuid;
  workspace_owner_id uuid;
  owner_plan text;
  owner_role text;
  owner_status text;
  owner_email text;
  owner_is_platform_admin boolean := false;
  owner_has_agency_subscription boolean := false;
  own_subscription_plan text;
  connection_limit integer := 0;
  connection_count bigint := 0;
begin
  if exists (
    select 1 from public.crm_integrations
    where user_id = new.user_id and crm_type = new.crm_type
  ) then
    return new;
  end if;

  select coalesce(plan, 'free'), coalesce(role, 'user'),
         coalesce(status, 'active'), email, workspace_id
  into account_plan, account_role, account_status, account_email, workspace_id_value
  from public.users_profile
  where id = new.user_id;

  if not found or account_status <> 'active' then
    raise exception 'An active account is required.' using errcode = '23514';
  end if;

  account_is_platform_admin := account_role = 'admin' and exists (
    select 1 from public.admin_allowlist
    where lower(admin_allowlist.email) = lower(account_email)
  );
  if account_is_platform_admin then
    return new;
  end if;

  select plan into own_subscription_plan
  from public.subscriptions
  where user_id = new.user_id
    and status in ('active', 'trialing')
    and plan in ('pro', 'agency')
  order by updated_at desc
  limit 1;
  account_plan := coalesce(own_subscription_plan, 'free');

  if workspace_id_value is not null and exists (
    select 1 from public.workspace_members
    where workspace_id = workspace_id_value and user_id = new.user_id
  ) then
    select owner_id into workspace_owner_id
    from public.workspaces
    where id = workspace_id_value;

    if workspace_owner_id is not null then
      select coalesce(plan, 'free'), coalesce(role, 'user'),
             coalesce(status, 'active'), email
      into owner_plan, owner_role, owner_status, owner_email
      from public.users_profile
      where id = workspace_owner_id;

      owner_is_platform_admin := owner_status = 'active'
        and owner_role = 'admin'
        and exists (
          select 1 from public.admin_allowlist
          where lower(admin_allowlist.email) = lower(owner_email)
        );
      owner_has_agency_subscription := owner_status = 'active'
        and owner_plan = 'agency'
        and exists (
          select 1 from public.subscriptions
          where user_id = workspace_owner_id
            and plan = 'agency'
            and status in ('active', 'trialing')
        );

      if owner_is_platform_admin or owner_has_agency_subscription then
        account_plan := 'agency';
      end if;
    end if;
  end if;

  if account_plan = 'agency' then
    connection_limit := 3;
  elsif account_plan = 'pro' then
    connection_limit := 1;
  else
    connection_limit := 0;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 5));
  select count(*) into connection_count
  from public.crm_integrations
  where user_id = new.user_id;

  if connection_count >= connection_limit then
    raise exception 'CRM connection limit reached for the % plan.', account_plan
      using
        errcode = '23514',
        detail = format('This plan includes %s CRM connections.', connection_limit),
        hint = case when connection_limit = 0
          then 'Upgrade to Pro to connect a CRM.'
          else 'Disconnect a CRM or upgrade the account plan.' end;
  end if;

  return new;
end;
$$;

drop trigger if exists crm_integrations_enforce_entitlement on public.crm_integrations;
create trigger crm_integrations_enforce_entitlement
  before insert on public.crm_integrations
  for each row execute function public.enforce_crm_connection_entitlement();

revoke all on function public.reserve_live_search(uuid) from public, anon;
grant execute on function public.reserve_live_search(uuid) to authenticated, service_role;

-- Replace the previous Free/Pro-only storage fence with a generous Agency
-- ceiling. The per-user lock and duplicate handling are retained.
create or replace function public.enforce_saved_lead_entitlement()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  account_plan text := 'free';
  account_role text := 'user';
  account_status text := 'active';
  account_email text;
  account_is_platform_admin boolean := false;
  workspace_id_value uuid;
  workspace_owner_id uuid;
  owner_plan text;
  owner_role text;
  owner_status text;
  owner_email text;
  owner_is_platform_admin boolean := false;
  owner_has_agency_subscription boolean := false;
  own_subscription_plan text;
  saved_limit integer := 25;
  current_count bigint;
begin
  if new.user_id is null then
    raise exception 'A saved lead must belong to a user.' using errcode = '23502';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));

  if exists (
    select 1 from public.leads
    where user_id = new.user_id and id = new.id
  ) then
    return new;
  end if;

  select coalesce(plan, 'free'), coalesce(role, 'user'),
         coalesce(status, 'active'), email, workspace_id
  into account_plan, account_role, account_status, account_email, workspace_id_value
  from public.users_profile
  where id = new.user_id;

  if not found or account_status <> 'active' then
    raise exception 'An active account is required.' using errcode = '23514';
  end if;

  account_is_platform_admin := account_role = 'admin' and exists (
    select 1 from public.admin_allowlist
    where lower(admin_allowlist.email) = lower(account_email)
  );
  if account_is_platform_admin then
    return new;
  end if;

  select plan into own_subscription_plan
  from public.subscriptions
  where user_id = new.user_id
    and status in ('active', 'trialing')
    and plan in ('pro', 'agency')
  order by updated_at desc
  limit 1;
  account_plan := coalesce(own_subscription_plan, 'free');

  if workspace_id_value is not null and exists (
    select 1 from public.workspace_members
    where workspace_id = workspace_id_value and user_id = new.user_id
  ) then
    select owner_id into workspace_owner_id
    from public.workspaces
    where id = workspace_id_value;

    if workspace_owner_id is not null then
      select coalesce(plan, 'free'), coalesce(role, 'user'),
             coalesce(status, 'active'), email
      into owner_plan, owner_role, owner_status, owner_email
      from public.users_profile
      where id = workspace_owner_id;

      owner_is_platform_admin := owner_status = 'active'
        and owner_role = 'admin'
        and exists (
          select 1 from public.admin_allowlist
          where lower(admin_allowlist.email) = lower(owner_email)
        );
      owner_has_agency_subscription := owner_status = 'active'
        and owner_plan = 'agency'
        and exists (
          select 1 from public.subscriptions
          where user_id = workspace_owner_id
            and plan = 'agency'
            and status in ('active', 'trialing')
        );

      if owner_is_platform_admin or owner_has_agency_subscription then
        account_plan := 'agency';
      end if;
    end if;
  end if;

  if account_plan = 'agency' then
    saved_limit := 10000;
  elsif account_plan = 'pro' then
    saved_limit := 1000;
  else
    saved_limit := 25;
  end if;

  select count(*) into current_count
  from public.leads
  where user_id = new.user_id;

  if current_count >= saved_limit then
    raise exception 'Saved lead limit reached for the % plan.', account_plan
      using
        errcode = '23514',
        detail = format('This plan allows %s saved leads.', saved_limit),
        hint = 'Remove a saved lead or upgrade the account plan.';
  end if;

  return new;
end;
$$;

drop trigger if exists leads_enforce_saved_entitlement on public.leads;
create trigger leads_enforce_saved_entitlement
  before insert on public.leads
  for each row execute function public.enforce_saved_lead_entitlement();

comment on function public.reserve_live_search(uuid) is
  'Atomically reserves one provider-backed search against a user or shared Agency workspace allowance.';

-- Five total seats (owner included) per paid Agency workspace. The transaction
-- lock prevents two invitations accepted at the same moment from both taking
-- the final seat. Platform-owner workspaces remain exempt.
create or replace function public.enforce_workspace_seat_limit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  workspace_owner uuid;
  owner_role text := 'user';
  owner_status text := 'active';
  owner_email text;
  owner_plan text := 'free';
  owner_is_platform_admin boolean := false;
  owner_has_agency_subscription boolean := false;
  current_seats bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.workspace_id::text, 2));

  select owner_id into workspace_owner
  from public.workspaces
  where id = new.workspace_id;

  select coalesce(role, 'user'), coalesce(status, 'active'), email, coalesce(plan, 'free')
  into owner_role, owner_status, owner_email, owner_plan
  from public.users_profile
  where id = workspace_owner;

  owner_is_platform_admin := owner_status = 'active'
    and owner_role = 'admin'
    and exists (
      select 1 from public.admin_allowlist
      where lower(admin_allowlist.email) = lower(owner_email)
    );
  owner_has_agency_subscription := owner_status = 'active'
    and owner_plan = 'agency'
    and exists (
      select 1 from public.subscriptions
      where user_id = workspace_owner
        and plan = 'agency'
        and status in ('active', 'trialing')
    );

  if owner_is_platform_admin then
    return new;
  end if;

  if not owner_has_agency_subscription then
    raise exception 'An active Agency plan is required.'
      using errcode = '23514', hint = 'Renew Agency before adding a workspace member.';
  end if;

  if exists (
    select 1 from public.workspace_members
    where workspace_id = new.workspace_id and user_id = new.user_id
  ) then
    return new;
  end if;

  -- The owner is one logical seat even if a legacy workspace is missing its
  -- denormalized owner membership row. Restoring that row never adds a person.
  if new.user_id = workspace_owner then
    return new;
  end if;

  select 1 + count(*) into current_seats
  from public.workspace_members
  where workspace_id = new.workspace_id
    and user_id <> workspace_owner;

  if current_seats >= 5 then
    raise exception 'Agency workspace seat limit reached.'
      using
        errcode = '23514',
        detail = 'Agency includes five total seats.',
        hint = 'Remove a member before accepting another invitation.';
  end if;

  return new;
end;
$$;

drop trigger if exists workspace_members_enforce_seat_limit on public.workspace_members;
create trigger workspace_members_enforce_seat_limit
  before insert on public.workspace_members
  for each row execute function public.enforce_workspace_seat_limit();

create or replace function public.protect_workspace_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.role() = 'authenticated'
     and pg_trigger_depth() <= 1
     and old.user_id = (
    select owner_id from public.workspaces where id = old.workspace_id
  ) then
    raise exception 'The workspace owner membership cannot be removed.'
      using errcode = '23514';
  end if;
  return old;
end;
$$;

drop trigger if exists workspace_members_protect_owner_delete on public.workspace_members;
create trigger workspace_members_protect_owner_delete
  before delete on public.workspace_members
  for each row execute function public.protect_workspace_owner_membership();

-- Workspace access is inherited, but a copied users_profile.plan must never
-- outlive the owner's entitlement. Keep the legacy profile column synchronized
-- for routes/UI that have not yet moved to dynamic effective-access lookup.
-- When an owner loses Agency (or is deactivated), each member falls back to
-- their own active subscription, if any, otherwise Free.
create or replace function public.sync_workspace_member_plans()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  owned_workspace_id uuid;
  inherited_plan text;
  owner_is_platform_admin boolean;
  owner_has_agency_subscription boolean;
begin
  if new.plan is not distinct from old.plan
     and new.role is not distinct from old.role
     and new.status is not distinct from old.status then
    return new;
  end if;

  for owned_workspace_id in
    select id from public.workspaces where owner_id = new.id
  loop
    perform pg_advisory_xact_lock(hashtextextended(owned_workspace_id::text, 3));

    owner_is_platform_admin := new.status = 'active'
      and new.role = 'admin'
      and exists (
        select 1 from public.admin_allowlist
        where lower(admin_allowlist.email) = lower(new.email)
      );
    owner_has_agency_subscription := new.status = 'active'
      and new.plan = 'agency'
      and exists (
        select 1 from public.subscriptions
        where user_id = new.id
          and plan = 'agency'
          and status in ('active', 'trialing')
      );
    inherited_plan := case
      when owner_is_platform_admin or owner_has_agency_subscription then 'agency'
      else null
    end;

    update public.users_profile as member
    set
      plan = coalesce(
        inherited_plan,
        (
          select subscription.plan
          from public.subscriptions as subscription
          where subscription.user_id = member.id
            and subscription.status in ('active', 'trialing')
            and subscription.plan in ('pro', 'agency')
          order by subscription.updated_at desc
          limit 1
        ),
        'free'
      ),
      updated_at = now()
    where member.id in (
      select workspace_member.user_id
      from public.workspace_members as workspace_member
      where workspace_member.workspace_id = owned_workspace_id
        and workspace_member.user_id <> new.id
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists users_profile_sync_workspace_member_plans on public.users_profile;
create trigger users_profile_sync_workspace_member_plans
  after update of plan, role, status on public.users_profile
  for each row execute function public.sync_workspace_member_plans();

-- Repair stale copied plans immediately when this migration is applied.
do $$
declare
  owner_profile public.users_profile%rowtype;
  inherited_owner_plan text;
begin
  for owner_profile in
    select profile.*
    from public.users_profile as profile
    where exists (select 1 from public.workspaces where owner_id = profile.id)
  loop
    -- The AFTER trigger only handles future entitlement changes, so repair
    -- existing member rows directly during the initial migration.
    inherited_owner_plan := case
      when owner_profile.status = 'active'
           and owner_profile.role = 'admin'
           and exists (
             select 1 from public.admin_allowlist
             where lower(admin_allowlist.email) = lower(owner_profile.email)
           )
        then 'agency'
      when owner_profile.status = 'active'
           and owner_profile.plan = 'agency'
           and exists (
             select 1 from public.subscriptions
             where user_id = owner_profile.id
               and plan = 'agency'
               and status in ('active', 'trialing')
           )
        then 'agency'
      else null
    end;

    update public.users_profile as member
    set
      plan = coalesce(
        inherited_owner_plan,
        (
          select subscription.plan
          from public.subscriptions as subscription
          where subscription.user_id = member.id
            and subscription.status in ('active', 'trialing')
            and subscription.plan in ('pro', 'agency')
          order by subscription.updated_at desc
          limit 1
        ),
        'free'
      ),
      updated_at = now()
    where member.id in (
      select workspace_member.user_id
      from public.workspace_members as workspace_member
      join public.workspaces as workspace
        on workspace.id = workspace_member.workspace_id
      where workspace.owner_id = owner_profile.id
        and workspace_member.user_id <> owner_profile.id
    );
  end loop;
end;
$$;

-- ============ 20260816_saved_lead_count_sync.sql ============

-- Keep usage_limits.saved_leads_count aligned with the authoritative leads rows.
--
-- The save route already counts public.leads directly when enforcing Free (25)
-- and Pro (1,000), so a stale usage_limits value cannot unlock extra storage.
-- Dashboard, Settings and Owner analytics do read this counter, however. This
-- migration backfills it once and then maintains it transactionally for every
-- insert/delete (including cascades and direct RLS-authorized deletes).
--
-- This migration changes no plan entitlements; it mirrors whichever limits the
-- shared plan policy and save-enforcement migration define.

create or replace function public.sync_saved_lead_usage_count()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.usage_limits (user_id, saved_leads_count, updated_at)
    values (new.user_id, 1, now())
    on conflict (user_id) do update
      set saved_leads_count = public.usage_limits.saved_leads_count + 1,
          updated_at = now();
    return null;
  end if;

  if tg_op = 'DELETE' then
    update public.usage_limits
       set saved_leads_count = greatest(saved_leads_count - 1, 0),
           updated_at = now()
     where user_id = old.user_id;
    return null;
  end if;

  -- user_id is not changed by the product, but keeping this branch correct
  -- prevents analytics drift if an owner performs a controlled data repair.
  if old.user_id is distinct from new.user_id then
    update public.usage_limits
       set saved_leads_count = greatest(saved_leads_count - 1, 0),
           updated_at = now()
     where user_id = old.user_id;

    insert into public.usage_limits (user_id, saved_leads_count, updated_at)
    values (new.user_id, 1, now())
    on conflict (user_id) do update
      set saved_leads_count = public.usage_limits.saved_leads_count + 1,
          updated_at = now();
  end if;
  return null;
end;
$$;

revoke all on function public.sync_saved_lead_usage_count() from public;

drop trigger if exists leads_sync_saved_usage_insert_delete on public.leads;
create trigger leads_sync_saved_usage_insert_delete
  after insert or delete on public.leads
  for each row execute function public.sync_saved_lead_usage_count();

drop trigger if exists leads_sync_saved_usage_owner_change on public.leads;
create trigger leads_sync_saved_usage_owner_change
  after update of user_id on public.leads
  for each row
  when (old.user_id is distinct from new.user_id)
  execute function public.sync_saved_lead_usage_count();

-- Correct any pre-existing drift. Taking the same per-user advisory lock as the
-- storage fence makes the backfill safe if a save arrives while this migration
-- is running: either the save lands first and is included, or its trigger
-- increments the freshly backfilled value after this transaction releases.
do $$
declare
  subject_id uuid;
  actual_count integer;
begin
  for subject_id in
    select user_id from public.usage_limits
    union
    select user_id from public.leads where user_id is not null
  loop
    perform pg_advisory_xact_lock(hashtextextended(subject_id::text, 0));

    select count(*)::integer
      into actual_count
      from public.leads
     where user_id = subject_id;

    insert into public.usage_limits (user_id, saved_leads_count, updated_at)
    values (subject_id, actual_count, now())
    on conflict (user_id) do update
      set saved_leads_count = excluded.saved_leads_count,
          updated_at = now();
  end loop;
end;
$$;

comment on function public.sync_saved_lead_usage_count() is
  'Maintains usage_limits.saved_leads_count from authoritative leads rows.';

-- ============ 20260817_feature_usage.sql ============

-- Atomic monthly fair-use metering for signed-in, cost-bearing lead features.
--
-- Limits per calendar month (UTC):
--                         Free   Pro   Agency (shared by workspace)
--   AI proposals             3    50      250
--   Market gap analyses      1    10       50
--   Competitor analyses      3    25      100
--   Public audit reports     3    25      100
--   Website health checks   10   250    1,000
--
-- Allowlisted platform admins are exempt. Agency members reserve against the
-- owner only when that owner is an allowlisted admin or has both an Agency
-- profile and an active/trialing Agency subscription. A copied plan='agency'
-- is never trusted when the workspace/owner entitlement is stale.
-- The RPC is service-role-only: customers cannot call it directly to drain a
-- shared workspace ledger or bypass the API routes' burst controls.
--
-- The RPC reserves before the upstream operation. This keeps concurrent calls
-- within the limit without holding a database transaction open across a network
-- request. Consequently, an attempted provider call that later fails still uses
-- its reservation, just like most provider-side quotas.

create table if not exists public.feature_usage_monthly (
  subject_user_id uuid not null references public.users_profile(id) on delete cascade,
  feature text not null check (
    feature in ('ai_proposal', 'market_gaps', 'competitors', 'audit_reports', 'website_health')
  ),
  period_start date not null,
  used integer not null default 0 check (used >= 0),
  last_actor_user_id uuid references public.users_profile(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (subject_user_id, feature, period_start)
);

create index if not exists feature_usage_monthly_period_idx
  on public.feature_usage_monthly (period_start);

alter table public.feature_usage_monthly enable row level security;

-- Usage is exposed through the narrowly scoped RPC only. Owner analytics can
-- read it with the service role; browsers cannot alter or enumerate the ledger.
revoke all on table public.feature_usage_monthly from public, anon, authenticated;
grant all on table public.feature_usage_monthly to service_role;

create or replace function public.reserve_feature_usage(uid uuid, feature_name text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller_id uuid := auth.uid();
  requested_id uuid := coalesce(caller_id, uid);
  subject_id uuid := requested_id;
  account_plan text := 'free';
  account_role text := 'user';
  account_status text := 'active';
  account_email text;
  account_is_platform_admin boolean := false;
  workspace_id_value uuid;
  workspace_owner_id uuid;
  owner_plan text;
  owner_role text;
  owner_status text;
  owner_email text;
  owner_is_platform_admin boolean := false;
  owner_has_agency_subscription boolean := false;
  own_subscription_plan text;
  monthly_limit integer;
  current_used integer := 0;
  period_start_value date := date_trunc('month', now() at time zone 'utc')::date;
  reset_at_value timestamptz :=
    (date_trunc('month', now() at time zone 'utc') + interval '1 month') at time zone 'utc';
begin
  if feature_name is null or feature_name not in (
    'ai_proposal',
    'market_gaps',
    'competitors',
    'audit_reports',
    'website_health'
  ) then
    return jsonb_build_object('allowed', false, 'reason', 'invalid_feature');
  end if;

  if requested_id is null then
    return jsonb_build_object('allowed', false, 'reason', 'unauthorized');
  end if;

  select
    coalesce(plan, 'free'),
    coalesce(role, 'user'),
    coalesce(status, 'active'),
    email,
    workspace_id
  into account_plan, account_role, account_status, account_email, workspace_id_value
  from public.users_profile
  where id = requested_id;

  if not found or account_status <> 'active' then
    return jsonb_build_object('allowed', false, 'reason', 'inactive');
  end if;

  account_is_platform_admin := account_role = 'admin' and exists (
    select 1
    from public.admin_allowlist
    where lower(admin_allowlist.email) = lower(account_email)
  );

  -- Never grant from a stale copied/profile plan. Paid access requires a live
  -- subscription; a valid Agency workspace may override this baseline below.
  if not account_is_platform_admin then
    own_subscription_plan := null;
    select plan into own_subscription_plan
    from public.subscriptions
    where user_id = requested_id
      and status in ('active', 'trialing')
      and plan in ('pro', 'agency')
    order by updated_at desc
    limit 1;
    account_plan := coalesce(own_subscription_plan, 'free');
    account_role := 'user';
  end if;

  -- Resolve Agency membership to its owner. Profile plan alone is not billing
  -- proof: the owner must either be a real allowlisted platform admin, or have
  -- both plan='agency' and an active/trialing Agency subscription. Otherwise
  -- fall back to the caller's own active subscription (or Free).
  if workspace_id_value is not null
     and not account_is_platform_admin
     and exists (
       select 1 from public.workspace_members
       where workspace_id = workspace_id_value and user_id = requested_id
     ) then
    select owner_id into workspace_owner_id
    from public.workspaces
    where id = workspace_id_value;

    if workspace_owner_id is not null then
      select
        coalesce(plan, 'free'),
        coalesce(role, 'user'),
        coalesce(status, 'active'),
        email
      into owner_plan, owner_role, owner_status, owner_email
      from public.users_profile
      where id = workspace_owner_id;

      owner_is_platform_admin := owner_status = 'active'
        and owner_role = 'admin'
        and exists (
          select 1
          from public.admin_allowlist
          where lower(admin_allowlist.email) = lower(owner_email)
        );

      owner_has_agency_subscription := owner_status = 'active'
        and owner_plan = 'agency'
        and exists (
          select 1
          from public.subscriptions
          where user_id = workspace_owner_id
            and plan = 'agency'
            and status in ('active', 'trialing')
        );

      if owner_is_platform_admin or owner_has_agency_subscription then
        subject_id := workspace_owner_id;
        account_plan := 'agency';
      else
        own_subscription_plan := null;
        select plan into own_subscription_plan
        from public.subscriptions
        where user_id = requested_id
          and status in ('active', 'trialing')
          and plan in ('pro', 'agency')
        order by updated_at desc
        limit 1;

        subject_id := requested_id;
        account_plan := coalesce(own_subscription_plan, 'free');
        account_role := 'user';
      end if;
    else
      own_subscription_plan := null;
      select plan into own_subscription_plan
      from public.subscriptions
      where user_id = requested_id
        and status in ('active', 'trialing')
        and plan in ('pro', 'agency')
      order by updated_at desc
      limit 1;

      subject_id := requested_id;
      account_plan := coalesce(own_subscription_plan, 'free');
      account_role := 'user';
    end if;
  elsif workspace_id_value is not null and not account_is_platform_admin then
    own_subscription_plan := null;
    select plan into own_subscription_plan
    from public.subscriptions
    where user_id = requested_id
      and status in ('active', 'trialing')
      and plan in ('pro', 'agency')
    order by updated_at desc
    limit 1;

    subject_id := requested_id;
    account_plan := coalesce(own_subscription_plan, 'free');
    account_role := 'user';
  end if;

  if account_is_platform_admin then
    return jsonb_build_object(
      'allowed', true,
      'feature', feature_name,
      'reason', null,
      'plan', 'agency',
      'subjectUserId', subject_id,
      'used', 0,
      'limit', null,
      'remaining', null,
      'resetAt', reset_at_value,
      'upgradeRequired', false
    );
  end if;

  account_plan := case
    when account_plan = 'agency' then 'agency'
    when account_plan = 'pro' then 'pro'
    else 'free'
  end;

  monthly_limit := case feature_name
    when 'ai_proposal' then case account_plan when 'agency' then 250 when 'pro' then 50 else 3 end
    when 'market_gaps' then case account_plan when 'agency' then 50 when 'pro' then 10 else 1 end
    when 'competitors' then case account_plan when 'agency' then 100 when 'pro' then 25 else 3 end
    when 'audit_reports' then case account_plan when 'agency' then 100 when 'pro' then 25 else 3 end
    when 'website_health' then case account_plan when 'agency' then 1000 when 'pro' then 250 else 10 end
  end;

  -- The lock key includes subject, feature, and month. Parallel calls from
  -- different Agency seats therefore serialize only when they share quota.
  perform pg_advisory_xact_lock(
    hashtextextended(
      subject_id::text || ':' || feature_name || ':' || period_start_value::text,
      17
    )
  );

  insert into public.feature_usage_monthly (
    subject_user_id,
    feature,
    period_start,
    used,
    last_actor_user_id
  ) values (
    subject_id,
    feature_name,
    period_start_value,
    0,
    requested_id
  )
  on conflict (subject_user_id, feature, period_start) do nothing;

  select used into current_used
  from public.feature_usage_monthly
  where subject_user_id = subject_id
    and feature = feature_name
    and period_start = period_start_value
  for update;

  if current_used >= monthly_limit then
    return jsonb_build_object(
      'allowed', false,
      'feature', feature_name,
      'reason', 'monthly_limit',
      'plan', account_plan,
      'subjectUserId', subject_id,
      'used', current_used,
      'limit', monthly_limit,
      'remaining', 0,
      'resetAt', reset_at_value,
      'upgradeRequired', account_plan <> 'agency'
    );
  end if;

  update public.feature_usage_monthly
  set
    used = used + 1,
    last_actor_user_id = requested_id,
    updated_at = now()
  where subject_user_id = subject_id
    and feature = feature_name
    and period_start = period_start_value
  returning used into current_used;

  return jsonb_build_object(
    'allowed', true,
    'feature', feature_name,
    'reason', null,
    'plan', account_plan,
    'subjectUserId', subject_id,
    'used', current_used,
    'limit', monthly_limit,
    'remaining', greatest(monthly_limit - current_used, 0),
    'resetAt', reset_at_value,
    'upgradeRequired', false
  );
end;
$$;

revoke all on function public.reserve_feature_usage(uuid, text) from public, anon, authenticated;
grant execute on function public.reserve_feature_usage(uuid, text) to service_role;

comment on table public.feature_usage_monthly is
  'Durable UTC calendar-month usage ledger for signed-in cost-bearing features.';

comment on function public.reserve_feature_usage(uuid, text) is
  'Atomically reserves one monthly feature unit, pooling active Agency workspaces by owner.';

-- ============ 20260818_email_credits.sql ============

-- Durable Email Finder credits, shared at the billing-owner level.
--
-- Product policy:
--   Free   5 lifetime credits
--   Pro    100 credits per calendar month (20 total during a trial)
--   Agency 500 shared credits per calendar month (50 total during a trial)
--   Purchased packs do not reset. They are spent after included credits.
--
-- All mutations happen through service-role-only RPCs. The API resolves an
-- Agency member to the workspace owner before calling these functions, which
-- prevents every invited seat from receiving a separate allowance.

create table if not exists public.email_credit_accounts (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  included_balance integer not null default 0 check (included_balance >= 0),
  -- This may be negative after a refund/chargeback if purchased credits were
  -- already used. The debt offsets future included or purchased credits.
  purchased_balance integer not null default 0,
  allowance_key text,
  allowance_plan text not null default 'free'
    check (allowance_plan in ('free', 'pro', 'agency')),
  allowance_size integer not null default 0 check (allowance_size >= 0),
  allowance_ends_at timestamptz,
  -- Stripe event.created (seconds) when the allowance came from a webhook.
  -- Lazy API syncs leave this unchanged, so delayed older webhook deliveries
  -- cannot roll a newer trial/plan/cancellation decision backward.
  allowance_version bigint,
  -- Bumped on every allowance key transition. It makes the expire/restore audit
  -- rows unique per transition, so an account that moves off a period key and
  -- back again (a recovering past_due, an out-of-order webhook) records every
  -- move instead of silently colliding on an idempotency key.
  allowance_epoch bigint not null default 0,
  free_lifetime_granted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- `create table if not exists` above is a no-op against a database that already
-- has an earlier revision of this migration, so later columns are added here.
-- Both statements are idempotent and safe to re-run inside one transaction.
alter table public.email_credit_accounts
  add column if not exists allowance_epoch bigint not null default 0;

create table if not exists public.email_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  entry_type text not null check (entry_type in (
    'allowance_grant',
    'allowance_expire',
    'lookup_charge',
    'lookup_refund',
    'pack_grant',
    'pack_adjustment'
  )),
  included_delta integer not null default 0,
  purchased_delta integer not null default 0,
  idempotency_key text not null,
  lookup_domain text,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (owner_id, idempotency_key)
);

create index if not exists email_credit_ledger_owner_created_idx
  on public.email_credit_ledger (owner_id, created_at desc);

-- Answers "has this owner already paid for this domain?" on the cached-read
-- path without scanning the owner's whole ledger.
create index if not exists email_credit_ledger_owner_domain_idx
  on public.email_credit_ledger (owner_id, lookup_domain)
  where lookup_domain is not null;

-- A global, server-only cache prevents the same domain from consuming another
-- LeadZipp credit or another Hunter lookup. Successful provider results are
-- refreshed after 90 days so stale contacts do not live forever. Guesses have
-- a shorter expiry so a transient no-result does not permanently downgrade a
-- domain to info@domain.
create table if not exists public.email_lookup_cache (
  domain text primary key,
  state text not null check (state in ('pending', 'found', 'guessed')),
  email text,
  confidence text check (confidence is null or confidence in ('verified', 'likely', 'guessed')),
  source text check (source is null or source in ('hunter', 'guess')),
  claim_token uuid,
  completion_token uuid,
  reservation_ledger_id uuid references public.email_credit_ledger(id) on delete set null,
  claimed_by uuid references auth.users(id) on delete set null,
  lease_expires_at timestamptz,
  result_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (state = 'pending' and claim_token is not null and lease_expires_at is not null)
    or
    (state in ('found', 'guessed') and email is not null and confidence is not null and source is not null)
  )
);

create table if not exists public.email_credit_purchases (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  stripe_checkout_session_id text not null unique,
  stripe_payment_intent_id text not null unique,
  stripe_price_id text not null,
  pack_slug text not null,
  credits integer not null check (credits > 0),
  amount_paid integer not null check (amount_paid > 0),
  currency text not null,
  revoked_credits integer not null default 0 check (revoked_credits >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Logical refund/dispute sources. The adjustment RPC derives the effective
-- clawback from active sources, avoiding a double clawback when a charge is
-- both disputed and refunded.
create table if not exists public.email_credit_purchase_adjustments (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.email_credit_purchases(id) on delete cascade,
  source_type text not null check (source_type in ('refund', 'dispute')),
  source_id text not null,
  amount_cents integer not null check (amount_cents >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (purchase_id, source_type, source_id)
);

alter table public.email_credit_accounts enable row level security;
alter table public.email_credit_ledger enable row level security;
alter table public.email_lookup_cache enable row level security;
alter table public.email_credit_purchases enable row level security;
alter table public.email_credit_purchase_adjustments enable row level security;

-- There are intentionally no client policies. Balance, ledger, cached contact
-- data and purchase rows are exposed only through authenticated app routes.
revoke all on public.email_credit_accounts from anon, authenticated;
revoke all on public.email_credit_ledger from anon, authenticated;
revoke all on public.email_lookup_cache from anon, authenticated;
revoke all on public.email_credit_purchases from anon, authenticated;
revoke all on public.email_credit_purchase_adjustments from anon, authenticated;

-- Synchronize the included allowance. The server supplies the already-resolved
-- billing owner, effective plan and an immutable period key. Short advisory
-- locking makes resets safe against simultaneous lookups and Stripe retries.
create or replace function public.sync_email_credit_allowance(
  p_owner_id uuid,
  p_plan text,
  p_allowance_key text,
  p_allowance_size integer,
  p_allowance_ends_at timestamptz default null,
  p_source_version bigint default null
)
returns table (
  included_remaining integer,
  purchased_remaining integer,
  total_remaining integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  account public.email_credit_accounts%rowtype;
  old_included integer;
  grant_amount integer := 0;
  restored_amount integer := 0;
  already_granted boolean := false;
  new_epoch bigint := 1;
  normalized_plan text;
begin
  if p_owner_id is null
     or p_allowance_key is null
     or length(p_allowance_key) = 0
     or p_allowance_size < 0
     or (p_source_version is not null and p_source_version < 0) then
    raise exception 'Invalid email-credit allowance input.' using errcode = '22023';
  end if;

  normalized_plan := case
    when p_plan in ('pro', 'agency') then p_plan
    else 'free'
  end;

  -- All ledger operations take this short global lock. Provider network calls
  -- happen outside SQL, so this only serializes millisecond-sized balance
  -- transactions while guaranteeing one lock order across cross-owner cache
  -- lease recovery, grants, refunds and disputes.
  perform pg_advisory_xact_lock(hashtextextended('email-credit-ledger', 0));

  insert into public.email_credit_accounts (owner_id)
  values (p_owner_id)
  on conflict (owner_id) do nothing;

  select * into account
  from public.email_credit_accounts
  where owner_id = p_owner_id
  for update;

  if p_source_version is not null
     and account.allowance_version is not null
     and p_source_version < account.allowance_version then
    return query
    select a.included_balance,
           greatest(a.purchased_balance, 0),
           greatest(a.included_balance + a.purchased_balance, 0)
    from public.email_credit_accounts a
    where a.owner_id = p_owner_id;
    return;
  end if;

  -- Once webhooks establish an entitlement, a lazy request may only advance
  -- the same paid plan into a later calendar month. This prevents a stale
  -- local subscription row from undoing a newer cancellation/plan event whose
  -- event watermark the ledger has already seen.
  if p_source_version is null
     and account.allowance_version is not null
     and account.allowance_key is distinct from p_allowance_key
     and not (
       (
         account.allowance_plan = normalized_plan
         and normalized_plan in ('pro', 'agency')
         and account.allowance_key ~ ('^' || normalized_plan || ':month:[0-9]{4}-[0-9]{2}$')
         and p_allowance_key ~ ('^' || normalized_plan || ':month:[0-9]{4}-[0-9]{2}$')
         and right(p_allowance_key, 7) > right(account.allowance_key, 7)
       )
       -- The app supplies this key only after verifying role + locked email
       -- allowlist with the service role. Admin grants must also roll monthly.
       or (
         normalized_plan = 'agency'
         and p_allowance_key ~ '^agency:admin:[0-9]{4}-[0-9]{2}$'
       )
       -- Removing the allowlist row must revoke the admin allowance without
       -- waiting for a Stripe event.
       or (
         normalized_plan = 'free'
         and account.allowance_key ~ '^agency:admin:[0-9]{4}-[0-9]{2}$'
         and p_allowance_key = 'free:lifetime'
       )
     ) then
    return query
    select a.included_balance,
           greatest(a.purchased_balance, 0),
           greatest(a.included_balance + a.purchased_balance, 0)
    from public.email_credit_accounts a
    where a.owner_id = p_owner_id;
    return;
  end if;

  if account.allowance_key is distinct from p_allowance_key then
    old_included := account.included_balance;
    new_epoch := coalesce(account.allowance_epoch, 0) + 1;

    if old_included <> 0 and account.allowance_key is not null then
      insert into public.email_credit_ledger (
        owner_id, entry_type, included_delta, idempotency_key, metadata
      ) values (
        p_owner_id,
        'allowance_expire',
        -old_included,
        'allowance-expire:' || new_epoch::text || ':' || account.allowance_key
          || ':to:' || p_allowance_key,
        jsonb_build_object(
          'from', account.allowance_key,
          'to', p_allowance_key,
          'epoch', new_epoch
        )
      ) on conflict (owner_id, idempotency_key) do nothing;
    end if;

    already_granted := exists (
      select 1
      from public.email_credit_ledger
      where owner_id = p_owner_id
        and idempotency_key = 'allowance-grant:' || p_allowance_key
    );

    if normalized_plan = 'free' then
      -- Free credits are granted only once over the life of an account. A user
      -- cannot downgrade and upgrade repeatedly to mint five more.
      if account.free_lifetime_granted_at is null and not already_granted then
        grant_amount := p_allowance_size;
      end if;
    elsif not already_granted then
      -- A period key is a one-time grant. If account state ever moves away
      -- from a period and back (for example, out-of-order Stripe events), do
      -- not mint the full allowance twice.
      grant_amount := p_allowance_size;
    end if;

    -- Coming back to a period that was already granted must RESTORE what was
    -- left of it, never zero it. A non-active Stripe status is frequently
    -- transient (past_due that later settles, a webhook blip, an incomplete
    -- payment that completes): it moves the account onto 'free:lifetime' and
    -- then straight back. Setting the balance to the new grant, which is 0 for
    -- an already-granted period, permanently destroyed allowance the customer
    -- had paid for.
    --
    -- The remaining amount is recomputed from the immutable ledger instead of a
    -- cached figure, so repeated flapping neither mints nor loses credits: it
    -- is exactly the grant for this key, minus the lookups charged against it,
    -- plus the refunds of those lookups. Restore rows are keyed separately and
    -- are therefore never counted twice.
    if grant_amount = 0 then
      select coalesce(sum(
        case
          when l.entry_type = 'allowance_grant'
            and l.idempotency_key = 'allowance-grant:' || p_allowance_key
            then l.included_delta
          when l.entry_type = 'lookup_charge'
            and l.metadata->>'allowance_key' = p_allowance_key
            then l.included_delta
          when l.entry_type = 'lookup_refund'
            and exists (
              select 1
              from public.email_credit_ledger c
              where c.owner_id = l.owner_id
                and c.id::text = l.metadata->>'reservation_id'
                and c.metadata->>'allowance_key' = p_allowance_key
            )
            then l.included_delta
          else 0
        end
      ), 0)
      into restored_amount
      from public.email_credit_ledger l
      where l.owner_id = p_owner_id;

      -- Never hand back more than the period was ever worth.
      restored_amount := least(greatest(coalesce(restored_amount, 0), 0), p_allowance_size);
    end if;

    update public.email_credit_accounts
    set included_balance = grant_amount + restored_amount,
        allowance_epoch = new_epoch,
        allowance_key = p_allowance_key,
        allowance_plan = normalized_plan,
        allowance_size = p_allowance_size,
        allowance_ends_at = p_allowance_ends_at,
        allowance_version = case
          when p_source_version is null then allowance_version
          else greatest(coalesce(allowance_version, p_source_version), p_source_version)
        end,
        free_lifetime_granted_at = case
          when normalized_plan = 'free' and free_lifetime_granted_at is null
            then now()
          else free_lifetime_granted_at
        end,
        updated_at = now()
    where owner_id = p_owner_id;

    if grant_amount <> 0 then
      insert into public.email_credit_ledger (
        owner_id, entry_type, included_delta, idempotency_key, metadata
      ) values (
        p_owner_id,
        'allowance_grant',
        grant_amount,
        'allowance-grant:' || p_allowance_key,
        jsonb_build_object('plan', normalized_plan, 'allowance', grant_amount)
      ) on conflict (owner_id, idempotency_key) do nothing;
    end if;

    -- Audit the restore separately from the one-time grant. The epoch keeps the
    -- key unique per transition, and the distinct key prefix keeps this row out
    -- of the recomputation above.
    if restored_amount <> 0 then
      insert into public.email_credit_ledger (
        owner_id, entry_type, included_delta, idempotency_key, metadata
      ) values (
        p_owner_id,
        'allowance_grant',
        restored_amount,
        'allowance-restore:' || new_epoch::text || ':' || p_allowance_key,
        jsonb_build_object(
          'plan', normalized_plan,
          'restored', restored_amount,
          'epoch', new_epoch,
          'reason', 'period_reentered'
        )
      ) on conflict (owner_id, idempotency_key) do nothing;
    end if;
  elsif p_source_version is not null then
    -- Even an idempotent repeat advances the event watermark. Otherwise a
    -- later-arriving older event with a different key could still roll back.
    update public.email_credit_accounts
    set allowance_version = greatest(coalesce(allowance_version, p_source_version), p_source_version),
        allowance_ends_at = p_allowance_ends_at,
        updated_at = now()
    where owner_id = p_owner_id;
  end if;

  return query
  select a.included_balance,
         greatest(a.purchased_balance, 0),
         greatest(a.included_balance + a.purchased_balance, 0)
  from public.email_credit_accounts a
  where a.owner_id = p_owner_id;
end;
$$;

-- Lock-free read used on every balance request. It also returns the stored
-- allowance key so the API can tell whether a period roll is actually due, and
-- skip the locking sync when it is not.
--
-- The column list changed after the first revision of this file, and Postgres
-- refuses to change an existing function's result type in place, so drop first.
-- Nothing depends on this function, and the grants below are re-applied.
drop function if exists public.get_email_credit_balance(uuid);

create or replace function public.get_email_credit_balance(p_owner_id uuid)
returns table (
  included_remaining integer,
  purchased_remaining integer,
  credit_debt integer,
  total_remaining integer,
  allowance_plan text,
  allowance_key text,
  allowance_size integer,
  allowance_ends_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select included_balance,
         greatest(purchased_balance, 0),
         greatest(-purchased_balance, 0),
         greatest(included_balance + purchased_balance, 0),
         allowance_plan,
         allowance_key,
         allowance_size,
         allowance_ends_at
  from public.email_credit_accounts
  where owner_id = p_owner_id;
$$;

-- Refund exactly the bucket used by a reservation. Idempotency makes this safe
-- from both an API catch/finally path and a later stale-lease recovery.
create or replace function public.refund_email_lookup_credit(
  p_reservation_id uuid,
  p_reason text default 'lookup_failed'
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  charge public.email_credit_ledger%rowtype;
  refund_key text;
  new_total integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('email-credit-ledger', 0));

  select * into charge
  from public.email_credit_ledger
  where id = p_reservation_id
    and entry_type = 'lookup_charge'
  for update;

  if not found then
    return null;
  end if;

  refund_key := 'lookup-refund:' || charge.id::text;
  if exists (
    select 1 from public.email_credit_ledger
    where owner_id = charge.owner_id and idempotency_key = refund_key
  ) then
    select greatest(included_balance + purchased_balance, 0)
      into new_total
    from public.email_credit_accounts
    where owner_id = charge.owner_id;
    return new_total;
  end if;

  -- Included credits belong to one non-rollover period. If that period reset
  -- while the provider call was in flight, do not resurrect the expired unit.
  -- Purchased credits persist, so they are always restored.
  update public.email_credit_accounts a
  set included_balance = included_balance + case
        when charge.included_delta <> 0
          and charge.metadata->>'allowance_key' = a.allowance_key
          then -charge.included_delta
        else 0
      end,
      purchased_balance = purchased_balance - charge.purchased_delta,
      updated_at = now()
  where owner_id = charge.owner_id;

  insert into public.email_credit_ledger (
    owner_id, actor_user_id, entry_type, included_delta, purchased_delta,
    idempotency_key, lookup_domain, metadata
  ) values (
    charge.owner_id,
    charge.actor_user_id,
    'lookup_refund',
    case
      when charge.included_delta <> 0 and exists (
        select 1 from public.email_credit_accounts a
        where a.owner_id = charge.owner_id
          and charge.metadata->>'allowance_key' = a.allowance_key
      ) then -charge.included_delta
      else 0
    end,
    -charge.purchased_delta,
    refund_key,
    charge.lookup_domain,
    jsonb_build_object('reason', coalesce(p_reason, 'lookup_failed'), 'reservation_id', charge.id)
  );

  select greatest(included_balance + purchased_balance, 0)
    into new_total
  from public.email_credit_accounts
  where owner_id = charge.owner_id;
  return new_total;
end;
$$;

-- Atomically returns a cached result, declines a concurrent duplicate, or
-- reserves exactly one credit and grants a short provider-call lease.
create or replace function public.claim_email_lookup(
  p_owner_id uuid,
  p_actor_user_id uuid,
  p_domain text,
  p_claim_token uuid
)
returns table (
  claim_status text,
  cached_email text,
  cached_confidence text,
  cached_source text,
  credit_charged boolean,
  remaining integer,
  reservation_id uuid,
  retry_after integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  cached public.email_lookup_cache%rowtype;
  account public.email_credit_accounts%rowtype;
  included_change integer := 0;
  purchased_change integer := 0;
  new_reservation uuid;
begin
  if p_owner_id is null or p_actor_user_id is null or p_claim_token is null
     or p_domain is null or length(p_domain) = 0 then
    raise exception 'Invalid email lookup claim.' using errcode = '22023';
  end if;

  -- A domain-level advisory lock closes the insert race when no cache row
  -- exists yet. Different domains still run concurrently.
  perform pg_advisory_xact_lock(hashtextextended('email-lookup-domain:' || p_domain, 0));

  select * into cached
  from public.email_lookup_cache
  where domain = p_domain
  for update;

  if found and cached.state in ('found', 'guessed')
     and (cached.result_expires_at is null or cached.result_expires_at > now()) then
    select greatest(a.included_balance + a.purchased_balance, 0)
      into remaining
    from public.email_credit_accounts a
    where a.owner_id = p_owner_id;

    -- The cache is global so that LeadZipp pays the provider once per domain,
    -- and re-reading a domain this owner already paid for stays free: that is
    -- the documented "cached reruns are free" promise, and withholding data a
    -- customer has already bought would be worse than the leak.
    --
    -- It is NOT a way to read other tenants' results with an empty balance.
    -- A first-time reader of this domain must still be in good standing, which
    -- also covers an owner whose purchased credits were clawed back after a
    -- refund or chargeback. No credit is charged either way: serving a cached
    -- row costs nothing upstream.
    if coalesce(remaining, 0) <= 0 and not exists (
      select 1
      from public.email_credit_ledger l
      where l.owner_id = p_owner_id
        and l.entry_type = 'lookup_charge'
        and l.lookup_domain = p_domain
    ) then
      return query select
        'exhausted'::text,
        null::text,
        null::text,
        null::text,
        false,
        0,
        null::uuid,
        0;
      return;
    end if;

    return query select
      'cached'::text,
      cached.email,
      cached.confidence,
      cached.source,
      false,
      coalesce(remaining, 0),
      null::uuid,
      0;
    return;
  end if;

  if found and cached.state = 'pending' and cached.lease_expires_at > now() then
    select greatest(a.included_balance + a.purchased_balance, 0)
      into remaining
    from public.email_credit_accounts a
    where a.owner_id = p_owner_id;

    return query select
      'pending'::text,
      null::text,
      null::text,
      null::text,
      false,
      coalesce(remaining, 0),
      null::uuid,
      greatest(1, ceil(extract(epoch from (cached.lease_expires_at - now())))::integer);
    return;
  end if;

  -- If a worker died after reserving a credit, release that old reservation
  -- before a new worker takes over the expired lease.
  if found and cached.state = 'pending' and cached.reservation_ledger_id is not null then
    perform public.refund_email_lookup_credit(cached.reservation_ledger_id, 'stale_lookup_lease');
  end if;

  perform pg_advisory_xact_lock(hashtextextended('email-credit-ledger', 0));
  select * into account
  from public.email_credit_accounts
  where owner_id = p_owner_id
  for update;

  if not found or account.included_balance + account.purchased_balance <= 0 then
    return query select
      'exhausted'::text,
      null::text,
      null::text,
      null::text,
      false,
      0,
      null::uuid,
      0;
    return;
  end if;

  -- Included credits are spent first. A negative purchased balance represents
  -- refunded/charged-back credit debt and therefore reduces usable included
  -- credits until the combined balance reaches zero.
  if account.included_balance > 0 then
    included_change := -1;
  else
    purchased_change := -1;
  end if;

  insert into public.email_credit_ledger (
    owner_id, actor_user_id, entry_type, included_delta, purchased_delta,
    idempotency_key, lookup_domain, metadata
  ) values (
    p_owner_id,
    p_actor_user_id,
    'lookup_charge',
    included_change,
    purchased_change,
    'lookup-charge:' || p_claim_token::text,
    p_domain,
    jsonb_build_object('allowance_key', account.allowance_key)
  ) returning id into new_reservation;

  update public.email_credit_accounts
  set included_balance = included_balance + included_change,
      purchased_balance = purchased_balance + purchased_change,
      updated_at = now()
  where owner_id = p_owner_id;

  insert into public.email_lookup_cache (
    domain, state, claim_token, reservation_ledger_id, claimed_by,
    lease_expires_at, result_expires_at, email, confidence, source, updated_at
  ) values (
    p_domain, 'pending', p_claim_token, new_reservation, p_actor_user_id,
    now() + interval '20 seconds', null, null, null, null, now()
  ) on conflict (domain) do update
    set state = 'pending',
        claim_token = excluded.claim_token,
        completion_token = null,
        reservation_ledger_id = excluded.reservation_ledger_id,
        claimed_by = excluded.claimed_by,
        lease_expires_at = excluded.lease_expires_at,
        result_expires_at = null,
        email = null,
        confidence = null,
        source = null,
        updated_at = now();

  return query select
    'claimed'::text,
    null::text,
    null::text,
    null::text,
    true,
    greatest(account.included_balance + account.purchased_balance - 1, 0),
    new_reservation,
    0;
end;
$$;

-- Complete a claimed lookup. Guessed/no-result completions refund the reserved
-- credit in the same transaction; successful Hunter results keep the charge.
create or replace function public.complete_email_lookup(
  p_domain text,
  p_claim_token uuid,
  p_email text,
  p_confidence text,
  p_source text,
  p_keep_charge boolean,
  p_result_expires_at timestamptz default null
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  cached public.email_lookup_cache%rowtype;
  new_total integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('email-lookup-domain:' || p_domain, 0));

  select * into cached
  from public.email_lookup_cache
  where domain = p_domain
    and state = 'pending'
    and claim_token = p_claim_token
  for update;

  if not found then
    raise exception 'Email lookup claim is no longer active.' using errcode = '40001';
  end if;

  if p_email is null or length(p_email) = 0
     or p_confidence not in ('verified', 'likely', 'guessed')
     or p_source not in ('hunter', 'guess') then
    raise exception 'Invalid email lookup result.' using errcode = '22023';
  end if;

  if not p_keep_charge and cached.reservation_ledger_id is not null then
    new_total := public.refund_email_lookup_credit(
      cached.reservation_ledger_id,
      'provider_no_billable_result'
    );
  else
    select greatest(a.included_balance + a.purchased_balance, 0)
      into new_total
    from public.email_credit_ledger l
    join public.email_credit_accounts a on a.owner_id = l.owner_id
    where l.id = cached.reservation_ledger_id;
  end if;

  update public.email_lookup_cache
  set state = case when p_keep_charge then 'found' else 'guessed' end,
      email = p_email,
      confidence = p_confidence,
      source = p_source,
      claim_token = null,
      completion_token = p_claim_token,
      reservation_ledger_id = null,
      claimed_by = null,
      lease_expires_at = null,
      result_expires_at = p_result_expires_at,
      updated_at = now()
  where domain = p_domain;

  return coalesce(new_total, 0);
end;
$$;

create or replace function public.abort_email_lookup(
  p_domain text,
  p_claim_token uuid,
  p_reason text default 'lookup_aborted'
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  cached public.email_lookup_cache%rowtype;
  new_total integer := 0;
begin
  perform pg_advisory_xact_lock(hashtextextended('email-lookup-domain:' || p_domain, 0));
  select * into cached
  from public.email_lookup_cache
  where domain = p_domain and state = 'pending' and claim_token = p_claim_token
  for update;

  if not found then
    return 0;
  end if;

  if cached.reservation_ledger_id is not null then
    new_total := coalesce(
      public.refund_email_lookup_credit(cached.reservation_ledger_id, p_reason),
      0
    );
  end if;

  delete from public.email_lookup_cache
  where domain = p_domain and claim_token = p_claim_token;

  return new_total;
end;
$$;

-- Fulfill a verified Stripe Checkout Session exactly once. The route/webhook
-- validates the line-item Price ID, quantity and amount before calling this RPC.
create or replace function public.grant_email_credit_pack(
  p_owner_id uuid,
  p_actor_user_id uuid,
  p_checkout_session_id text,
  p_payment_intent_id text,
  p_price_id text,
  p_pack_slug text,
  p_credits integer,
  p_amount_paid integer,
  p_currency text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  purchase_id uuid;
begin
  if p_owner_id is null or p_actor_user_id is null
     or p_checkout_session_id is null or p_payment_intent_id is null
     or p_price_id is null or p_pack_slug is null
     or p_credits <= 0 or p_amount_paid <= 0 then
    raise exception 'Invalid email-credit pack.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('email-credit-ledger', 0));

  insert into public.email_credit_accounts (owner_id)
  values (p_owner_id)
  on conflict (owner_id) do nothing;

  insert into public.email_credit_purchases (
    owner_id, actor_user_id, stripe_checkout_session_id,
    stripe_payment_intent_id, stripe_price_id, pack_slug, credits,
    amount_paid, currency
  ) values (
    p_owner_id, p_actor_user_id, p_checkout_session_id,
    p_payment_intent_id, p_price_id, p_pack_slug, p_credits,
    p_amount_paid, lower(p_currency)
  ) on conflict do nothing
  returning id into purchase_id;

  if purchase_id is null then
    return false;
  end if;

  update public.email_credit_accounts
  set purchased_balance = purchased_balance + p_credits,
      updated_at = now()
  where owner_id = p_owner_id;

  insert into public.email_credit_ledger (
    owner_id, actor_user_id, entry_type, purchased_delta,
    idempotency_key, stripe_checkout_session_id,
    stripe_payment_intent_id, metadata
  ) values (
    p_owner_id, p_actor_user_id, 'pack_grant', p_credits,
    'pack-grant:' || p_checkout_session_id,
    p_checkout_session_id, p_payment_intent_id,
    jsonb_build_object(
      'pack', p_pack_slug,
      'credits', p_credits,
      'amount_paid', p_amount_paid,
      'currency', lower(p_currency),
      'price_id', p_price_id
    )
  );

  return true;
end;
$$;

-- Apply or reverse a refund/dispute source and recompute the effective
-- clawback. Refund totals and an active dispute overlap, so the larger of the
-- two is used rather than charging both against the customer's credits.
create or replace function public.adjust_email_credit_pack(
  p_payment_intent_id text,
  p_event_key text,
  p_source_type text,
  p_source_id text,
  p_amount_cents integer,
  p_active boolean
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  purchase public.email_credit_purchases%rowtype;
  refund_amount bigint := 0;
  dispute_amount bigint := 0;
  adverse_amount bigint := 0;
  desired_revoked integer := 0;
  purchased_delta integer := 0;
begin
  if p_event_key is null or p_source_id is null
     or p_source_type not in ('refund', 'dispute')
     or p_amount_cents < 0 then
    raise exception 'Invalid email-credit pack adjustment.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('email-credit-ledger', 0));

  select * into purchase
  from public.email_credit_purchases
  where stripe_payment_intent_id = p_payment_intent_id
  for update;

  if not found then
    return 'not_pack';
  end if;

  if exists (
    select 1 from public.email_credit_ledger
    where owner_id = purchase.owner_id and idempotency_key = p_event_key
  ) then
    return 'duplicate';
  end if;

  insert into public.email_credit_purchase_adjustments (
    purchase_id, source_type, source_id, amount_cents, active, updated_at
  ) values (
    purchase.id, p_source_type, p_source_id, p_amount_cents, p_active, now()
  ) on conflict (purchase_id, source_type, source_id) do update
    set amount_cents = excluded.amount_cents,
        active = excluded.active,
        updated_at = now();

  select coalesce(sum(amount_cents), 0)
    into refund_amount
  from public.email_credit_purchase_adjustments
  where purchase_id = purchase.id and source_type = 'refund' and active;

  select coalesce(max(amount_cents), 0)
    into dispute_amount
  from public.email_credit_purchase_adjustments
  where purchase_id = purchase.id and source_type = 'dispute' and active;

  adverse_amount := least(purchase.amount_paid::bigint, greatest(refund_amount, dispute_amount));
  desired_revoked := case
    when adverse_amount <= 0 then 0
    else least(
      purchase.credits,
      ceil((purchase.credits::numeric * adverse_amount::numeric) / purchase.amount_paid::numeric)::integer
    )
  end;

  purchased_delta := purchase.revoked_credits - desired_revoked;

  update public.email_credit_purchases
  set revoked_credits = desired_revoked,
      updated_at = now()
  where id = purchase.id;

  update public.email_credit_accounts
  set purchased_balance = purchased_balance + purchased_delta,
      updated_at = now()
  where owner_id = purchase.owner_id;

  insert into public.email_credit_ledger (
    owner_id, actor_user_id, entry_type, purchased_delta,
    idempotency_key, stripe_checkout_session_id,
    stripe_payment_intent_id, metadata
  ) values (
    purchase.owner_id,
    purchase.actor_user_id,
    'pack_adjustment',
    purchased_delta,
    p_event_key,
    purchase.stripe_checkout_session_id,
    purchase.stripe_payment_intent_id,
    jsonb_build_object(
      'source_type', p_source_type,
      'source_id', p_source_id,
      'active', p_active,
      'amount_cents', p_amount_cents,
      'revoked_credits', desired_revoked
    )
  );

  return 'adjusted';
end;
$$;

revoke all on function public.sync_email_credit_allowance(uuid, text, text, integer, timestamptz, bigint)
  from public, anon, authenticated;
revoke all on function public.get_email_credit_balance(uuid)
  from public, anon, authenticated;
revoke all on function public.refund_email_lookup_credit(uuid, text)
  from public, anon, authenticated;
revoke all on function public.claim_email_lookup(uuid, uuid, text, uuid)
  from public, anon, authenticated;
revoke all on function public.complete_email_lookup(text, uuid, text, text, text, boolean, timestamptz)
  from public, anon, authenticated;
revoke all on function public.abort_email_lookup(text, uuid, text)
  from public, anon, authenticated;
revoke all on function public.grant_email_credit_pack(uuid, uuid, text, text, text, text, integer, integer, text)
  from public, anon, authenticated;
revoke all on function public.adjust_email_credit_pack(text, text, text, text, integer, boolean)
  from public, anon, authenticated;

grant execute on function public.sync_email_credit_allowance(uuid, text, text, integer, timestamptz, bigint)
  to service_role;
grant execute on function public.get_email_credit_balance(uuid)
  to service_role;
grant execute on function public.refund_email_lookup_credit(uuid, text)
  to service_role;
grant execute on function public.claim_email_lookup(uuid, uuid, text, uuid)
  to service_role;
grant execute on function public.complete_email_lookup(text, uuid, text, text, text, boolean, timestamptz)
  to service_role;
grant execute on function public.abort_email_lookup(text, uuid, text)
  to service_role;
grant execute on function public.grant_email_credit_pack(uuid, uuid, text, text, text, text, integer, integer, text)
  to service_role;
grant execute on function public.adjust_email_credit_pack(text, text, text, text, integer, boolean)
  to service_role;

comment on table public.email_credit_accounts is
  'Server-managed Email Finder balances. Agency members share the workspace owner row.';
comment on table public.email_credit_ledger is
  'Append-only, idempotent audit trail for included and purchased email credits.';
comment on table public.email_lookup_cache is
  'Server-only domain lookup cache and short-lived concurrency lease.';

commit;
