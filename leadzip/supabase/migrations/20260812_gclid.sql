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
