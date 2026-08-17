/**
 * One-time Email Finder credit packs: taking the money and delivering it once.
 *
 * fulfillEmailCreditPackCheckout is the last gate before credits are minted, so
 * everything it refuses is asserted here alongside everything it must still
 * honour. The grant itself is a single RPC whose exactly-once guarantee is the
 * unique index on email_credit_purchases.stripe_checkout_session_id; that index
 * is SQL and needs a real database. The stub below stands in for it explicitly
 * so the TypeScript claim under test stays honest: given a second call for a
 * session already fulfilled, the service reports granted=false and does not
 * mint a second time.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { loadModuleGraph, repoPath } from './helpers/load-module-graph.mjs'
import { createStubDatabase } from './helpers/stub-database.mjs'

const credits = await loadModuleGraph(repoPath('src/lib/emailCredits.ts'), {
  stripe: repoPath('tests/helpers/stubs/stripe.ts'),
  '@supabase/supabase-js': repoPath('tests/helpers/stubs/supabase-js.ts'),
})

const checkoutRoute = await loadModuleGraph(
  repoPath('src/app/api/credits/email/checkout/route.ts'),
  {
    'next/server': repoPath('tests/helpers/stubs/next-server.ts'),
    stripe: repoPath('tests/helpers/stubs/stripe-client.ts'),
    '@supabase/supabase-js': repoPath('tests/helpers/stubs/supabase-service.ts'),
    '@/lib/supabase/server': repoPath('tests/helpers/stubs/supabase-server.ts'),
    '@/lib/requireActiveUser': repoPath('tests/helpers/stubs/require-active-user.ts'),
  }
)

const OWNER = '00000000-0000-4000-8000-000000000001'
const MEMBER = '00000000-0000-4000-8000-000000000002'

function packSession(overrides = {}) {
  return {
    id: 'cs_test_1',
    mode: 'payment',
    payment_status: 'paid',
    amount_subtotal: 2_900,
    amount_total: 2_900,
    currency: 'usd',
    client_reference_id: OWNER,
    payment_intent: 'pi_test_1',
    metadata: {
      kind: 'email_credit_pack',
      user_id: OWNER,
      balance_owner_id: OWNER,
      pack_slug: '250',
    },
    line_items: { data: [{ quantity: 1, price: { id: 'price_credits_250' } }] },
    ...overrides,
  }
}

function stripeStub(session) {
  const retrieved = []
  return {
    retrieved,
    client: {
      checkout: {
        sessions: {
          async retrieve(id, params) {
            retrieved.push({ id, params })
            if (session instanceof Error) throw session
            return session
          },
        },
      },
    },
  }
}

/**
 * Stand-in for grant_email_credit_pack. The real function inserts into
 * email_credit_purchases with `on conflict do nothing returning id` and returns
 * false when nothing was inserted; this mirrors only that contract, keyed on
 * the same unique column, so a replay is a genuine second call that the ledger
 * refuses rather than a call the test skips.
 */
function grantLedger() {
  const purchases = new Map()
  let balance = 0
  return {
    purchases,
    get balance() {
      return balance
    },
    handler(args) {
      if (purchases.has(args.p_checkout_session_id)) return false
      purchases.set(args.p_checkout_session_id, args)
      balance += args.p_credits
      return true
    },
  }
}

/* ---------------------------------------------------------------- *
 * Exactly-once fulfilment
 * ---------------------------------------------------------------- */

test('replaying checkout.session.completed grants the pack exactly once', async () => {
  const ledger = grantLedger()
  const db = createStubDatabase({
    rpc: { grant_email_credit_pack: (args) => ledger.handler(args) },
  })
  const stripe = stripeStub(packSession())

  const first = await credits.fulfillEmailCreditPackCheckout(stripe.client, db.client, 'cs_test_1')
  const second = await credits.fulfillEmailCreditPackCheckout(stripe.client, db.client, 'cs_test_1')
  const third = await credits.fulfillEmailCreditPackCheckout(stripe.client, db.client, 'cs_test_1')

  assert.deepEqual(first, { ok: true, granted: true })
  assert.deepEqual(second, { ok: true, granted: false })
  assert.deepEqual(third, { ok: true, granted: false })
  assert.equal(ledger.purchases.size, 1)
  assert.equal(ledger.balance, 250, '250 credits, once, no matter how often Stripe retries')
  assert.equal(
    db.rpcArgs('grant_email_credit_pack').length,
    3,
    'every replay reaches the idempotent RPC rather than being short-circuited'
  )
})

