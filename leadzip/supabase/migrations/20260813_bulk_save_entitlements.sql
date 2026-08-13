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
