/**
 * Refund and dispute clawback for one-time Email Finder credit packs.
 *
 * WHAT IS TYPESCRIPT AND WHAT IS SQL
 * ----------------------------------
 * The clawback is split across two layers, and only one of them is testable
 * without a live Postgres:
 *
 *   TypeScript (src/app/api/stripe/webhook/route.ts + src/lib/emailCredits.ts)
 *     decides, for every event in the refund and dispute lifecycle, WHICH
 *     PaymentIntent is affected, whether that source is currently `active`
 *     (money actually held by Stripe) and what idempotency key the adjustment
 *     carries. Getting `active` wrong is what turns a mere dispute inquiry into
 *     a permanent clawback, and it is decided entirely in TypeScript. Every
 *     case below is exercised through the real route handler.
 *
 *   SQL (adjust_email_credit_pack in supabase/migrations/20260818_email_credits.sql)
 *     owns the arithmetic: summing active refunds, taking the largest active
 *     dispute, reconciling the two so an overlapping refund and chargeback are
 *     not counted twice, and driving purchased_balance negative into debt when
 *     the credits were already spent. That is set-based PL/pgSQL over four
 *     tables. It cannot be unit tested here, and re-implementing it in
 *     JavaScript would only prove the copy agrees with itself, so the last
 *     section asserts the invariants against the migration text and the real
 *     verification stays the runbook's smoke-test matrix against a database.
 */
import assert from 'node:assert/strict'
import test, { beforeEach, afterEach } from 'node:test'
import { readFile } from 'node:fs/promises'
import { loadModuleGraph, repoPath } from './helpers/load-module-graph.mjs'
import { createStubDatabase } from './helpers/stub-database.mjs'

process.env.STRIPE_SECRET_KEY = 'sk_test_stub'
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_stub'
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://stub.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service_role_stub'
process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_pro_monthly'
process.env.STRIPE_PRICE_PRO_ANNUAL = 'price_pro_annual'
process.env.STRIPE_PRICE_AGENCY_MONTHLY = 'price_agency_monthly'
process.env.STRIPE_PRICE_AGENCY_ANNUAL = 'price_agency_annual'

const webhook = await loadModuleGraph(repoPath('src/app/api/stripe/webhook/route.ts'), {
  'next/server': repoPath('tests/helpers/stubs/next-server.ts'),
  stripe: repoPath('tests/helpers/stubs/stripe-client.ts'),
  '@supabase/supabase-js': repoPath('tests/helpers/stubs/supabase-service.ts'),
  nodemailer: repoPath('tests/helpers/stubs/nodemailer.ts'),
})

const migration = await readFile(
  repoPath('supabase/migrations/20260818_email_credits.sql'),
  'utf8'
)

const OWNER = '00000000-0000-4000-8000-000000000001'
const PAYMENT_INTENT = 'pi_pack_1'

/* Route handlers log deliberately. Capture rather than print, so the suite
 * stays readable and the log content itself can be asserted. */
const captured = { log: [], warn: [], error: [] }
const realConsole = { log: console.log, warn: console.warn, error: console.error }

beforeEach(() => {
  for (const level of ['log', 'warn', 'error']) {
    captured[level].length = 0
    console[level] = (...args) => captured[level].push(args.map(String).join(' '))
  }
})

afterEach(() => {
  Object.assign(console, realConsole)
  delete globalThis.__leadzipStripeStub
  delete globalThis.__leadzipSupabaseStub
})

async function deliver(event, { rpc = {}, tables = {}, stripe = {} } = {}) {
  const db = createStubDatabase({ tables, rpc })
  globalThis.__leadzipSupabaseStub = db.client
  globalThis.__leadzipStripeStub = {
    'webhooks.constructEvent': () => event,
    ...stripe,
  }
  const response = await webhook.POST({
    async text() {
      return '{}'
    },
    headers: new Headers({ 'stripe-signature': 't=1,v1=stub' }),
  })
  return { response, db, adjustments: db.rpcArgs('adjust_email_credit_pack') }
}

