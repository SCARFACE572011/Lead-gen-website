/**
 * What an Email Finder lookup actually costs the customer.
 *
 * The runbook promises: a successful provider result costs one credit; a cached
 * result, a provider failure, a no-result and an info@domain guess are free.
 *
 * The debit itself is one line of PL/pgSQL inside claim_email_lookup
 * (`included_change := -1`), and the matching credit-back lives in
 * refund_email_lookup_credit, so the balance arithmetic needs a real database.
 * The part that decides WHETHER a customer is charged is TypeScript, and that
 * is what is asserted here, through the real route handler:
 *
 *   - how many reservations a single request may take (exactly one, or none)
 *   - whether the reservation is kept (complete with keep_charge) or given back
 *     (complete with keep_charge=false, or abort)
 *   - what the response tells the customer they were charged
 */
import assert from 'node:assert/strict'
import test, { beforeEach, afterEach } from 'node:test'
import { loadModuleGraph, repoPath } from './helpers/load-module-graph.mjs'
import { createStubDatabase } from './helpers/stub-database.mjs'

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://stub.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service_role_stub'

const route = await loadModuleGraph(repoPath('src/app/api/leads/enrich/email/route.ts'), {
  'next/server': repoPath('tests/helpers/stubs/next-server.ts'),
  // Reached transitively: emailCredits -> subscriptionSync imports Stripe for
  // its types, and a bare specifier cannot be resolved from a data: URL.
  stripe: repoPath('tests/helpers/stubs/stripe.ts'),
  '@supabase/supabase-js': repoPath('tests/helpers/stubs/supabase-service.ts'),
  '@/lib/supabase/server': repoPath('tests/helpers/stubs/supabase-server.ts'),
  '@/lib/requireActiveUser': repoPath('tests/helpers/stubs/require-active-user.ts'),
  '@/lib/ratelimit': repoPath('tests/helpers/stubs/ratelimit.ts'),
})

const USER = '00000000-0000-4000-8000-000000000001'
const DOMAIN = 'example.com'

const realFetch = globalThis.fetch

/* The route logs every provider failure on purpose. Capture rather than print,
 * so a passing run stays readable and the messages can still be asserted. */
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
  globalThis.fetch = realFetch
  delete globalThis.__leadzipAuthStub
  delete globalThis.__leadzipSupabaseStub
  delete process.env.HUNTER_API_KEY
})

const PROFILE_TABLES = {
  users_profile: [
    {
      id: USER,
      email: 'owner@example.com',
      plan: 'free',
      role: 'user',
      status: 'active',
      workspace_id: null,
    },
  ],
  subscriptions: [],
  email_lookup_cache: [],
}

function balanceRow(overrides = {}) {
  return {
    included_remaining: 5,
    purchased_remaining: 0,
    credit_debt: 0,
    total_remaining: 5,
    allowance_key: 'free:lifetime',
    allowance_size: 5,
    allowance_ends_at: null,
    ...overrides,
  }
}

/**
 * Counts provider calls so "did we spend an upstream credit?" is observable.
 * Installing a provider implies the provider is configured; `configured: false`
 * covers the deployment where HUNTER_API_KEY is absent.
 */
function providerStub(responder, { configured = true } = {}) {
  if (configured) process.env.HUNTER_API_KEY = 'hunter_key'
  else delete process.env.HUNTER_API_KEY
  const calls = []
  globalThis.fetch = async (url) => {
    calls.push(String(url))
    return responder(String(url))
  }
  return calls
}

function hunterOk(emails) {
  return {
    ok: true,
    status: 200,
    async json() {
      return { data: { emails } }
    },
  }
}

async function post({ rpc, tables = PROFILE_TABLES }) {
  const db = createStubDatabase({ tables, rpc })
  globalThis.__leadzipAuthStub = { ok: true, user: { id: USER, email: 'owner@example.com' } }
  globalThis.__leadzipSupabaseStub = db.client
  const response = await route.POST({
    async json() {
      return { domain: DOMAIN }
    },
  })
  return { response, db, body: await response.json() }
}

const CLAIMED = [
  {
    claim_status: 'claimed',
    credit_charged: true,
    remaining: 4,
    reservation_id: 'led_1',
    retry_after: 0,
  },
]

/* ---------------------------------------------------------------- *
 * The one case that costs a credit
 * ---------------------------------------------------------------- */

test('a successful provider result reserves exactly one credit and keeps it', async () => {
  const calls = providerStub(() => hunterOk([{ value: 'sales@example.com', score: 95 }]))

  const { response, db, body } = await post({
    rpc: {
      get_email_credit_balance: () => [balanceRow()],
      claim_email_lookup: () => CLAIMED,
      complete_email_lookup: () => 4,
    },
  })

  assert.equal(response.status, 200)
  assert.equal(body.creditCharged, true)
  assert.equal(body.source, 'hunter')
  assert.equal(body.confidence, 'verified')
  assert.equal(body.email, 'sales@example.com')
  assert.equal(body.remaining, 4)
  assert.equal(calls.length, 1, 'one provider call')
  assert.equal(
    db.rpcArgs('claim_email_lookup').length,
    1,
    'one reservation, so at most one credit can be spent'
  )
  const [completion] = db.rpcArgs('complete_email_lookup')
  assert.equal(completion.p_keep_charge, true)
  assert.equal(completion.p_source, 'hunter')
  assert.equal(db.rpcArgs('abort_email_lookup').length, 0)
})