test('the grant is built from the recorded pack slug, never from client input', async () => {
  const ledger = grantLedger()
  const db = createStubDatabase({
    rpc: { grant_email_credit_pack: (args) => ledger.handler(args) },
  })
  // A tampered session that asks for a thousand-credit pack at the 250 price.
  const stripe = stripeStub(
    packSession({
      metadata: {
        kind: 'email_credit_pack',
        user_id: OWNER,
        balance_owner_id: OWNER,
        pack_slug: '250',
        credits: '1000',
      },
    })
  )

  await credits.fulfillEmailCreditPackCheckout(stripe.client, db.client, 'cs_test_1')

  const [args] = db.rpcArgs('grant_email_credit_pack')
  assert.equal(args.p_credits, 250)
  assert.equal(args.p_amount_paid, 2_900)
  assert.equal(args.p_currency, 'usd')
  assert.equal(args.p_pack_slug, '250')
  assert.equal(args.p_owner_id, OWNER)
  assert.equal(args.p_payment_intent_id, 'pi_test_1')
})

test('a Price rotated after payment still delivers the credits that were bought', async () => {
  const previous = process.env.STRIPE_PRICE_EMAIL_CREDITS_250
  process.env.STRIPE_PRICE_EMAIL_CREDITS_250 = 'price_credits_250_v2'
  const warnings = []
  const realWarn = console.warn
  console.warn = (message) => warnings.push(String(message))
  try {
    const ledger = grantLedger()
    const db = createStubDatabase({
      rpc: { grant_email_credit_pack: (args) => ledger.handler(args) },
    })
    const stripe = stripeStub(packSession())

    const result = await credits.fulfillEmailCreditPackCheckout(
      stripe.client,
      db.client,
      'cs_test_1'
    )

    assert.deepEqual(result, { ok: true, granted: true })
    assert.equal(ledger.balance, 250)
    assert.equal(warnings.length, 1, 'the operator is warned but the customer is still served')
  } finally {
    console.warn = realWarn
    if (previous === undefined) delete process.env.STRIPE_PRICE_EMAIL_CREDITS_250
    else process.env.STRIPE_PRICE_EMAIL_CREDITS_250 = previous
  }
})

/* ---------------------------------------------------------------- *
 * Refusals: nothing is minted unless Stripe says it was paid for
 * ---------------------------------------------------------------- */

const REFUSALS = [
  {
    name: 'an unpaid session',
    session: packSession({ payment_status: 'unpaid' }),
    error: 'payment_not_paid',
  },
  {
    name: 'a session whose subtotal was tampered with',
    session: packSession({ amount_subtotal: 100 }),
    error: 'price_amount_mismatch',
  },
  {
    name: 'a session whose total does not match the pack',
    session: packSession({ amount_total: 100 }),
    error: 'price_amount_mismatch',
  },
  {
    name: 'a session paid in another currency',
    session: packSession({ currency: 'eur' }),
    error: 'price_amount_mismatch',
  },
  {
    name: 'a quantity greater than one',
    session: packSession({
      line_items: { data: [{ quantity: 2, price: { id: 'price_credits_250' } }] },
    }),
    error: 'invalid_line_items',
  },
  {
    name: 'more than one line item',
    session: packSession({
      line_items: {
        data: [
          { quantity: 1, price: { id: 'price_credits_250' } },
          { quantity: 1, price: { id: 'price_credits_50' } },
        ],
      },
    }),
    error: 'invalid_line_items',
  },
  {
    name: 'a line item with no Price',
    session: packSession({ line_items: { data: [{ quantity: 1, price: null }] } }),
    error: 'missing_price',
  },
  {
    name: 'an unknown pack slug',
    session: packSession({
      metadata: {
        kind: 'email_credit_pack',
        user_id: OWNER,
        balance_owner_id: OWNER,
        pack_slug: '999',
      },
    }),
    error: 'unrecognized_pack',
  },
  {
    name: 'a client_reference_id that does not match the recorded buyer',
    session: packSession({ client_reference_id: MEMBER }),
    error: 'missing_purchase_identity',
  },
  {
    name: 'a session with no PaymentIntent to claw back against',
    session: packSession({ payment_intent: null }),
    error: 'missing_purchase_identity',
  },
  {
    name: 'a teammate buying against the owner balance',
    session: packSession({
      client_reference_id: MEMBER,
      metadata: {
        kind: 'email_credit_pack',
        user_id: MEMBER,
        balance_owner_id: OWNER,
        pack_slug: '250',
      },
    }),
    error: 'purchase_owner_mismatch',
  },
]

