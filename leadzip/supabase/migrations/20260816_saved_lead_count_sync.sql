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