test('a lower-scored provider result is still one credit, marked likely', async () => {
  providerStub(() => hunterOk([{ value: 'hello@example.com', score: 60 }]))

  const { body, db } = await post({
    rpc: {
      get_email_credit_balance: () => [balanceRow()],
      claim_email_lookup: () => CLAIMED,
      complete_email_lookup: () => 4,
    },
  })

  assert.equal(body.confidence, 'likely')
  assert.equal(body.creditCharged, true)
  assert.equal(db.rpcArgs('complete_email_lookup')[0].p_keep_charge, true)
})

/* ---------------------------------------------------------------- *
 * The cases that must cost nothing
 * ---------------------------------------------------------------- */

test('a cached result costs nothing and never reaches the provider', async () => {
  const calls = providerStub(() => {
    throw new Error('the provider must not be called for a cached domain')
  })
  process.env.HUNTER_API_KEY = 'hunter_key'

  const { body, db } = await post({
    rpc: {
      get_email_credit_balance: () => [balanceRow()],
      claim_email_lookup: () => [
        {
          claim_status: 'cached',
          cached_email: 'sales@example.com',
          cached_confidence: 'verified',
          cached_source: 'hunter',
          credit_charged: false,
          remaining: 5,
        },
      ],
    },
  })

  assert.equal(body.cached, true)
  assert.equal(body.creditCharged, false)
  assert.equal(body.remaining, 5, 'the balance is unchanged')
  assert.equal(calls.length, 0)
  assert.equal(db.rpcArgs('complete_email_lookup').length, 0)
  assert.equal(db.rpcArgs('abort_email_lookup').length, 0)
})

test('a provider failure gives the reservation back and charges nothing', async () => {
  providerStub(() => ({ ok: false, status: 502, async json() { return {} } }))

  const { body, db } = await post({
    rpc: {
      get_email_credit_balance: () => [balanceRow()],
      claim_email_lookup: () => CLAIMED,
      abort_email_lookup: () => 5,
    },
  })

  assert.equal(body.creditCharged, false)
  assert.equal(body.email, `info@${DOMAIN}`)
  assert.equal(body.source, 'guess')
  assert.equal(body.remaining, 5, 'the credit is back')
  const [abort] = db.rpcArgs('abort_email_lookup')
  assert.equal(abort.p_reason, 'provider_http_502')
  assert.equal(db.rpcArgs('complete_email_lookup').length, 0)
})

test('a provider network error gives the reservation back and charges nothing', async () => {
  providerStub(() => {
    throw new Error('socket hang up')
  })

  const { body, db } = await post({
    rpc: {
      get_email_credit_balance: () => [balanceRow()],
      claim_email_lookup: () => CLAIMED,
      abort_email_lookup: () => 5,
    },
  })

  assert.equal(body.creditCharged, false)
  assert.equal(body.remaining, 5)
  assert.equal(db.rpcArgs('abort_email_lookup')[0].p_reason, 'provider_request_failed')
})

test('a no-result completion refunds the reservation and charges nothing', async () => {
  providerStub(() => hunterOk([]))

  const { body, db } = await post({
    rpc: {
      get_email_credit_balance: () => [balanceRow()],
      claim_email_lookup: () => CLAIMED,
      complete_email_lookup: () => 5,
    },
  })

  assert.equal(body.creditCharged, false)
  assert.equal(body.email, `info@${DOMAIN}`)
  assert.equal(body.confidence, 'guessed')
  assert.equal(body.remaining, 5)
  const [completion] = db.rpcArgs('complete_email_lookup')
  assert.equal(completion.p_keep_charge, false, 'a guess must never retain the charge')
  assert.equal(completion.p_source, 'guess')
})

test('a malformed provider address is treated as a no-result, not as a paid hit', async () => {
  providerStub(() => hunterOk([{ value: 'not-an-email', score: 99 }]))

  const { body, db } = await post({
    rpc: {
      get_email_credit_balance: () => [balanceRow()],
      claim_email_lookup: () => CLAIMED,
      complete_email_lookup: () => 5,
    },
  })

  assert.equal(body.creditCharged, false)
  assert.equal(db.rpcArgs('complete_email_lookup')[0].p_keep_charge, false)
})

test('with no provider configured the guess is free and no credit is even reserved', async () => {
  const calls = providerStub(
    () => {
      throw new Error('no provider is configured')
    },
    { configured: false }
  )

  const { body, db } = await post({
    rpc: { get_email_credit_balance: () => [balanceRow()] },
  })

  assert.equal(body.creditCharged, false)
  assert.equal(body.email, `info@${DOMAIN}`)
  assert.equal(calls.length, 0)
  assert.equal(
    db.rpcArgs('claim_email_lookup').length,
    0,
    'a deterministic guess has no upstream cost, so it must not take a reservation'
  )
})

