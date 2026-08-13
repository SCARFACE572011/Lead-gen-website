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
