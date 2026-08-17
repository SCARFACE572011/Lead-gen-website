/**
 * Email Finder allowance resolution.
 *
 * These exercise src/lib/emailCredits.ts against an in-memory Supabase stub, so
 * they pin the actual resolved allowance for each account state rather than
 * re-asserting the constants (tests/email-credit-policy.test.mjs already covers
 * the constants).
 *
 * WHAT IS NOT COVERED HERE, AND WHY
 * ---------------------------------
 * The grant/expire/restore arithmetic lives in the PL/pgSQL body of
 * sync_email_credit_allowance. Whether a returning period restores instead of
 * re-granting, and whether free credits are minted only once per lifetime, are
 * decided by SQL and cannot be verified without a real Postgres. What the
 * TypeScript boundary owns, and what is asserted below, is which allowance key,
 * size, end date and source version get handed to that RPC.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { loadModuleGraph, repoPath } from './helpers/load-module-graph.mjs'
import { createStubDatabase, SCHEMA_MISSING_ERRORS } from './helpers/stub-database.mjs'

const credits = await loadModuleGraph(repoPath('src/lib/emailCredits.ts'), {
  stripe: repoPath('tests/helpers/stubs/stripe.ts'),
  '@supabase/supabase-js': repoPath('tests/helpers/stubs/supabase-js.ts'),
})

process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_pro_monthly'
process.env.STRIPE_PRICE_PRO_ANNUAL = 'price_pro_annual'
process.env.STRIPE_PRICE_AGENCY_MONTHLY = 'price_agency_monthly'
process.env.STRIPE_PRICE_AGENCY_ANNUAL = 'price_agency_annual'

const OWNER = '00000000-0000-4000-8000-000000000001'
const MEMBER = '00000000-0000-4000-8000-000000000002'
const WORKSPACE = '00000000-0000-4000-8000-0000000000ff'

function monthKeys() {
  const now = new Date()
  return [
    `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`,
  ]
}

/**
 * The month key is derived from the wall clock inside the module under test, so
 * a run that straddles a UTC month boundary would otherwise flake. Sampling the
 * clock on both sides of the call and accepting either value keeps the
 * assertion exact without pretending the clock is frozen.
 */
function assertCurrentMonthKey(actual, prefix, before) {
  const accepted = new Set([...before, ...monthKeys()].map((key) => `${prefix}${key}`))
  assert.ok(
    accepted.has(actual),
    `${actual} is not the current UTC month key (expected one of ${[...accepted].join(', ')})`
  )
}

function nextUtcMonthCandidates() {
  const now = new Date()
  return [
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString(),
  ]
}

function profile(overrides = {}) {
  return {
    id: OWNER,
    email: 'owner@example.com',
    plan: 'free',
    role: 'user',
    status: 'active',
    workspace_id: null,
    ...overrides,
  }
}

function subscriptionRow(overrides = {}) {
  return {
    id: 'sub_row_1',
    user_id: OWNER,
    stripe_subscription_id: 'sub_stripe_1',
    plan: 'pro',
    status: 'active',
    current_period_start: '2026-08-01T00:00:00.000Z',
    current_period_end: '2026-09-01T00:00:00.000Z',
    ...overrides,
  }
}

function soloDatabase({ profileRow, subscription, rpc } = {}) {
  return createStubDatabase({
    tables: {
      users_profile: [profileRow ?? profile()],
      subscriptions: subscription ? [subscription] : [],
    },
    rpc: rpc ?? {},
  })
}

/* ---------------------------------------------------------------- *
 * Included allowance per account state
 * ---------------------------------------------------------------- */

test('a Free account resolves to 5 lifetime credits that never expire', async () => {
  const db = soloDatabase()

  const context = await credits.resolveEmailCreditContext(db.client, OWNER)

  assert.equal(context.plan, 'free')
  assert.equal(context.allowanceSize, 5)
  assert.equal(context.allowanceKey, 'free:lifetime')
  assert.equal(context.allowanceEndsAt, null, 'a lifetime balance must not carry a period end')
  assert.equal(context.isShared, false)
  assert.equal(context.ownerId, OWNER)
})

test('a denormalized profile plan cannot buy paid credits without a live subscription', async () => {
  const db = soloDatabase({ profileRow: profile({ plan: 'agency' }) })

  const context = await credits.resolveEmailCreditContext(db.client, OWNER)

  assert.equal(context.plan, 'free')
  assert.equal(context.allowanceSize, 5)
})