test('an exhausted balance is refused before any provider spend', async () => {
  process.env.HUNTER_API_KEY = 'hunter_key'
  const calls = providerStub(() => {
    throw new Error('the provider must not be called with no credits')
  })

  const { response, body, db } = await post({
    rpc: {
      get_email_credit_balance: () => [balanceRow({ included_remaining: 0, total_remaining: 0 })],
      claim_email_lookup: () => [
        { claim_status: 'exhausted', credit_charged: false, remaining: 0, retry_after: 0 },
      ],
    },
  })

  assert.equal(response.status, 402)
  assert.equal(body.creditsRequired, true)
  assert.equal(body.remaining, 0)
  assert.equal(calls.length, 0)
  assert.equal(db.rpcArgs('complete_email_lookup').length, 0)
  assert.equal(body.error.includes('—'), false)
})

test('a concurrent duplicate is declined without a second reservation', async () => {
  process.env.HUNTER_API_KEY = 'hunter_key'
  const calls = providerStub(() => {
    throw new Error('the follower must not call the provider')
  })

  const { response, body, db } = await post({
    rpc: {
      get_email_credit_balance: () => [balanceRow()],
      claim_email_lookup: () => [
        { claim_status: 'pending', credit_charged: false, remaining: 5, retry_after: 2 },
      ],
    },
  })

  assert.equal(response.status, 409)
  assert.equal(body.lookupPending, true)
  assert.equal(body.creditCharged, false)
  assert.equal(body.remaining, 5)
  assert.equal(calls.length, 0)
  // The route polls the same claim RPC while waiting; every one of those is a
  // read that returns 'pending', and none of them reserves a second credit.
  assert.ok(db.rpcArgs('claim_email_lookup').length >= 1)
  assert.equal(db.rpcArgs('complete_email_lookup').length, 0)
})

test('the follower of a duplicate click is served the cached answer, not a second charge', async () => {
  const calls = providerStub(() => {
    throw new Error('the follower must not call the provider')
  })
  let attempt = 0
  const claims = [
    [{ claim_status: 'pending', credit_charged: false, remaining: 5, retry_after: 1 }],
    [
      {
        claim_status: 'cached',
        cached_email: 'sales@example.com',
        cached_confidence: 'verified',
        cached_source: 'hunter',
        credit_charged: false,
        remaining: 4,
      },
    ],
  ]

  const { response, body, db } = await post({
    rpc: {
      get_email_credit_balance: () => [balanceRow()],
      claim_email_lookup: () => claims[Math.min(attempt++, claims.length - 1)],
    },
  })

  assert.equal(response.status, 200)
  assert.equal(body.cached, true)
  assert.equal(body.creditCharged, false)
  assert.equal(calls.length, 0, 'the domain was paid for once, by the leader')
  assert.equal(db.rpcArgs('complete_email_lookup').length, 0)
})

/* ---------------------------------------------------------------- *
 * Unmigrated database: degrade, never spend unmetered
 * ---------------------------------------------------------------- */

const SCHEMA_MISSING_CODES = ['42883', 'PGRST202', '42P01', 'PGRST205']

for (const code of SCHEMA_MISSING_CODES) {
  test(`without the credit schema (${code}) the lookup degrades instead of spending a provider credit`, async () => {
    process.env.HUNTER_API_KEY = 'hunter_key'
    const calls = providerStub(() => {
      throw new Error('the provider must not be called without a ledger')
    })
    const { response, body, db } = await post({
      rpc: {
        get_email_credit_balance: () => ({
          data: null,
          error: { code, message: 'relation "public.email_credit_accounts" does not exist' },
        }),
      },
    })

    assert.equal(response.status, 503)
    assert.equal(calls.length, 0, 'no unmetered provider call')
    assert.equal(db.rpcArgs('claim_email_lookup').length, 0)
    assert.equal(body.email, undefined, 'no result is served without a ledger to charge')
    // Never leak the Postgres error to the customer.
    assert.equal(body.error, 'Email lookup is temporarily unavailable. Please retry in a moment.')
    assert.equal(/does not exist|relation|public\./.test(body.error), false)
    assert.equal(body.error.includes('—'), false)
    // The real cause is logged for operators, never returned.
    assert.match(captured.error.join('\n'), /failed to prepare credit account/)
  })
}

test('an unparseable domain is rejected before any credit or provider call', async () => {
  process.env.HUNTER_API_KEY = 'hunter_key'
  const calls = providerStub(() => {
    throw new Error('the provider must not be called for an invalid domain')
  })
  const db = createStubDatabase({ tables: PROFILE_TABLES, rpc: {} })
  globalThis.__leadzipAuthStub = { ok: true, user: { id: USER, email: 'owner@example.com' } }
  globalThis.__leadzipSupabaseStub = db.client

  const response = await route.POST({
    async json() {
      return { domain: 'not a domain at all' }
    },
  })

  assert.equal(response.status, 422)
  assert.equal(calls.length, 0)
  assert.equal(db.rpcCalls.length, 0)
})
