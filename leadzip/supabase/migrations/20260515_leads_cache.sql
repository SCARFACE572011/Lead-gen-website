-- Run this in your Supabase project: Dashboard → SQL Editor → New query → paste + run
-- Creates the leads_cache table used by /api/leads/search and the nightly cron job

create table if not exists leads_cache (
  id           uuid default gen_random_uuid() primary key,
  cache_key    text not null unique,   -- "{zipCode}|{category}|{radiusMiles}"
  leads        jsonb not null,
  total        integer not null,
  source       text not null,          -- 'google_places' | 'osm' | 'dynamic'
  created_at   timestamptz default now(),
  expires_at   timestamptz not null
);

create index if not exists leads_cache_key_idx     on leads_cache(cache_key);
create index if not exists leads_cache_expires_idx on leads_cache(expires_at);

-- Optional: auto-delete expired rows to keep the table lean
-- (requires pg_cron extension — enable it in Supabase Dashboard > Database > Extensions)
-- select cron.schedule('delete-expired-leads-cache', '0 4 * * *',
--   $$delete from leads_cache where expires_at < now()$$);