for (const refusal of REFUSALS) {
  test(`${refusal.name} mints nothing`, async () => {
    const db = createStubDatabase({
      rpc: {
        grant_email_credit_pack: () => {
          throw new Error('the grant RPC must not be reached')
        },
      },
    })
    const stripe = stripeStub(refusal.session)

    const result = await credits.fulfillEmailCreditPackCheckout(
      stripe.client,
      db.client,
      'cs_test_1'
    )

    assert.deepEqual(result, { ok: false, granted: false, error: refusal.error })
    assert.equal(db.rpcArgs('grant_email_credit_pack').length, 0)
  })
}

test('a session that is not a credit pack is ignored rather than failed', async () => {
  const db = createStubDatabase({ rpc: {} })
  for (const session of [
    packSession({ mode: 'subscription' }),
    packSession({ metadata: { kind: 'something_else' } }),
    packSession({ metadata: {} }),
  ]) {
    const result = await credits.fulfillEmailCreditPackCheckout(
      stripeStub(session).client,
      db.client,
      'cs_test_1'
    )
    assert.deepEqual(result, { ok: true, granted: false, ignored: true })
  }
  assert.equal(db.rpcCalls.length, 0)
})

test('an unreadable Checkout Session fails soft so Stripe retries', async () => {
  const db = createStubDatabase({ rpc: {} })
  const stripe = stripeStub(new Error('network'))

  const result = await credits.fulfillEmailCreditPackCheckout(stripe.client, db.client, 'cs_x')

  assert.deepEqual(result, { ok: false, granted: false, error: 'session_retrieve_failed' })
})

/* ---------------------------------------------------------------- *
 * The feature flag gates SELLING, never DELIVERING
 * ---------------------------------------------------------------- */

test('packs are disabled unless the flag is the literal string true', () => {
  const previous = process.env.EMAIL_CREDIT_PACKS_ENABLED
  try {
    for (const value of [undefined, '', 'false', 'TRUE', '1', 'yes']) {
      if (value === undefined) delete process.env.EMAIL_CREDIT_PACKS_ENABLED
      else process.env.EMAIL_CREDIT_PACKS_ENABLED = value
      assert.equal(credits.emailCreditPacksEnabled(), false, String(value))
    }
    process.env.EMAIL_CREDIT_PACKS_ENABLED = 'true'
    assert.equal(credits.emailCreditPacksEnabled(), true)
  } finally {
    if (previous === undefined) delete process.env.EMAIL_CREDIT_PACKS_ENABLED
    else process.env.EMAIL_CREDIT_PACKS_ENABLED = previous
  }
})

