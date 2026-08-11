-- 20260811_leads_cache.sql
-- The leads_cache table the app depends on to protect gross margin.
--
-- WHY THIS EXISTS: every cache MISS on /api/leads/search and the alert-digest cron
-- hits the paid Google Places API (~$0.10/search). leads_cache holds the raw search
-- POOL keyed only by "zip|category|radius" (refinement filters are applied to the
-- pool in app code, NOT baked into the key), so refining a search or re-running a
-- saved-search alert is a cache HIT that never re-bills the provider.
--
-- ACCESS MODEL: the cache is public-read (search works logged-out, so the anon /
-- session client must be able to SELECT it) and service-role-write only. RLS is
-- enabled with a public SELECT policy and NO write policy — the service-role key
-- bypasses RLS, so it remains the only writer and the anon key can never poison
-- cached results.
--
-- Idempotent — safe to run on a fresh or existing database. Run in Supabase:
-- Dashboard → SQL Editor → New query → paste + run.

create table if not exists public.leads_cache (
  id          uuid primary key default gen_random_uuid(),
  cache_key   text not null unique,          -- "{zipCode}|{category}|{radiusMiles}"
  leads       jsonb not null default '[]',
  total       integer not null default 0,
  source      text,                          -- 'google_places' | 'yelp' | 'osm' | ...
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);

create index if not exists leads_cache_key_idx     on public.leads_cache (cache_key);
create index if not exists leads_cache_expires_idx on public.leads_cache (expires_at);

-- RLS: public read, service-role-only write.
alter table public.leads_cache enable row level security;

-- Public (anon + authenticated) SELECT — the cache is public-read.
drop policy if exists "leads_cache_public_read" on public.leads_cache;
create policy "leads_cache_public_read"
  on public.leads_cache for select
  to anon, authenticated
  using (true);

-- No INSERT/UPDATE/DELETE policy is defined on purpose: the service role bypasses
-- RLS and is the only writer, so the anon key cannot write to (poison) the cache.

-- Optional: auto-delete expired rows to keep the table lean
-- (requires the pg_cron extension — enable in Dashboard → Database → Extensions)
-- select cron.schedule('delete-expired-leads-cache', '0 4 * * *',
--   $$delete from public.leads_cache where expires_at < now()$$);
