import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import test from 'node:test'
import { loadTypeScriptModule, modulePath } from './helpers/load-typescript-module.mjs'

const featureUsage = await loadTypeScriptModule(modulePath('src/lib/featureUsage.ts'))
const featureUsageMigration = await fs.readFile(
  modulePath('supabase/migrations/20260817_feature_usage.sql'),
  'utf8'
)

test('cost-bearing feature allowances match the public Free, Pro, and Agency policy', () => {
  assert.deepEqual(featureUsage.FEATURE_MONTHLY_LIMITS.ai_proposal, {
    label: 'AI proposal generations',
    free: 3,
    pro: 50,
    agency: 250,
  })
  assert.deepEqual(featureUsage.FEATURE_MONTHLY_LIMITS.market_gaps, {
    label: 'market gap analyses',
    free: 1,
    pro: 10,
    agency: 50,
  })
  assert.deepEqual(featureUsage.FEATURE_MONTHLY_LIMITS.competitors, {
    label: 'competitor analyses',
    free: 3,
    pro: 25,
    agency: 100,
  })
  assert.deepEqual(featureUsage.FEATURE_MONTHLY_LIMITS.audit_reports, {
    label: 'public audit reports',
    free: 3,
    pro: 25,
    agency: 100,
  })
  assert.deepEqual(featureUsage.FEATURE_MONTHLY_LIMITS.website_health, {
    label: 'website health checks',
    free: 10,
    pro: 250,
    agency: 1_000,
  })
})

test('RPC responses are validated before a provider can trust a reservation', () => {
  const valid = featureUsage.parseFeatureUsageReservation({
    allowed: true,
    feature: 'competitors',
    reason: null,
    plan: 'pro',
    subjectUserId: '00000000-0000-0000-0000-000000000001',
    used: 4,
    limit: 25,
    remaining: 21,
    resetAt: '2026-09-01T00:00:00+00:00',
    upgradeRequired: false,
  })

  assert.equal(valid?.remaining, 21)
  assert.equal(
    featureUsage.parseFeatureUsageReservation({ ...valid, feature: 'not-a-real-feature' }),
    null
  )
  assert.equal(featureUsage.parseFeatureUsageReservation({ ...valid, feature: 'toString' }), null)
  assert.equal(featureUsage.parseFeatureUsageReservation({ ...valid, remaining: -1 }), null)
})

test('quota denial body exposes actionable structured usage fields', () => {
  const body = featureUsage.buildFeatureQuotaExceededBody({
    allowed: false,
    feature: 'market_gaps',
    reason: 'monthly_limit',
    plan: 'free',
    subjectUserId: '00000000-0000-0000-0000-000000000001',
    used: 1,
    limit: 1,
    remaining: 0,
    resetAt: '2026-09-01T00:00:00+00:00',
    upgradeRequired: true,
  })

  assert.equal(body.code, 'FEATURE_QUOTA_EXCEEDED')
  assert.equal(body.feature, 'market_gaps')
  assert.equal(body.limit, 1)
  assert.equal(body.remaining, 0)
  assert.equal(body.resetAt, '2026-09-01T00:00:00+00:00')
  assert.equal(body.upgradeRequired, true)
  assert.deepEqual(body.quota, {
    period: 'month',
    used: 1,
    limit: 1,
    remaining: 0,
    resetAt: '2026-09-01T00:00:00+00:00',
  })
})

test('reservation calls the durable RPC with the authenticated subject and feature', async () => {
  const calls = []
  const client = {
    async rpc(name, args) {
      calls.push({ name, args })
      return {
        data: {
          allowed: true,
          feature: 'website_health',
          reason: null,
          plan: 'agency',
          subjectUserId: 'workspace-owner',
          used: 10,
          limit: 1_000,
          remaining: 990,
          resetAt: '2026-09-01T00:00:00+00:00',
          upgradeRequired: false,
        },
        error: null,
      }
    },
  }

  const result = await featureUsage.reserveFeatureUsage(
    client,
    'workspace-member',
    'website_health'
  )

  assert.equal(result.ok, true)
  assert.equal(result.usage.subjectUserId, 'workspace-owner')
  assert.deepEqual(calls, [
    {
      name: 'reserve_feature_usage',
      args: { uid: 'workspace-member', feature_name: 'website_health' },
    },
  ])
})

test('Agency workspace pooling requires real owner entitlement and handles owner cancellation', () => {
  assert.match(
    featureUsageMigration,
    /owner_is_platform_admin := owner_status = 'active'[\s\S]*owner_role = 'admin'[\s\S]*from public\.admin_allowlist/
  )
  assert.match(
    featureUsageMigration,
    /owner_has_agency_subscription := owner_status = 'active'[\s\S]*owner_plan = 'agency'[\s\S]*from public\.subscriptions[\s\S]*plan = 'agency'[\s\S]*status in \('active', 'trialing'\)/
  )
  assert.match(
    featureUsageMigration,
    /if owner_is_platform_admin or owner_has_agency_subscription then/
  )
  assert.match(
    featureUsageMigration,
    /else\s+own_subscription_plan := null;[\s\S]*where user_id = requested_id[\s\S]*status in \('active', 'trialing'\)[\s\S]*account_plan := coalesce\(own_subscription_plan, 'free'\);/
  )
  assert.doesNotMatch(
    featureUsageMigration,
    /owner_plan = 'agency' or owner_role = 'admin'/
  )
  assert.doesNotMatch(featureUsageMigration, /workspace_owner_id <> requested_id/)
})
