-- ============================================================
-- 20260810_security_and_integrity.sql
-- Fixes audited security + data-integrity issues (2026-08-10 audit).
-- Idempotent: every statement is guarded (IF NOT EXISTS / DO blocks /
-- DROP ... IF EXISTS) — safe to re-run.
-- Run in Supabase Dashboard > SQL Editor. Step-by-step instructions
-- and verification queries: docs/supabase-migration-runbook.md
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 0. Preflight: all earlier migrations must already be applied.
--    Fails loudly (whole script rolls back) instead of erroring
--    halfway through on a missing table.
-- ────────────────────────────────────────────────────────────
do $$
declare
  missing text;
begin
  select string_agg(t, ', ') into missing
  from unnest(array[
    'public.users_profile',
    'public.subscriptions',
    'public.usage_limits',
    'public.leads',
    'public.leads_cache',
    'public.workspaces',
    'public.workspace_members',
    'public.workspace_invitations',
    'public.crm_integrations'
  ]) as t
  where to_regclass(t) is null;

  if missing is not null then
    raise exception 'Missing table(s): %. Apply the earlier migrations in supabase/migrations/ (filename order) before running this one.', missing;
  end if;
end $$;

-- ────────────────────────────────────────────────────────────
-- 1. subscriptions: unique index on stripe_customer_id
--    Backs the Stripe webhook upsert `onConflict: 'stripe_customer_id'`
--    (currently rejected with 42P10 — no matching unique constraint).
--    Also ensures the unique guarantee on user_id stays intact.
--    NOTE: creation fails if duplicate non-null stripe_customer_id
--    rows exist — run the runbook pre-check first.
-- ────────────────────────────────────────────────────────────
do $$
begin
  if to_regclass('public.subscriptions') is not null then
    -- unique index on stripe_customer_id (skip if any unique index already covers it)
    if not exists (
      select 1
      from pg_index i
      join pg_class t on t.oid = i.indrelid
      join pg_namespace n on n.oid = t.relnamespace
      where n.nspname = 'public'
        and t.relname = 'subscriptions'
        and i.indisunique
        and i.indpred is null
        and (
          select array_agg(a.attname::text order by a.attname)
          from pg_attribute a
          where a.attrelid = t.oid and a.attnum = any (i.indkey)
        ) = array['stripe_customer_id']
    ) then
      execute 'create unique index subscriptions_stripe_customer_id_key on public.subscriptions (stripe_customer_id)';
    end if;

    -- drop the old redundant NON-unique index from schema.sql (only if non-unique)
    if exists (
      select 1
      from pg_index i
      join pg_class c on c.oid = i.indexrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = 'subscriptions_stripe_customer_id_idx'
        and not i.indisunique
    ) then
      execute 'drop index public.subscriptions_stripe_customer_id_idx';
    end if;

    -- ensure user_id uniqueness (schema.sql declared it inline; re-create if missing)
    if not exists (
      select 1
      from pg_index i
      join pg_class t on t.oid = i.indrelid
      join pg_namespace n on n.oid = t.relnamespace
      where n.nspname = 'public'
        and t.relname = 'subscriptions'
        and i.indisunique
        and i.indpred is null
        and (
          select array_agg(a.attname::text order by a.attname)
          from pg_attribute a
          where a.attrelid = t.oid and a.attnum = any (i.indkey)
        ) = array['user_id']
    ) then
      execute 'create unique index subscriptions_user_id_uidx on public.subscriptions (user_id)';
    end if;
  end if;
end $$;

-- ────────────────────────────────────────────────────────────
-- 2. workspace_invitations: unique (workspace_id, email)
--    Backs the invite route's upsert `onConflict: 'workspace_id,email'`
--    (currently rejected with 42P10, so every invite 500s).
--    Dedupe first, keeping the newest invitation per pair — the same
--    outcome the intended upsert semantics would have produced.
-- ────────────────────────────────────────────────────────────
do $$
begin
  if to_regclass('public.workspace_invitations') is not null then
    delete from public.workspace_invitations wi
    using public.workspace_invitations newer
    where newer.workspace_id = wi.workspace_id
      and newer.email = wi.email
      and newer.id <> wi.id
      and (newer.created_at > wi.created_at
           or (newer.created_at = wi.created_at and newer.id > wi.id));

    if not exists (
      select 1
      from pg_index i
      join pg_class t on t.oid = i.indrelid
      join pg_namespace n on n.oid = t.relnamespace
      where n.nspname = 'public'
        and t.relname = 'workspace_invitations'
        and i.indisunique
        and i.indpred is null
        and (
          select array_agg(a.attname::text order by a.attname)
          from pg_attribute a
          where a.attrelid = t.oid and a.attnum = any (i.indkey)
        ) = array['email', 'workspace_id']
    ) then
      execute 'create unique index workspace_invitations_workspace_id_email_key on public.workspace_invitations (workspace_id, email)';
    end if;
  end if;
