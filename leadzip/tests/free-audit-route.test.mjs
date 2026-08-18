import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTypeScriptModule, modulePath } from './helpers/load-typescript-module.mjs'

// The free checker spends money (one Places call plus an outbound probe) with
// no account in front of it, so these tests pin the limiter ORDER: burst, then
// per-IP daily, then the shared global bucket. An abusive IP must be denied by
// its own buckets before it can drain the sitewide budget, and no denial path
// may reach findBusiness.
const route = await loadTypeScriptModule(modulePath('src/app/api/free-audit/route.ts'), {
  'next/server': modulePath('tests/helpers/stubs/next-server.ts'),
  '@/lib/clientIp': modulePath('src/lib/clientIp.ts'),
  '@/lib/ratelimit': modulePath('tests/helpers/stubs/free-audit-ratelimit.ts'),
  '@/lib/businessLookup': modulePath('tests/helpers/stubs/free-audit-business-lookup.ts'),
  '@/lib/auditReport': modulePath('src/lib/auditReport.ts'),
  '@/lib/healthScore': modulePath('src/lib/healthScore.ts'),
})

const IP = '203.0.113.9'

// Website left empty on purpose: buildLeadHealth only probes when a website is
// listed, so the route test never opens a socket.
const SNAPSHOT = {
  businessName: 'Rossi Plumbing',
  category: 'Plumber',
  address: '100 Main St, Austin, TX 78701',
  city: '',
  state: '',
  zipCode: '',
  phone: '(512) 555-0100',
  website: '',
  rating: 4.6,
  reviewCount: 120,
  businessHours: null,
}

function installLimiters(overrides = {}) {
  const state = { calls: [], deny: [], outage: false, ...overrides }
  globalThis.__freeAuditLimiterState = state
  return state
}

function installLookup(result = SNAPSHOT) {
  const state = { calls: [], result }
  globalThis.__freeAuditLookupState = state
  return state
}

function post(body) {
  return new Request('https://leadzipp.com/api/free-audit', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-vercel-forwarded-for': IP,
    },
    body: JSON.stringify(body),
  })
}

const VALID_BODY = { businessName: 'Rossi Plumbing', location: 'Austin, TX' }

test('burst denial answers 429 without consuming the daily or global buckets', async () => {
  const limiters = installLimiters({ deny: ['burst'] })
  const lookup = installLookup()
  const res = await route.POST(post(VALID_BODY))
  assert.equal(res.status, 429)
  assert.deepEqual(
    limiters.calls,
    [{ limiter: 'burst', key: IP }],
    'a burst-denied caller must not touch the daily or global buckets'
  )
  assert.equal(lookup.calls.length, 0, 'no Places spend on a denied request')
})

test('daily denial answers 429 with the signup nudge before the global bucket', async () => {
  const limiters = installLimiters({ deny: ['daily'] })
  const lookup = installLookup()
  const res = await route.POST(post(VALID_BODY))
  assert.equal(res.status, 429)
  const body = await res.json()
  assert.equal(body.limitReached, true)
  assert.deepEqual(limiters.calls.map((c) => c.limiter), ['burst', 'daily'])
  assert.equal(lookup.calls.length, 0)
})

test('the global cap trips last, keyed on the shared bucket, with no Places spend', async () => {
  const limiters = installLimiters({ deny: ['global'] })
  const lookup = installLookup()
  const res = await route.POST(post(VALID_BODY))
  assert.equal(res.status, 429)
  const body = await res.json()
  assert.equal(body.globalLimit, true)
  assert.deepEqual(limiters.calls, [
    { limiter: 'burst', key: IP },
    { limiter: 'daily', key: IP },
    { limiter: 'global', key: 'global' },
  ])
  assert.equal(lookup.calls.length, 0)
})

test('an allowed request checks burst, daily, global in order and returns the score', async () => {
  const limiters = installLimiters()
  const lookup = installLookup()
  const res = await route.POST(post(VALID_BODY))
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.lead.businessName, 'Rossi Plumbing')
  assert.equal(typeof body.health.total, 'number')
  assert.deepEqual(limiters.calls, [
    { limiter: 'burst', key: IP },
    { limiter: 'daily', key: IP },
    { limiter: 'global', key: 'global' },
  ])
  assert.deepEqual(lookup.calls, [{ businessName: 'Rossi Plumbing', location: 'Austin, TX' }])
})

test('a limiter outage fails closed with 503 and spends nothing', async () => {
  installLimiters({ outage: true })
  const lookup = installLookup()
  const res = await route.POST(post(VALID_BODY))
  assert.equal(res.status, 503)
  assert.equal(lookup.calls.length, 0)
})

test('an unmatched business answers a helpful 404 with no raw provider detail', async () => {
  installLimiters()
  installLookup(null)
  const res = await route.POST(post(VALID_BODY))
  assert.equal(res.status, 404)
  const body = await res.json()
  assert.equal(body.notFound, true)
  assert.match(body.error, /could not find/i)
})

test('input too short is rejected before any limiter or Places work', async () => {
  const limiters = installLimiters()
  const lookup = installLookup()
  const res = await route.POST(post({ businessName: 'R', location: '' }))
  assert.equal(res.status, 400)
  assert.equal(limiters.calls.length, 0)
  assert.equal(lookup.calls.length, 0)
})
