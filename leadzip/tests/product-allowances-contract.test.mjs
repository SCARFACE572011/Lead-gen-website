import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { modulePath } from './helpers/load-typescript-module.mjs'

const migration = fs.readFileSync(
  modulePath('supabase/migrations/20260815_product_allowances.sql'),
  'utf8'
)

test('paid allowances require live subscription evidence or the locked owner allowlist', () => {
  assert.match(migration, /from public\.admin_allowlist/)
  assert.match(migration, /status in \('active', 'trialing'\)/)
  assert.match(migration, /Profile\.plan is a denormalized display value/)
  assert.doesNotMatch(
    migration,
    /new\.status = 'active' and \(new\.plan = 'agency' or new\.role = 'admin'\)/
  )
})

test('Agency inheritance requires membership and workspace ids are server-managed', () => {
  assert.match(migration, /from public\.workspace_members/)
  assert.match(migration, /new\.workspace_id is distinct from old\.workspace_id/)
  assert.match(migration, /changing plan, role, status, or workspace requires the service role/)
})

test('seat accounting always counts the owner and protects the owner row', () => {
  assert.match(migration, /select 1 \+ count\(\*\) into current_seats/)
  assert.match(migration, /workspace_members_protect_owner_delete/)
})

test('subscription state has monotonic fields for out-of-order Stripe delivery', () => {
  assert.match(migration, /stripe_state_version bigint not null default 0/)
  assert.match(migration, /stripe_subscription_created bigint not null default 0/)
})