end $$;

-- ────────────────────────────────────────────────────────────
-- 3. RLS for workspaces / workspace_members / workspace_invitations
--    Audit: no RLS at all — anyone with the public anon key could read
--    every workspace, membership row, and live invitation token
--    (plan-escalation via POST /api/invite/[token]).
--    App routes access these tables with the service role (bypasses
--    RLS), so these policies only define what end-user JWTs can do.
--    security definer helpers avoid policy recursion between
--    workspaces and workspace_members.
-- ────────────────────────────────────────────────────────────
create or replace function public.is_workspace_member(ws_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = ws_id
      and wm.user_id = auth.uid()
  );
$$;

create or replace function public.is_workspace_owner(ws_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspaces w
    where w.id = ws_id
      and w.owner_id = auth.uid()
  );
$$;

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_invitations enable row level security;

-- workspaces: owner manages; members can read
drop policy if exists "workspaces_select_owner_or_member" on public.workspaces;
create policy "workspaces_select_owner_or_member"
  on public.workspaces for select
  to authenticated
  using (owner_id = auth.uid() or public.is_workspace_member(id));

drop policy if exists "workspaces_insert_owner" on public.workspaces;
create policy "workspaces_insert_owner"
  on public.workspaces for insert
  to authenticated
  with check (owner_id = auth.uid());

drop policy if exists "workspaces_update_owner" on public.workspaces;
create policy "workspaces_update_owner"
  on public.workspaces for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "workspaces_delete_owner" on public.workspaces;
create policy "workspaces_delete_owner"
  on public.workspaces for delete
  to authenticated
  using (owner_id = auth.uid());

-- workspace_members: visible to fellow members and the owner;
-- only the owner mutates rows; a member may remove their own row (leave)
drop policy if exists "workspace_members_select_member_or_owner" on public.workspace_members;
create policy "workspace_members_select_member_or_owner"
  on public.workspace_members for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_workspace_owner(workspace_id)
    or public.is_workspace_member(workspace_id)
  );

drop policy if exists "workspace_members_insert_owner" on public.workspace_members;
create policy "workspace_members_insert_owner"
  on public.workspace_members for insert
  to authenticated
  with check (public.is_workspace_owner(workspace_id));

drop policy if exists "workspace_members_update_owner" on public.workspace_members;
create policy "workspace_members_update_owner"
  on public.workspace_members for update
  to authenticated
  using (public.is_workspace_owner(workspace_id))
  with check (public.is_workspace_owner(workspace_id));

drop policy if exists "workspace_members_delete_owner_or_self" on public.workspace_members;
create policy "workspace_members_delete_owner_or_self"
  on public.workspace_members for delete
  to authenticated
  using (user_id = auth.uid() or public.is_workspace_owner(workspace_id));

-- workspace_invitations: owner-only (tokens must never be readable by
-- other users; the invitee acceptance flow runs via service role)
drop policy if exists "workspace_invitations_owner_all" on public.workspace_invitations;
create policy "workspace_invitations_owner_all"
  on public.workspace_invitations for all
  to authenticated
  using (public.is_workspace_owner(workspace_id))
  with check (public.is_workspace_owner(workspace_id));

-- ────────────────────────────────────────────────────────────
-- 4. crm_integrations: enable RLS, owner-only policies
--    Audit: table stores plaintext CRM API keys with RLS disabled —
--    anyone holding the public anon key could read every user's key.
--    App routes use the service role, so this only closes the
--    PostgREST hole.
--    FOLLOW-UP RECOMMENDED: encrypt api_key at rest (e.g. Supabase
--    Vault / pgsodium) instead of storing plaintext — RLS alone still
--    leaves keys readable in backups, logs, and to service-role code.
-- ────────────────────────────────────────────────────────────
alter table public.crm_integrations enable row level security;

drop policy if exists "crm_integrations_owner_all" on public.crm_integrations;
create policy "crm_integrations_owner_all"
  on public.crm_integrations for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

comment on column public.crm_integrations.api_key is
  'SECURITY FOLLOW-UP: stored in plaintext. Migrate to encrypted storage (Supabase Vault / pgsodium) so keys are protected at rest.';

