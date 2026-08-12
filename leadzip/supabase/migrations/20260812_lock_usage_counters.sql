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
-- Idempotent. Run in Supabase: Dashboard (project Leadzip-prod,
-- ref oeotgkarnqrfvvdfnaya) -> SQL Editor -> paste + run.
-- RUN 20260810_security_and_integrity.sql FIRST (it blocks plan/role/status
-- self-escalation — the more severe hole).

-- usage_limits: read-only for users, service-role writes only
alter table public.usage_limits enable row level security;
drop policy if exists "Users can view their own usage" on public.usage_limits;
drop policy if exists "Users can update their own usage" on public.usage_limits;
drop policy if exists "Users can insert their own usage" on public.usage_limits;
drop policy if exists "usage_limits_all_own" on public.usage_limits;
drop policy if exists "Users manage their own usage" on public.usage_limits;
create policy "usage_limits_select_own"
  on public.usage_limits for select
  to authenticated
  using (auth.uid() = user_id);

-- search_history: users may read and insert, but never update or delete
alter table public.search_history enable row level security;
drop policy if exists "Users can view their own search history" on public.search_history;
drop policy if exists "Users can insert their own search history" on public.search_history;
drop policy if exists "Users can manage their own search history" on public.search_history;
drop policy if exists "search_history_all_own" on public.search_history;
create policy "search_history_select_own"
  on public.search_history for select
  to authenticated
  using (auth.uid() = user_id);
create policy "search_history_insert_own"
  on public.search_history for insert
  to authenticated
  with check (auth.uid() = user_id);

-- subscriptions: one row per user, so the webhook + checkout-return activation
-- can't race into two rows (which then 500s every future sub webhook).
-- Safe if no duplicates exist yet (true on a fresh billing table).
create unique index if not exists subscriptions_user_id_key
  on public.subscriptions (user_id);
