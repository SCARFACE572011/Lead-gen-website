# Supabase Migration Runbook — `20260810_security_and_integrity.sql`

This runbook applies the security and data-integrity fixes from the 2026-08-10
audit to the live Supabase project. The migration is **idempotent** — running it
twice is safe and the second run is a no-op.

There is no direct DB access from the dev machine, so everything runs through
the Supabase Dashboard SQL editor.

---

## 1. Pre-checks (read-only, run these first)

Open **Supabase Dashboard → your project → SQL Editor → New query**, paste and
run each block below.

### 1a. Duplicate `stripe_customer_id` rows in `subscriptions`

The migration creates a unique index on `subscriptions(stripe_customer_id)` and
will **fail** if duplicates exist (they should not — the webhook has never been
able to write to this table).

```sql
select stripe_customer_id, count(*)
from public.subscriptions
where stripe_customer_id is not null
group by stripe_customer_id
having count(*) > 1;
```

**Expected output:** `Success. No rows returned`.

If rows come back, resolve them manually before migrating (keep the newest row
per customer, e.g. by `updated_at`, and delete the rest). Do **not** delete
subscription rows blindly — they are billing data.

### 1b. Duplicate `(workspace_id, email)` invitations

```sql
select workspace_id, email, count(*)
from public.workspace_invitations
group by workspace_id, email
having count(*) > 1;
```

**Expected output:** `Success. No rows returned` (the invite endpoint has never
been able to insert rows). If duplicates do exist, no action is needed — the
migration deduplicates automatically, keeping the newest invitation per pair.

---

## 2. Apply the migration

1. Open **SQL Editor → New query**.
2. Copy the **entire contents** of
   `supabase/migrations/20260810_security_and_integrity.sql` and paste it in.
3. Click **Run**.

**Expected output:** `Success. No rows returned`.

The SQL editor runs the script in a single transaction: if any statement fails,
nothing is applied. On failure, read the error, fix the cause, and run the whole
script again — it is safe to re-run. Failure modes you might see:

- `Missing table(s): ...` — the preflight check found tables from earlier
  migrations absent. Apply every file in `supabase/migrations/` in filename
  order first, then re-run this one.
- `could not create unique index ... duplicate key` — a pre-check from step 1
  was skipped; resolve the duplicates it lists, then re-run.

---

## 3. Verify each fix

Run each query in the SQL editor after the migration succeeds.

### Fix 1 — unique indexes on `subscriptions`

```sql
select indexname, indexdef
from pg_indexes
where schemaname = 'public' and tablename = 'subscriptions'
order by indexname;
```

**Expected:** a `UNIQUE` index on `(stripe_customer_id)` (created as
`subscriptions_stripe_customer_id_key` unless one already existed under another
name), a `UNIQUE` index/constraint on `(user_id)` (usually
`subscriptions_user_id_key` from the original schema), and **no** plain
non-unique `subscriptions_stripe_customer_id_idx`.

### Fix 2 — unique `(workspace_id, email)` on `workspace_invitations`

```sql
select indexname, indexdef
from pg_indexes
where schemaname = 'public' and tablename = 'workspace_invitations'
order by indexname;
```

**Expected:** includes a `UNIQUE` index on `(workspace_id, email)`
(`workspace_invitations_workspace_id_email_key`). After this, POST
`/api/workspace/invite` stops returning 500 for the `onConflict` reason.

### Fix 3 — RLS on workspace tables

```sql
select relname, relrowsecurity
from pg_class
where oid in (
  'public.workspaces'::regclass,
  'public.workspace_members'::regclass,
  'public.workspace_invitations'::regclass
);
```

**Expected:** `relrowsecurity = true` for all three rows.

```sql
select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
  and tablename in ('workspaces', 'workspace_members', 'workspace_invitations')
order by tablename, policyname;
```

**Expected:** the `workspaces_*` (4), `workspace_members_*` (4), and
`workspace_invitations_owner_all` (1) policies, all with roles
`{authenticated}`.

Optional external check — invitation tokens must no longer be readable with the
anon key (use the values from `leadzip/.env.local`; do not commit them
anywhere):

```
curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/workspace_invitations?select=token,email" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $NEXT_PUBLIC_SUPABASE_ANON_KEY"
```

**Expected:** `[]` (empty array), never a list of tokens.

### Fix 4 — RLS on `crm_integrations`

```sql
select c.relrowsecurity,
       (select count(*) from pg_policies p
        where p.schemaname = 'public' and p.tablename = 'crm_integrations') as policy_count
from pg_class c
where c.oid = 'public.crm_integrations'::regclass;
```