-- ────────────────────────────────────────────────────────────
-- 5. users_profile: block self-service privilege escalation
--    Audit: the "Users can update own profile" UPDATE policy has no
--    column restriction, so any user could set their own
--    plan/role/status (role='admin' gates every admin endpoint).
--    Trigger rejects changes to plan/role/status unless the request
--    runs as the service role. Direct SQL (no JWT, e.g. this editor,
--    pg_cron) is also allowed — it is not reachable through PostgREST.
--    Other columns (full_name, company_name, workspace_id, ...) stay
--    self-editable under the existing policy.
-- ────────────────────────────────────────────────────────────
-- Defensive: guarantee the status column exists (added by
-- 20260518_user_status.sql; re-declared here so the trigger below
-- never references a missing column on partially-provisioned DBs).
alter table public.users_profile
  add column if not exists status text not null default 'active'
    check (status in ('active', 'deactivated'));

create or replace function public.protect_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.plan   is distinct from old.plan
      or new.role   is distinct from old.role
      or new.status is distinct from old.status)
     and auth.role() is not null
     and auth.role() <> 'service_role'
  then
    raise exception 'changing plan, role, or status requires the service role'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists users_profile_protect_privileged on public.users_profile;
create trigger users_profile_protect_privileged
  before update on public.users_profile
  for each row execute function public.protect_profile_privileged_columns();

-- ────────────────────────────────────────────────────────────
-- 6. leads: enrichment columns read by the app
--    src/app/api/leads/saved/route.ts and src/app/(dashboard)/saved/
--    page.tsx read these; they exist in no migration today.
--    Live table shape is 20260515_leads.sql (id text primary key).
-- ────────────────────────────────────────────────────────────
alter table if exists public.leads
  add column if not exists employee_count integer,
  add column if not exists revenue_estimate text,
  add column if not exists facebook_url text,
  add column if not exists instagram_url text,
  add column if not exists linkedin_url text;

-- ────────────────────────────────────────────────────────────
-- 7. leads_cache: public reads, service-role-only writes
--    Audit: schema.sql's policy was `for all using (true)` (anyone
--    with the anon key could poison cached search results), and
--    20260515_leads_cache.sql never enabled RLS at all.
--    The app reads the cache through the anon/session server client
--    (search works logged-out), so SELECT stays open to anon +
--    authenticated. No write policies are created: the service role
--    bypasses RLS, so it remains the only writer.
--    NOTE: the cache upserts in src/app/api/leads/search/route.ts and
--    src/app/api/cron/prefetch-leads/route.ts currently use the
--    anon/session client and must move to a service-role client
--    (code change outside this migration).
-- ────────────────────────────────────────────────────────────
alter table public.leads_cache enable row level security;

drop policy if exists "Service role can manage cache" on public.leads_cache;
drop policy if exists "leads_cache_public_read" on public.leads_cache;
create policy "leads_cache_public_read"
  on public.leads_cache for select
  to anon, authenticated
  using (true);

-- ────────────────────────────────────────────────────────────
-- 8. FKs to users_profile for PostgREST embeds
--    Audit: usage_limits/subscriptions/workspace_members.user_id only
--    reference auth.users, so PostgREST embeds joining users_profile
--    fail with PGRST200 (admin users list, admin stats, admin billing,
--    workspace members list). users_profile.id is the PK and cascades
--    from auth.users, so these FKs are safe. NOT VALID skips scanning
--    existing rows; PostgREST resolves embeds regardless of
--    validation state. Optionally VALIDATE later (see runbook).
-- ────────────────────────────────────────────────────────────
do $$
begin
  if to_regclass('public.usage_limits') is not null
     and not exists (
       select 1 from pg_constraint c
       where c.conname = 'usage_limits_user_id_profile_fkey'
         and c.conrelid = to_regclass('public.usage_limits')
     )
  then
    alter table public.usage_limits
      add constraint usage_limits_user_id_profile_fkey
      foreign key (user_id) references public.users_profile (id)
      on delete cascade
      not valid;
  end if;

  if to_regclass('public.subscriptions') is not null
     and not exists (
       select 1 from pg_constraint c
       where c.conname = 'subscriptions_user_id_profile_fkey'
         and c.conrelid = to_regclass('public.subscriptions')
     )
  then
    alter table public.subscriptions
      add constraint subscriptions_user_id_profile_fkey
      foreign key (user_id) references public.users_profile (id)
      on delete cascade
      not valid;
  end if;

  if to_regclass('public.workspace_members') is not null
     and not exists (
       select 1 from pg_constraint c
       where c.conname = 'workspace_members_user_id_profile_fkey'
         and c.conrelid = to_regclass('public.workspace_members')
     )
  then
    alter table public.workspace_members
      add constraint workspace_members_user_id_profile_fkey
      foreign key (user_id) references public.users_profile (id)
      on delete cascade
      not valid;
  end if;
end $$;

-- ────────────────────────────────────────────────────────────
-- Reload the PostgREST schema cache so new FKs/columns/policies are
-- picked up immediately (otherwise embeds keep failing until restart).
-- ────────────────────────────────────────────────────────────
notify pgrst, 'reload schema';
