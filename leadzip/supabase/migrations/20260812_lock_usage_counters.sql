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