function refundEvent(refund, { id = 'evt_refund_1', type = 'refund.created' } = {}) {
  return { id, type, created: 1_700_000_000, data: { object: refund } }
}

function disputeEvent(dispute, { id = 'evt_dispute_1', type = 'charge.dispute.created' } = {}) {
  return { id, type, created: 1_700_000_100, data: { object: dispute } }
}

const adjusted = () => 'adjusted'

/* ---------------------------------------------------------------- *
 * Refunds
 * ---------------------------------------------------------------- */

test('a succeeded refund claws back against its PaymentIntent exactly once per event', async () => {
  const { response, adjustments } = await deliver(
    refundEvent({
      id: 're_1',
      status: 'succeeded',
      amount: 1_450,
      payment_intent: PAYMENT_INTENT,
    }),
    { rpc: { adjust_email_credit_pack: adjusted } }
  )

  assert.equal(response.status, 200)
  assert.equal(adjustments.length, 1)
  assert.deepEqual(adjustments[0], {
    p_payment_intent_id: PAYMENT_INTENT,
    p_event_key: 'stripe-event:evt_refund_1',
    p_source_type: 'refund',
    p_source_id: 're_1',
    p_amount_cents: 1_450,
    p_active: true,
  })
})

test('a refund that failed on creation never claws anything back', async () => {
  for (const status of ['failed', 'canceled']) {
    const { response, adjustments } = await deliver(
      refundEvent({ id: 're_1', status, amount: 2_900, payment_intent: PAYMENT_INTENT }),
      { rpc: { adjust_email_credit_pack: adjusted } }
    )
    assert.equal(response.status, 200)
    assert.equal(adjustments.length, 0, `refund.created status=${status}`)
  }
})

test('a refund that later fails reverses its own adjustment', async () => {
  for (const status of ['failed', 'canceled']) {
    const { response, adjustments } = await deliver(
      refundEvent(
        { id: 're_1', status, amount: 2_900, payment_intent: PAYMENT_INTENT },
        { id: 'evt_refund_2', type: 'refund.updated' }
      ),
      { rpc: { adjust_email_credit_pack: adjusted } }
    )

    assert.equal(response.status, 200)
    assert.equal(adjustments.length, 1, `refund.updated status=${status}`)
    assert.equal(
      adjustments[0].p_active,
      false,
      'a failed refund must deactivate the source so the credits come back'
    )
    assert.equal(adjustments[0].p_source_id, 're_1', 'the reversal targets the same source row')
  }
})

test('a refund that settles keeps its adjustment active on update', async () => {
  const { adjustments } = await deliver(
    refundEvent(
      { id: 're_1', status: 'succeeded', amount: 2_900, payment_intent: PAYMENT_INTENT },
      { id: 'evt_refund_3', type: 'refund.updated' }
    ),
    { rpc: { adjust_email_credit_pack: adjusted } }
  )

  assert.equal(adjustments[0].p_active, true)
})

test('a refund payload without a PaymentIntent is resolved through its charge', async () => {
  const { adjustments } = await deliver(
    refundEvent({ id: 're_1', status: 'succeeded', amount: 900, charge: 'ch_1' }),
    {
      rpc: { adjust_email_credit_pack: adjusted },
      stripe: {
        'charges.retrieve': async (id) => {
          assert.equal(id, 'ch_1')
          return { id: 'ch_1', payment_intent: PAYMENT_INTENT }
        },
      },
    }
  )

  assert.equal(adjustments.length, 1)
  assert.equal(adjustments[0].p_payment_intent_id, PAYMENT_INTENT)
})

test('a refund with neither a PaymentIntent nor a charge is acknowledged, not retried forever', async () => {
  const { response, adjustments } = await deliver(
    refundEvent({ id: 're_1', status: 'succeeded', amount: 900 }),
    { rpc: { adjust_email_credit_pack: adjusted } }
  )

  assert.equal(response.status, 200)
  assert.equal(adjustments.length, 0)
})

