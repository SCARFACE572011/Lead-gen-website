import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { modulePath } from './helpers/load-typescript-module.mjs'

const migration = await readFile(
  modulePath('supabase/migrations/20260818_email_credits.sql'),
  'utf8'
)
const lookupRoute = await readFile(
  modulePath('src/app/api/leads/enrich/email/route.ts'),
  'utf8'
)
const creditService = await readFile(modulePath('src/lib/emailCredits.ts'), 'utf8')

test('email-credit mutations have durable idempotency and one lock order', () => {
  assert.match(migration, /unique \(owner_id, idempotency_key\)/)
  assert.match(migration, /unique \(purchase_id, source_type, source_id\)/)
  assert.doesNotMatch(migration, /email-credit-owner:/)
  assert.ok(
    migration.match(/pg_advisory_xact_lock\(hashtextextended\('email-credit-ledger'/g)
      ?.length >= 5
  )
})

test('failed and stale-period lookups refund safely', () => {
  assert.match(migration, /'lookup-refund:' \|\| charge\.id::text/)
  assert.match(migration, /jsonb_build_object\('allowance_key', account\.allowance_key\)/)
  assert.match(
    migration,
    /charge\.metadata->>'allowance_key' = a\.allowance_key/
  )
  assert.match(migration, /'stale_lookup_lease'/)
})

test('allowance webhooks are monotonic and lazy sync only rolls months forward', () => {
  assert.match(migration, /allowance_version bigint/)
  assert.match(migration, /p_source_version < account\.allowance_version/)
  assert.match(migration, /right\(p_allowance_key, 7\) > right\(account\.allowance_key, 7\)/)
})

test('provider results expire and guesses never retain a charge', () => {
  assert.match(lookupRoute, /Date\.now\(\) \+ 90 \* 86_400_000/)
  assert.match(lookupRoute, /Date\.now\(\) \+ 30 \* 86_400_000/)
  assert.match(lookupRoute, /source: 'guess',[\s\S]*?keepCharge: false/)
})

test('credit RPCs are service-role-only', () => {
  assert.match(
    migration,
    /revoke all on function public\.claim_email_lookup\(uuid, uuid, text, uuid\)[\s\S]*?from public, anon, authenticated;/
  )
  assert.match(
    migration,
    /grant execute on function public\.claim_email_lookup\(uuid, uuid, text, uuid\)[\s\S]*?to service_role;/
  )
})

test('a workspace hint cannot access an Agency owner pool without membership', () => {
  assert.match(creditService, /\.from\('workspace_members'\)/)
  assert.match(creditService, /\.eq\('workspace_id', actor\.workspace_id\)/)
  assert.match(creditService, /\.eq\('user_id', actorUserId\)/)
  assert.match(creditService, /workspace\?\.owner_id && membershipResult\.data/)
})

test('paid email-credit access does not trust a denormalized profile plan', () => {
  assert.match(creditService, /\.from\('admin_allowlist'\)/)
  assert.match(creditService, /isPlatformAdminRecord\(profile, data\?\.email, email\)/)
  assert.match(
    creditService,
    /subscription\?\.status === 'active' \|\| subscription\?\.status === 'trialing'/
  )
  assert.doesNotMatch(creditService, /normalizePlan\(owner\.plan\)/)
})