test('a Pro trial resolves to 20 credits keyed to the trial, not to the month', async () => {
  const db = soloDatabase({
    subscription: subscriptionRow({ plan: 'pro', status: 'trialing' }),
  })

  const context = await credits.resolveEmailCreditContext(db.client, OWNER)

  assert.equal(context.plan, 'pro')
  assert.equal(context.allowanceSize, 20)
  assert.equal(context.allowanceKey, 'pro:trial:sub_stripe_1')
  assert.equal(context.allowanceEndsAt, '2026-09-01T00:00:00.000Z')
})

test('an Agency trial resolves to 50 credits shared by the workspace owner', async () => {
  const db = createStubDatabase({
    tables: {
      users_profile: [
        profile({ id: MEMBER, email: 'member@example.com', workspace_id: WORKSPACE }),
        profile({ id: OWNER, workspace_id: WORKSPACE }),
      ],
      workspaces: [{ id: WORKSPACE, owner_id: OWNER }],
      workspace_members: [{ id: 'wm_1', workspace_id: WORKSPACE, user_id: MEMBER }],
      subscriptions: [
        subscriptionRow({ plan: 'agency', status: 'trialing', stripe_subscription_id: 'sub_ag' }),
      ],
    },
  })

  const context = await credits.resolveEmailCreditContext(db.client, MEMBER)

  assert.equal(context.ownerId, OWNER, 'a member must consume the owner pool')
  assert.equal(context.actorUserId, MEMBER)
  assert.equal(context.isShared, true)
  assert.equal(context.plan, 'agency')
  assert.equal(context.allowanceSize, 50)
  assert.equal(context.allowanceKey, 'agency:trial:sub_ag')
})

test('an active Pro subscription resolves to 100 credits for the current month', async () => {
  const before = monthKeys()
  const db = soloDatabase({ subscription: subscriptionRow({ plan: 'pro', status: 'active' }) })

  const context = await credits.resolveEmailCreditContext(db.client, OWNER)

  assert.equal(context.plan, 'pro')
  assert.equal(context.allowanceSize, 100)
  assertCurrentMonthKey(context.allowanceKey, 'pro:month:', before)
  assert.ok(
    nextUtcMonthCandidates().includes(context.allowanceEndsAt),
    'a monthly allowance must end at the start of the next UTC month'
  )
})

test('an active Agency subscription resolves to 500 credits shared by the workspace', async () => {
  const before = monthKeys()
  const db = createStubDatabase({
    tables: {
      users_profile: [
        profile({ id: MEMBER, email: 'member@example.com', workspace_id: WORKSPACE }),
        profile({ id: OWNER, workspace_id: WORKSPACE }),
      ],
      workspaces: [{ id: WORKSPACE, owner_id: OWNER }],
      workspace_members: [{ id: 'wm_1', workspace_id: WORKSPACE, user_id: MEMBER }],
      subscriptions: [subscriptionRow({ plan: 'agency', status: 'active' })],
    },
  })

  const context = await credits.resolveEmailCreditContext(db.client, MEMBER)

  assert.equal(context.ownerId, OWNER)
  assert.equal(context.isShared, true)
  assert.equal(context.allowanceSize, 500)
  assertCurrentMonthKey(context.allowanceKey, 'agency:month:', before)
})

test('a member whose owner is no longer Agency falls back to their own balance', async () => {
  const db = createStubDatabase({
    tables: {
      users_profile: [
        profile({ id: MEMBER, email: 'member@example.com', workspace_id: WORKSPACE }),
        profile({ id: OWNER, workspace_id: WORKSPACE }),
      ],
      workspaces: [{ id: WORKSPACE, owner_id: OWNER }],
      workspace_members: [{ id: 'wm_1', workspace_id: WORKSPACE, user_id: MEMBER }],
      // The owner's Agency subscription was cancelled.
      subscriptions: [subscriptionRow({ plan: 'agency', status: 'cancelled' })],
    },
  })

  const context = await credits.resolveEmailCreditContext(db.client, MEMBER)

  assert.equal(context.ownerId, MEMBER, 'a stale workspace link must not share a lapsed pool')
  assert.equal(context.isShared, false)
  assert.equal(context.plan, 'free')
  assert.equal(context.allowanceSize, 5)
})

/* ---------------------------------------------------------------- *
 * Annual billing still buys a MONTHLY allowance
 * ---------------------------------------------------------------- */

function stripeSubscription({ id, priceId, status, periodEnd }) {
  return {
    id,
    status,
    items: { data: [{ price: { id: priceId }, current_period_end: periodEnd }] },
  }
}