/* ---------------------------------------------------------------- *
 * Disputes: only states where Stripe is actually holding the money
 * ---------------------------------------------------------------- */

const DISPUTE_STATES = [
  { status: 'warning_needs_response', withdrawn: false, note: 'inquiry, no funds moved' },
  { status: 'warning_under_review', withdrawn: false, note: 'inquiry under review' },
  { status: 'warning_closed', withdrawn: false, note: 'inquiry closed' },
  { status: 'needs_response', withdrawn: true, note: 'chargeback, funds held' },
  { status: 'under_review', withdrawn: true, note: 'chargeback under review' },
  { status: 'lost', withdrawn: true, note: 'chargeback lost' },
  { status: 'won', withdrawn: false, note: 'funds returned' },
  { status: 'charge_refunded', withdrawn: false, note: 'settled by refund instead' },
  { status: 'prevented', withdrawn: false, note: 'chargeback never happened' },
]

for (const state of DISPUTE_STATES) {
  test(`a dispute in ${state.status} sets active=${state.withdrawn} (${state.note})`, async () => {
    const { response, adjustments } = await deliver(
      disputeEvent({ id: 'dp_1', status: state.status, amount: 2_900 }),
      {
        rpc: { adjust_email_credit_pack: adjusted },
        stripe: {
          'disputes.retrieve': async () => ({
            id: 'dp_1',
            status: state.status,
            amount: 2_900,
            payment_intent: PAYMENT_INTENT,
          }),
        },
      }
    )

    assert.equal(response.status, 200)
    assert.equal(adjustments.length, 1)
    assert.equal(adjustments[0].p_source_type, 'dispute')
    assert.equal(adjustments[0].p_active, state.withdrawn)
  })
}

test('a dispute INQUIRY does not claw back funds even on the funds_withdrawn topic', async () => {
  // The topic is not the authority; the re-read status is.
  const { adjustments } = await deliver(
    disputeEvent(
      { id: 'dp_1', status: 'warning_needs_response', amount: 2_900 },
      { id: 'evt_dispute_9', type: 'charge.dispute.funds_withdrawn' }
    ),
    {
      rpc: { adjust_email_credit_pack: adjusted },
      stripe: {
        'disputes.retrieve': async () => ({
          id: 'dp_1',
          status: 'warning_needs_response',
          amount: 2_900,
          payment_intent: PAYMENT_INTENT,
        }),
      },
    }
  )

  assert.equal(adjustments[0].p_active, false)
})

test('a late created delivery cannot revoke credits for a dispute already won', async () => {
  const { adjustments } = await deliver(
    // Stale payload still says the money is held.
    disputeEvent({ id: 'dp_1', status: 'needs_response', amount: 2_900 }),
    {
      rpc: { adjust_email_credit_pack: adjusted },
      stripe: {
        'disputes.retrieve': async () => ({
          id: 'dp_1',
          status: 'won',
          amount: 2_900,
          payment_intent: PAYMENT_INTENT,
        }),
      },
    }
  )

  assert.equal(adjustments[0].p_active, false, 'the live dispute status wins over the payload')
})

test('an inquiry that escalates starts revoking on the same source row', async () => {
  const { adjustments } = await deliver(
    disputeEvent(
      { id: 'dp_1', status: 'warning_needs_response', amount: 2_900 },
      { id: 'evt_dispute_10', type: 'charge.dispute.updated' }
    ),
    {
      rpc: { adjust_email_credit_pack: adjusted },
      stripe: {
        'disputes.retrieve': async () => ({
          id: 'dp_1',
          status: 'lost',
          amount: 2_900,
          payment_intent: PAYMENT_INTENT,
        }),
      },
    }
  )

  assert.equal(adjustments[0].p_active, true)
  assert.equal(adjustments[0].p_source_id, 'dp_1')
})

