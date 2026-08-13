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