async function syncedAllowance({ plan, subscription, dbRow }) {
  const db = soloDatabase({
    subscription: dbRow,
    rpc: { sync_email_credit_allowance: () => ({ data: [], error: null }) },
  })
  await credits.syncEmailCreditsForSubscription(db.client, OWNER, plan, subscription, 1_700)
  const calls = db.rpcArgs('sync_email_credit_allowance')
  assert.equal(calls.length, 1, 'exactly one allowance sync per subscription event')
  return calls[0]
}

test('an annual Pro subscription grants the monthly allowance, not a yearly block', async () => {
  const before = monthKeys()
  // A year of runway on the Stripe item. The allowance must ignore it.
  const oneYearOut = Math.floor(Date.UTC(2027, 7, 1) / 1000)
  const args = await syncedAllowance({
    plan: 'pro',
    subscription: stripeSubscription({
      id: 'sub_annual_pro',
      priceId: 'price_pro_annual',
      status: 'active',
      periodEnd: oneYearOut,
    }),
    dbRow: subscriptionRow({ plan: 'pro', status: 'active' }),
  })

  assert.equal(args.p_plan, 'pro')
  assert.equal(args.p_allowance_size, 100, 'annual billing must not multiply the allowance')
  assertCurrentMonthKey(args.p_allowance_key, 'pro:month:', before)
  assert.ok(
    nextUtcMonthCandidates().includes(args.p_allowance_ends_at),
    'the allowance must expire next month, not at the end of the annual term'
  )
  assert.notEqual(args.p_allowance_ends_at, new Date(oneYearOut * 1000).toISOString())
  assert.equal(args.p_source_version, 1_700)
})

test('an annual Agency subscription grants 500 per month, not 6000 per year', async () => {
  const before = monthKeys()
  const args = await syncedAllowance({
    plan: 'agency',
    subscription: stripeSubscription({
      id: 'sub_annual_agency',
      priceId: 'price_agency_annual',
      status: 'active',
      periodEnd: Math.floor(Date.UTC(2027, 7, 1) / 1000),
    }),
    dbRow: subscriptionRow({ plan: 'agency', status: 'active' }),
  })

  assert.equal(args.p_allowance_size, 500)
  assertCurrentMonthKey(args.p_allowance_key, 'agency:month:', before)
})

test('a trialing subscription webhook grants the trial allowance keyed to the subscription', async () => {
  const trialEnd = Math.floor(Date.UTC(2026, 7, 24) / 1000)
  const args = await syncedAllowance({
    plan: 'pro',
    subscription: stripeSubscription({
      id: 'sub_trial_pro',
      priceId: 'price_pro_monthly',
      status: 'trialing',
      periodEnd: trialEnd,
    }),
    dbRow: subscriptionRow({ plan: 'pro', status: 'trialing' }),
  })

  assert.equal(args.p_allowance_size, 20)
  assert.equal(args.p_allowance_key, 'pro:trial:sub_trial_pro')
  assert.equal(args.p_allowance_ends_at, new Date(trialEnd * 1000).toISOString())
})

test('a Stripe Price that disagrees with the requested plan grants nothing', async () => {
  const db = soloDatabase({
    subscription: subscriptionRow(),
    rpc: { sync_email_credit_allowance: () => ({ data: [], error: null }) },
  })

  await assert.rejects(
    credits.syncEmailCreditsForSubscription(
      db.client,
      OWNER,
      'agency',
      stripeSubscription({
        id: 'sub_mismatch',
        priceId: 'price_pro_monthly',
        status: 'active',
        periodEnd: 0,
      }),
      1
    ),
    /does not match the requested email-credit plan/
  )
  assert.equal(db.rpcArgs('sync_email_credit_allowance').length, 0)
})

test('an inactive Stripe subscription cannot receive credits', async () => {
  const db = soloDatabase({
    subscription: subscriptionRow(),
    rpc: { sync_email_credit_allowance: () => ({ data: [], error: null }) },
  })

  await assert.rejects(
    credits.syncEmailCreditsForSubscription(
      db.client,
      OWNER,
      'pro',
      stripeSubscription({
        id: 'sub_pastdue',
        priceId: 'price_pro_monthly',
        status: 'past_due',
        periodEnd: 0,
      }),
      1
    ),
    /Inactive Stripe subscription/
  )
  assert.equal(db.rpcArgs('sync_email_credit_allowance').length, 0)
})