/* ---------------------------------------------------------------- *
 * Overlapping refund and dispute on one PaymentIntent
 * ---------------------------------------------------------------- */

test('an overlapping refund and dispute are two distinct sources on one purchase', async () => {
  const seen = []
  const rpc = {
    adjust_email_credit_pack: (args) => {
      seen.push(args)
      return 'adjusted'
    },
  }

  await deliver(
    refundEvent({
      id: 're_partial',
      status: 'succeeded',
      amount: 1_450,
      payment_intent: PAYMENT_INTENT,
    }),
    { rpc }
  )
  await deliver(
    disputeEvent({ id: 'dp_full', status: 'lost', amount: 2_900 }),
    {
      rpc,
      stripe: {
        'disputes.retrieve': async () => ({
          id: 'dp_full',
          status: 'lost',
          amount: 2_900,
          payment_intent: PAYMENT_INTENT,
        }),
      },
    }
  )

  assert.equal(seen.length, 2)
  assert.equal(seen[0].p_payment_intent_id, seen[1].p_payment_intent_id)
  assert.deepEqual(
    seen.map((call) => call.p_source_type),
    ['refund', 'dispute']
  )
  assert.notEqual(seen[0].p_source_id, seen[1].p_source_id)
  assert.notEqual(seen[0].p_event_key, seen[1].p_event_key)
  // The route reports each source at its own face value and never adds them
  // together. Reconciling the overlap is the RPC's job, asserted against the
  // migration text at the bottom of this file.
  assert.equal(seen[0].p_amount_cents, 1_450)
  assert.equal(seen[1].p_amount_cents, 2_900)
})

test('a redelivered adjustment event is idempotent on the Stripe event id', async () => {
  const keys = []
  const rpc = {
    adjust_email_credit_pack: (args) => {
      const duplicate = keys.includes(args.p_event_key)
      keys.push(args.p_event_key)
      return duplicate ? 'duplicate' : 'adjusted'
    },
  }
  const event = refundEvent({
    id: 're_1',
    status: 'succeeded',
    amount: 2_900,
    payment_intent: PAYMENT_INTENT,
  })

  const first = await deliver(event, { rpc })
  const second = await deliver(event, { rpc })

  assert.equal(first.response.status, 200)
  assert.equal(second.response.status, 200, 'a duplicate must be acknowledged, not retried')
  assert.deepEqual(keys, ['stripe-event:evt_refund_1', 'stripe-event:evt_refund_1'])
})

/* ---------------------------------------------------------------- *
 * Ordering: an adjustment that beats its own grant
 * ---------------------------------------------------------------- */

test('a clawback for an unknown PaymentIntent that is a pack forces a Stripe retry', async () => {
  const { response } = await deliver(
    refundEvent({
      id: 're_1',
      status: 'succeeded',
      amount: 2_900,
      payment_intent: PAYMENT_INTENT,
    }),
    {
      rpc: { adjust_email_credit_pack: () => 'not_pack' },
      stripe: {
        'paymentIntents.retrieve': async () => ({
          id: PAYMENT_INTENT,
          metadata: { kind: 'email_credit_pack' },
        }),
      },
    }
  )

  assert.equal(
    response.status,
    500,
    'acknowledging here would permanently lose the clawback for a pack whose grant is still in flight'
  )
})

test('a refund of an ordinary subscription charge is acknowledged without a clawback', async () => {
  const { response } = await deliver(
    refundEvent({
      id: 're_sub',
      status: 'succeeded',
      amount: 4_900,
      payment_intent: 'pi_subscription_1',
    }),
    {
      rpc: { adjust_email_credit_pack: () => 'not_pack' },
      stripe: {
        'paymentIntents.retrieve': async () => ({
          id: 'pi_subscription_1',
          metadata: { kind: 'subscription' },
        }),
      },
    }
  )

  assert.equal(response.status, 200)
})

/* ---------------------------------------------------------------- *
 * Pack fulfilment through the real webhook entry point
 * ---------------------------------------------------------------- */