test('with packs disabled the checkout route refuses to start a new purchase', async () => {
  const previous = process.env.EMAIL_CREDIT_PACKS_ENABLED
  delete process.env.EMAIL_CREDIT_PACKS_ENABLED
  globalThis.__leadzipAuthStub = { ok: true, user: { id: OWNER, email: 'owner@example.com' } }
  // Anything that reaches Stripe or the database after the gate throws.
  globalThis.__leadzipStripeStub = {}
  globalThis.__leadzipSupabaseStub = undefined
  try {
    const response = await checkoutRoute.POST({
      async json() {
        return { pack: '250' }
      },
    })

    assert.equal(response.status, 503)
    const body = await response.json()
    assert.equal(body.error, 'Email credit packs are not available yet.')
    assert.equal(body.url, undefined)
    // House rule: no em dashes, and nothing internal in a user-facing string.
    assert.equal(body.error.includes('—'), false)
    assert.match(body.error, /^[\w\s.,']+$/)
  } finally {
    if (previous === undefined) delete process.env.EMAIL_CREDIT_PACKS_ENABLED
    else process.env.EMAIL_CREDIT_PACKS_ENABLED = previous
    delete globalThis.__leadzipAuthStub
    delete globalThis.__leadzipStripeStub
  }
})

test('a Checkout Session Stripe already marked paid is fulfilled even with packs disabled', async () => {
  const previous = process.env.EMAIL_CREDIT_PACKS_ENABLED
  delete process.env.EMAIL_CREDIT_PACKS_ENABLED
  try {
    assert.equal(
      credits.emailCreditPacksEnabled(),
      false,
      'precondition: sales are switched off'
    )
    const ledger = grantLedger()
    const db = createStubDatabase({
      rpc: { grant_email_credit_pack: (args) => ledger.handler(args) },
    })

    const result = await credits.fulfillEmailCreditPackCheckout(
      stripeStub(packSession()).client,
      db.client,
      'cs_test_1'
    )

    assert.deepEqual(result, { ok: true, granted: true })
    assert.equal(
      ledger.balance,
      250,
      'turning sales off must never take money without delivering credits'
    )
  } finally {
    if (previous === undefined) delete process.env.EMAIL_CREDIT_PACKS_ENABLED
    else process.env.EMAIL_CREDIT_PACKS_ENABLED = previous
  }
})

/* ---------------------------------------------------------------- *
 * Schema-missing: a paid pack must be retried, not written off
 * ---------------------------------------------------------------- */

test('a paid pack against an unmigrated database raises the retryable schema error', async () => {
  for (const error of [
    { code: '42883', message: 'function public.grant_email_credit_pack(...) does not exist' },
    { code: 'PGRST202', message: 'Could not find the function in the schema cache' },
  ]) {
    const db = createStubDatabase({
      rpc: { grant_email_credit_pack: () => ({ data: null, error }) },
    })

    await assert.rejects(
      credits.fulfillEmailCreditPackCheckout(
        stripeStub(packSession()).client,
        db.client,
        'cs_test_1'
      ),
      (thrown) => {
        assert.equal(thrown.name, 'EmailCreditSchemaMissingError')
        return true
      }
    )
  }
})

test('an ordinary grant failure is reported without pretending the pack was delivered', async () => {
  const db = createStubDatabase({
    rpc: {
      grant_email_credit_pack: () => ({
        data: null,
        error: { code: '40001', message: 'could not serialize access due to concurrent update' },
      }),
    },
  })

  const result = await credits.fulfillEmailCreditPackCheckout(
    stripeStub(packSession()).client,
    db.client,
    'cs_test_1'
  )

  assert.equal(result.ok, false)
  assert.equal(result.granted, false)
})

/* ---------------------------------------------------------------- *
 * Pack catalogue resolution
 * ---------------------------------------------------------------- */

test('an ambiguous Price mapping is refused rather than guessed', () => {
  const saved = {
    50: process.env.STRIPE_PRICE_EMAIL_CREDITS_50,
    250: process.env.STRIPE_PRICE_EMAIL_CREDITS_250,
  }
  try {
    process.env.STRIPE_PRICE_EMAIL_CREDITS_50 = 'price_duplicated'
    process.env.STRIPE_PRICE_EMAIL_CREDITS_250 = 'price_duplicated'
    assert.equal(credits.emailCreditPackByPriceId('price_duplicated'), null)

    process.env.STRIPE_PRICE_EMAIL_CREDITS_250 = 'price_credits_250'
    assert.equal(credits.emailCreditPackByPriceId('price_credits_250').slug, '250')

    process.env.STRIPE_PRICE_EMAIL_CREDITS_50 = 'price_placeholder_50'
    assert.equal(credits.emailCreditPackByPriceId('price_placeholder_50'), null)
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      const name = `STRIPE_PRICE_EMAIL_CREDITS_${key}`
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
  }
})