test('a downgrade syncs the Free lifetime key against the billed user, not a workspace owner', async () => {
  const db = createStubDatabase({
    tables: {
      users_profile: [
        profile({ id: MEMBER, email: 'member@example.com', workspace_id: WORKSPACE }),
        profile({ id: OWNER, workspace_id: WORKSPACE }),
      ],
      workspaces: [{ id: WORKSPACE, owner_id: OWNER }],
      workspace_members: [{ id: 'wm_1', workspace_id: WORKSPACE, user_id: MEMBER }],
      subscriptions: [subscriptionRow({ plan: 'agency', status: 'active' })],
    },
    rpc: { sync_email_credit_allowance: () => ({ data: [], error: null }) },
  })

  await credits.syncEmailCreditsForFreePlan(db.client, MEMBER, 2_000)

  const [args] = db.rpcArgs('sync_email_credit_allowance')
  assert.equal(args.p_owner_id, MEMBER)
  assert.equal(args.p_plan, 'free')
  assert.equal(args.p_allowance_key, 'free:lifetime')
  assert.equal(args.p_allowance_size, 5)
  assert.equal(args.p_allowance_ends_at, null)
})

/* ---------------------------------------------------------------- *
 * Balance projection, including refund/chargeback debt
 * ---------------------------------------------------------------- */

test('a clawed-back balance surfaces as debt rather than as a negative balance', async () => {
  const db = soloDatabase({
    rpc: {
      get_email_credit_balance: () => [
        {
          included_remaining: 0,
          purchased_remaining: 0,
          credit_debt: 30,
          total_remaining: 0,
          allowance_key: 'free:lifetime',
          allowance_size: 5,
          allowance_ends_at: null,
        },
      ],
    },
  })
  const context = await credits.resolveEmailCreditContext(db.client, OWNER)

  const balance = await credits.readEmailCreditBalance(db.client, context)

  assert.equal(balance.creditDebt, 30)
  assert.equal(balance.purchasedRemaining, 0)
  assert.equal(balance.totalRemaining, 0)
  assert.ok(balance.totalRemaining >= 0, 'a customer balance is never shown as negative')
})

test('the lazy balance path skips the globally locking sync when the period already matches', async () => {
  const before = monthKeys()
  const db = soloDatabase({
    subscription: subscriptionRow({ plan: 'pro', status: 'active' }),
    rpc: {
      get_email_credit_balance: () => [
        {
          included_remaining: 42,
          purchased_remaining: 7,
          credit_debt: 0,
          total_remaining: 49,
          allowance_key: `pro:month:${before[0]}`,
          allowance_size: 100,
          allowance_ends_at: null,
        },
      ],
    },
  })

  const balance = await credits.prepareAndReadEmailCreditBalance(db.client, OWNER)

  assert.equal(balance.totalRemaining, 49)
  assert.equal(
    db.rpcArgs('sync_email_credit_allowance').length,
    0,
    'a matching period must not take the platform-wide advisory lock'
  )
  assert.equal(db.rpcArgs('get_email_credit_balance').length, 1)
})

/* ---------------------------------------------------------------- *
 * Schema-missing degradation
 * ---------------------------------------------------------------- */

test('every migration-missing error code is recognized, and nothing else is', () => {
  for (const error of SCHEMA_MISSING_ERRORS) {
    assert.equal(credits.isMissingEmailCreditSchema(error), true, error.code)
  }
  for (const error of [
    { code: '42501', message: 'permission denied' },
    { code: '23505', message: 'duplicate key value violates unique constraint' },
    { code: '40001', message: 'could not serialize access' },
    null,
    'boom',
  ]) {
    assert.equal(credits.isMissingEmailCreditSchema(error), false)
  }
})

test('a missing credit schema raises the distinct schema error, not a generic failure', async () => {
  for (const error of SCHEMA_MISSING_ERRORS) {
    const db = soloDatabase({
      subscription: subscriptionRow({ plan: 'pro', status: 'active' }),
      rpc: { sync_email_credit_allowance: () => ({ data: null, error }) },
    })
    const context = await credits.resolveEmailCreditContext(db.client, OWNER)

    await assert.rejects(
      credits.syncEmailCreditAllowance(db.client, context),
      (thrown) => {
        assert.equal(thrown.name, 'EmailCreditSchemaMissingError')
        assert.equal(credits.isMissingEmailCreditSchema(thrown), true)
        return true
      }
    )
  }
})

test('an unrelated database failure is not mistaken for a missing migration', async () => {
  const db = soloDatabase({
    subscription: subscriptionRow({ plan: 'pro', status: 'active' }),
    rpc: {
      sync_email_credit_allowance: () => ({
        data: null,
        error: { code: '42501', message: 'permission denied for function' },
      }),
    },
  })
  const context = await credits.resolveEmailCreditContext(db.client, OWNER)

  await assert.rejects(credits.syncEmailCreditAllowance(db.client, context), (thrown) => {
    assert.notEqual(thrown.name, 'EmailCreditSchemaMissingError')
    return true
  })
})