function packCheckoutEvent(id = 'evt_checkout_1') {
  return {
    id,
    type: 'checkout.session.completed',
    created: 1_700_000_200,
    data: {
      object: {
        id: 'cs_pack_1',
        mode: 'payment',
        metadata: { kind: 'email_credit_pack' },
      },
    },
  }
}

const PAID_PACK_SESSION = {
  id: 'cs_pack_1',
  mode: 'payment',
  payment_status: 'paid',
  amount_subtotal: 900,
  amount_total: 900,
  currency: 'usd',
  client_reference_id: OWNER,
  payment_intent: PAYMENT_INTENT,
  metadata: {
    kind: 'email_credit_pack',
    user_id: OWNER,
    balance_owner_id: OWNER,
    pack_slug: '50',
  },
  line_items: { data: [{ quantity: 1, price: { id: 'price_credits_50' } }] },
}

test('replaying a pack checkout webhook answers 200 and grants once', async () => {
  const granted = new Set()
  const rpc = {
    grant_email_credit_pack: (args) => {
      if (granted.has(args.p_checkout_session_id)) return false
      granted.add(args.p_checkout_session_id)
      return true
    },
  }
  const stripe = { 'checkout.sessions.retrieve': async () => PAID_PACK_SESSION }

  const first = await deliver(packCheckoutEvent(), { rpc, stripe })
  const second = await deliver(packCheckoutEvent('evt_checkout_2'), { rpc, stripe })

  assert.equal(first.response.status, 200)
  assert.equal(second.response.status, 200)
  assert.equal(granted.size, 1)
})

test('a pack that could not be fulfilled answers non-2xx so Stripe retries', async () => {
  const { response } = await deliver(packCheckoutEvent(), {
    rpc: {},
    stripe: {
      'checkout.sessions.retrieve': async () => ({
        ...PAID_PACK_SESSION,
        payment_status: 'unpaid',
      }),
    },
  })

  assert.equal(response.status, 500)
  assert.match(captured.error.join('\n'), /payment_not_paid/)
})

/**
 * A pack that was paid for while the credit migration is still pending must not
 * be acknowledged, or the customer's money is kept and the credits are never
 * delivered. fulfillEmailCreditPackCheckout deliberately rethrows the schema
 * error for that reason, and the webhook does not catch it, so the request
 * fails and Stripe retries after the migration runs.
 *
 * Recorded as it actually behaves: this escapes POST as a rejected promise
 * rather than as a controlled NextResponse. The retry outcome is right (Next
 * turns it into a 500), but unlike the subscription paths it is not an explicit
 * decision in the handler. Production cannot hit it today, since pack sales are
 * disabled and no Checkout Session with kind=email_credit_pack exists.
 */
test('a paid pack against an unmigrated database is not acknowledged', async () => {
  await assert.rejects(
    deliver(packCheckoutEvent(), {
      rpc: {
        grant_email_credit_pack: () => ({
          data: null,
          error: {
            code: '42883',
            message: 'function public.grant_email_credit_pack(...) does not exist',
          },
        }),
      },
      stripe: { 'checkout.sessions.retrieve': async () => PAID_PACK_SESSION },
    }),
    (thrown) => {
      assert.equal(thrown.name, 'EmailCreditSchemaMissingError')
      return true
    }
  )
})

/* ---------------------------------------------------------------- *
 * Unmigrated database
 * ---------------------------------------------------------------- */

const SCHEMA_MISSING = {
  code: '42883',
  message: 'function public.sync_email_credit_allowance(...) does not exist',
}

function invoicePaidEvent() {
  return {
    id: 'evt_invoice_1',
    type: 'invoice.paid',
    created: 1_700_000_300,
    data: {
      object: {
        id: 'in_1',
        customer: 'cus_1',
        amount_paid: 49_900,
        currency: 'usd',
        billing_reason: 'subscription_cycle',
        parent: {
          subscription_details: {
            subscription: 'sub_annual',
            metadata: { user_id: OWNER },
          },
        },
      },
    },
  }
}