**Expected:** `relrowsecurity = true`, `policy_count = 1`
(`crm_integrations_owner_all`). The same curl shape as in Fix 3 against
`/rest/v1/crm_integrations?select=user_id,crm_type,api_key` must return `[]`.

Follow-up (tracked, not part of this migration): encrypt `api_key` at rest via
Supabase Vault / pgsodium — RLS closes the PostgREST hole but the keys are
still plaintext in the table.

### Fix 5 — `users_profile` plan/role/status protection trigger

```sql
select tgname, tgenabled
from pg_trigger
where tgrelid = 'public.users_profile'::regclass
  and tgname = 'users_profile_protect_privileged';
```

**Expected:** one row, `tgenabled = 'O'`.

Functional test (simulates an authenticated end-user JWT; the error is the
**expected, correct** outcome and `rollback` undoes everything):

```sql
begin;
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
update public.users_profile set plan = 'agency'
where id = (select id from public.users_profile limit 1);
rollback;
```

**Expected:** the `update` fails with
`changing plan, role, or status requires the service role` (SQLSTATE 42501).
Then run `rollback;` if the editor has not already ended the transaction.
A normal self-edit (e.g. `full_name`) is unaffected, and service-role /
direct-SQL updates of plan/role/status still work.

### Fix 6 — `leads` enrichment columns

```sql
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'leads'
  and column_name in ('employee_count', 'revenue_estimate',
                      'facebook_url', 'instagram_url', 'linkedin_url')
order by column_name;
```

**Expected:** 5 rows — `employee_count` integer, the other four text.

### Fix 7 — `leads_cache`: public read, service-role-only writes

```sql
select c.relrowsecurity, p.policyname, p.cmd, p.roles
from pg_class c
left join pg_policies p
  on p.schemaname = 'public' and p.tablename = 'leads_cache'
where c.oid = 'public.leads_cache'::regclass;
```

**Expected:** `relrowsecurity = true` and exactly one policy:
`leads_cache_public_read`, `cmd = SELECT`, roles `{anon,authenticated}`. The
old `Service role can manage cache` (`FOR ALL USING (true)`) policy is gone.

External check — anon writes must now be rejected:

```
curl -s -X POST "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/leads_cache" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"cache_key":"poison-test","leads":[],"total":0,"source":"osm","expires_at":"2030-01-01T00:00:00Z"}'
```

**Expected:** an error with code `42501`
("new row violates row-level security policy"), not a 201.

### Fix 8 — FKs to `users_profile` (PostgREST embeds)

```sql
select conname, conrelid::regclass as table_name, convalidated
from pg_constraint
where conname in ('usage_limits_user_id_profile_fkey',
                  'subscriptions_user_id_profile_fkey',
                  'workspace_members_user_id_profile_fkey');
```

**Expected:** 3 rows, each with `convalidated = false` (they are `NOT VALID`
by design; PostgREST resolves embeds either way).

App-level check: as an admin, `GET /api/admin/users` no longer 500s with
PGRST200, and `GET /api/workspace` returns actual members. If embeds still
fail immediately after the migration, reload the API schema cache once via
**Dashboard → Settings → API → Restart / Reload schema** (the migration also
issues `notify pgrst, 'reload schema'`).

Optional hardening, once data is confirmed consistent (every `user_id` has a
`users_profile` row — normally guaranteed by the signup trigger):

```sql
alter table public.usage_limits      validate constraint usage_limits_user_id_profile_fkey;
alter table public.subscriptions     validate constraint subscriptions_user_id_profile_fkey;
alter table public.workspace_members validate constraint workspace_members_user_id_profile_fkey;
```

---

## 4. Related code changes — already shipped in this same branch

These were flagged during the audit and have since been fixed in
`fix/restore-search-and-security`; listed here so the migration and code stay in
sync. No further action required.

- **Cache writes now use the service role.** `src/app/api/leads/search/route.ts`
  and `src/app/api/cron/prefetch-leads/route.ts` previously wrote `leads_cache`
  with the anon/session client, which Fix 7 would have silently RLS-denied. Both
  now use a `SUPABASE_SERVICE_ROLE_KEY` client for the cache write (user-scoped
  `search_history` / `usage_limits` writes stay on the session client). The cron
  also now reads `search_history` with the service role.
- **Stripe webhook supplies `user_id`.** `src/app/api/stripe/webhook/route.ts`
  was rewritten to resolve `user_id` (from metadata / `client_reference_id`,
  falling back to the customer's existing row) and do an explicit
  select-then-update/insert, so the NOT NULL insert no longer fails with 23502.

Still true and unchanged:

- `supabase/schema.sql` is a stale snapshot kept for reference only — see the
  header note in that file. Never provision from it; `supabase/migrations/` is
  the source of truth.