const ANNUAL_SUBSCRIPTION = {
  id: 'sub_annual',
  status: 'active',
  items: {
    data: [
      {
        price: { id: 'price_pro_annual', unit_amount: 49_900, currency: 'usd' },
        current_period_end: Math.floor(Date.UTC(2027, 7, 1) / 1000),
      },
    ],
  },
}

const PROFILE_TABLES = {
  users_profile: [
    {
      id: OWNER,
      email: 'owner@example.com',
      plan: 'pro',
      role: 'user',
      status: 'active',
      workspace_id: null,
      gclid: null,
    },
  ],
  subscriptions: [
    {
      id: 'sub_row',
      user_id: OWNER,
      stripe_subscription_id: 'sub_annual',
      plan: 'pro',
      status: 'active',
      current_period_start: '2026-08-01T00:00:00.000Z',
      current_period_end: '2027-08-01T00:00:00.000Z',
    },
  ],
}

test('an annual invoice still syncs only the monthly allowance', async () => {
  const { response, db } = await deliver(invoicePaidEvent(), {
    tables: PROFILE_TABLES,
    rpc: { sync_email_credit_allowance: () => [] },
    stripe: { 'subscriptions.retrieve': async () => ANNUAL_SUBSCRIPTION },
  })

  assert.equal(response.status, 200)
  const [args] = db.rpcArgs('sync_email_credit_allowance')
  assert.equal(args.p_allowance_size, 100)
  assert.match(args.p_allowance_key, /^pro:month:\d{4}-\d{2}$/)
})

test('a missing credit schema does not turn a subscription webhook into a retry loop', async () => {
  const { response } = await deliver(invoicePaidEvent(), {
    tables: PROFILE_TABLES,
    rpc: { sync_email_credit_allowance: () => ({ data: null, error: SCHEMA_MISSING }) },
    stripe: { 'subscriptions.retrieve': async () => ANNUAL_SUBSCRIPTION },
  })

  assert.equal(response.status, 200)
  assert.match(captured.error.join('\n'), /email credit schema not migrated yet/)
})

test('a real credit failure on a subscription webhook is still reported as non-2xx', async () => {
  const { response } = await deliver(invoicePaidEvent(), {
    tables: PROFILE_TABLES,
    rpc: {
      sync_email_credit_allowance: () => ({
        data: null,
        error: { code: '42501', message: 'permission denied for function' },
      }),
    },
    stripe: { 'subscriptions.retrieve': async () => ANNUAL_SUBSCRIPTION },
  })

  assert.equal(response.status, 500)
})

/**
 * Refund and dispute handlers degrade like the subscription-shaped ones.
 *
 * When 20260818_email_credits.sql is not applied, adjust_email_credit_pack does
 * not exist, so a refund or dispute has no ledger to adjust. The handler now
 * inspects isMissingEmailCreditSchema and breaks with a 200 instead of a 500,
 * so a subscription refund delivered before the migration does not put Stripe
 * into a retry cycle. Production is in exactly this state today. Once the
 * migration is applied the pack ledger exists and adjustments run normally,
 * which the other clawback tests in this file cover.
 */
test('a refund against an unmigrated database degrades to 200, like the subscription paths', async () => {
  const { response } = await deliver(
    refundEvent({
      id: 're_1',
      status: 'succeeded',
      amount: 4_900,
      payment_intent: 'pi_subscription_1',
    }),
    {
      rpc: {
        adjust_email_credit_pack: () => ({
          data: null,
          error: { code: '42883', message: 'function public.adjust_email_credit_pack(...) does not exist' },
        }),
      },
    }
  )

  assert.equal(
    response.status,
    200,
    'a missing credit schema must not make Stripe retry a refund it cannot yet record'
  )
})

/* ---------------------------------------------------------------- *
 * SQL-only invariants
 *
 * Everything below is decided by PL/pgSQL and needs a real database to verify
 * behaviourally. These assertions pin the shape of the SQL so a refactor cannot
 * quietly drop an invariant; they are not a substitute for the runbook's
 * database smoke tests.
 * ---------------------------------------------------------------- */

test('SQL: included credits are spent before purchased credits', () => {
  assert.match(
    migration,
    /if account\.included_balance > 0 then\s*included_change := -1;\s*else\s*purchased_change := -1;\s*end if;/
  )
})

test('SQL: an overlapping refund and dispute are reconciled, not summed', () => {
  // Multiple partial refunds add up; a dispute is one hold, so the largest wins.
  assert.match(
    migration,
    /select coalesce\(sum\(amount_cents\), 0\)\s*into refund_amount[\s\S]*?source_type = 'refund' and active/
  )
  assert.match(
    migration,
    /select coalesce\(max\(amount_cents\), 0\)\s*into dispute_amount[\s\S]*?source_type = 'dispute' and active/
  )
  // The two overlap, so the effective clawback is the larger, capped at what
  // the customer actually paid.
  assert.match(
    migration,
    /adverse_amount := least\(purchase\.amount_paid::bigint, greatest\(refund_amount, dispute_amount\)\)/
  )
})

test('SQL: an inactive source is excluded, so a won dispute or failed refund reverses', () => {
  // The upsert rewrites `active` for an existing (purchase, type, id) row, and
  // both aggregates above filter on `active`, so deactivating a source restores
  // the credits through the same delta path that removed them.
  assert.match(
    migration,
    /on conflict \(purchase_id, source_type, source_id\) do update\s*set amount_cents = excluded\.amount_cents,\s*active = excluded\.active/
  )
  assert.match(migration, /purchased_delta := purchase\.revoked_credits - desired_revoked;/)
  assert.match(migration, /set revoked_credits = desired_revoked/)
})

test('SQL: the clawback is proportional and never exceeds the credits sold', () => {
  assert.match(
    migration,
    /least\(\s*purchase\.credits,\s*ceil\(\(purchase\.credits::numeric \* adverse_amount::numeric\) \/ purchase\.amount_paid::numeric\)::integer\s*\)/
  )
})

test('SQL: used-then-refunded credits become debt instead of a negative shown balance', () => {
  // purchased_balance is deliberately the one balance column with no >= 0 check.
  assert.match(
    migration,
    /purchased_balance integer not null default 0,/,
    'purchased_balance must be allowed to go negative to carry debt'
  )
  assert.match(migration, /included_balance integer not null default 0 check \(included_balance >= 0\)/)
  // Reads clamp: the customer sees zero and a debt figure, never a negative.
  assert.match(migration, /greatest\(purchased_balance, 0\),\s*greatest\(-purchased_balance, 0\),/)
  assert.match(migration, /greatest\(included_balance \+ purchased_balance, 0\),/)
  // A later pack adds to the same column, so the debt offsets the new grant.
  assert.match(migration, /set purchased_balance = purchased_balance \+ p_credits,/)
  // And a negative purchased balance holds back included credits too, because
  // the spend gate is the combined total.
  assert.match(migration, /account\.included_balance \+ account\.purchased_balance <= 0 then/)
})

test('SQL: an adjustment is idempotent on the Stripe event key', () => {
  assert.match(
    migration,
    /where owner_id = purchase\.owner_id and idempotency_key = p_event_key[\s\S]*?return 'duplicate';/
  )
  assert.match(migration, /unique \(owner_id, idempotency_key\)/)
})

test('SQL: a pack is granted once per Checkout Session', () => {
  assert.match(migration, /stripe_checkout_session_id text not null unique/)
  assert.match(migration, /stripe_payment_intent_id text not null unique/)
  assert.match(migration, /on conflict do nothing\s*returning id into purchase_id;/)
  assert.match(migration, /if purchase_id is null then\s*return false;/)
})
