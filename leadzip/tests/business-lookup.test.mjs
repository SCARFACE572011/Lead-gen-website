import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTypeScriptModule, modulePath } from './helpers/load-typescript-module.mjs'

// Load the REAL lookup + sanitizer chain: businessLookup -> auditReport ->
// healthScore. The matcher decides which business gets probed and scored on
// the public free checker, so it is tested against the real sanitizeLead, not
// a stub.
const { findBusiness, BusinessLookupError } = await loadTypeScriptModule(
  modulePath('src/lib/businessLookup.ts'),
  {
    '@/lib/auditReport': modulePath('src/lib/auditReport.ts'),
    '@/lib/healthScore': modulePath('src/lib/healthScore.ts'),
  }
)

function place(name, overrides = {}) {
  return { displayName: { text: name }, ...overrides }
}

/** Run findBusiness against a canned Places response, capturing the request. */
async function findWithPlaces(places, businessName, location, response = {}) {
  const requests = []
  const previousFetch = globalThis.fetch
  const previousKey = process.env.GOOGLE_PLACES_API_KEY
  process.env.GOOGLE_PLACES_API_KEY = 'test-key'
  globalThis.fetch = async (url, init) => {
    requests.push({ url, init })
    return {
      ok: response.ok ?? true,
      status: response.status ?? 200,
      async json() {
        return response.body ?? { places }
      },
    }
  }
  try {
    const snapshot = await findBusiness(businessName, location)
    return { snapshot, requests }
  } finally {
    globalThis.fetch = previousFetch
    if (previousKey === undefined) delete process.env.GOOGLE_PLACES_API_KEY
    else process.env.GOOGLE_PLACES_API_KEY = previousKey
  }
}

test('makes exactly one searchText call with pageSize 5 and a combined text query', async () => {
  const { requests } = await findWithPlaces([place('Rossi Plumbing')], 'Rossi Plumbing', 'Austin, TX')
  assert.equal(requests.length, 1)
  assert.equal(requests[0].url, 'https://places.googleapis.com/v1/places:searchText')
  const body = JSON.parse(requests[0].init.body)
  assert.deepEqual(body, { textQuery: 'Rossi Plumbing, Austin, TX', pageSize: 5 })
})

test('best name-token overlap beats an area-dominant top result', async () => {
  const { snapshot } = await findWithPlaces(
    [place('Austin Plumbing Heroes'), place('Rossi Plumbing'), place('Downtown Drain Kings')],
    'Rossi Plumbing',
    'Austin, TX'
  )
  assert.equal(snapshot?.businessName, 'Rossi Plumbing')
})

test('zero token overlap across every candidate returns null instead of a stranger', async () => {
  const { snapshot } = await findWithPlaces(
    [place('Joe Barbershop'), place('Quick Cuts Salon')],
    'Rossi Plumbing',
    'Austin, TX'
  )
  assert.equal(snapshot, null)
})

test('a name made only of short tokens accepts the top result', async () => {
  // "H&M" tokenizes to nothing at the three-character minimum, so there is no
  // distinctive-token signal and Places relevance ordering stands.
  const { snapshot } = await findWithPlaces(
    [place('H&M'), place('Old Navy')],
    'H&M',
    'Chicago, IL'
  )
  assert.equal(snapshot?.businessName, 'H&M')
})

test('permanently closed candidates are skipped', async () => {
  const { snapshot } = await findWithPlaces(
    [
      place('Rossi Plumbing', { businessStatus: 'CLOSED_PERMANENTLY' }),
      place('Rossi Plumbing and Heating', { businessStatus: 'OPERATIONAL' }),
    ],
    'Rossi Plumbing',
    'Austin, TX'
  )
  assert.equal(snapshot?.businessName, 'Rossi Plumbing and Heating')
})

test('returns null when every candidate is permanently closed or nameless', async () => {
  const { snapshot } = await findWithPlaces(
    [place('Rossi Plumbing', { businessStatus: 'CLOSED_PERMANENTLY' }), { formattedAddress: 'no name' }],
    'Rossi Plumbing',
    'Austin, TX'
  )
  assert.equal(snapshot, null)
})

test('returns null on an empty Places response', async () => {
  const { snapshot } = await findWithPlaces([], 'Rossi Plumbing', 'Nowhere')
  assert.equal(snapshot, null)
})

test('winner passes through the shared sanitizer: control chars, clamps, website hardening', async () => {
  const { snapshot } = await findWithPlaces(
    [
      place('Rossi Plumbing\u001b[31m', {
        formattedAddress: '100 Main St,\nAustin, TX 78701',
        rating: 4.66,
        userRatingCount: 128.9,
        nationalPhoneNumber: '(512) 555-0100',
        websiteUri: 'HTTPS://Example.COM/Path?utm_source=places#top',
        primaryTypeDisplayName: { text: 'Plumber' },
        regularOpeningHours: { weekdayDescriptions: ['Monday: 9 AM to 5 PM', ''] },
      }),
    ],
    'Rossi Plumbing',
    'Austin, TX'
  )
  // The ESC control character is replaced with a space; visible text survives.
  assert.equal(snapshot.businessName, 'Rossi Plumbing [31m')
  assert.equal(snapshot.category, 'Plumber')
  assert.equal(snapshot.address, '100 Main St, Austin, TX 78701')
  assert.equal(snapshot.phone, '(512) 555-0100')
  // Hostname lowercased, query string and fragment dropped.
  assert.equal(snapshot.website, 'https://example.com/Path')
  assert.equal(snapshot.rating, 4.7)
  assert.equal(snapshot.reviewCount, 128)
  assert.deepEqual(snapshot.businessHours, ['Monday: 9 AM to 5 PM'])
})

test('unusable websites sanitize to empty string rather than failing the lookup', async () => {
  for (const websiteUri of [
    'http://192.168.1.1/admin',
    'https://user:pass@example.com/',
    'https://internal.corp.local/dash',
    'javascript:alert(1)',
  ]) {
    const { snapshot } = await findWithPlaces(
      [place('Rossi Plumbing', { websiteUri })],
      'Rossi Plumbing',
      'Austin, TX'
    )
    assert.equal(snapshot.website, '', `expected empty website for ${websiteUri}`)
  }
})

test('missing API key throws not_configured without spending a Places call', async () => {
  const previousFetch = globalThis.fetch
  const previousKey = process.env.GOOGLE_PLACES_API_KEY
  delete process.env.GOOGLE_PLACES_API_KEY
  let fetchCalls = 0
  globalThis.fetch = async () => {
    fetchCalls += 1
    throw new Error('should not be called')
  }
  try {
    await assert.rejects(
      () => findBusiness('Rossi Plumbing', 'Austin, TX'),
      (err) => err instanceof BusinessLookupError && err.code === 'not_configured'
    )
    assert.equal(fetchCalls, 0)
  } finally {
    globalThis.fetch = previousFetch
    if (previousKey === undefined) delete process.env.GOOGLE_PLACES_API_KEY
    else process.env.GOOGLE_PLACES_API_KEY = previousKey
  }
})

test('a provider HTTP error surfaces as provider_error, never as a result', async () => {
  await assert.rejects(
    () =>
      findWithPlaces([], 'Rossi Plumbing', 'Austin, TX', {
        ok: false,
        status: 403,
        body: { error: { status: 'PERMISSION_DENIED', message: 'key rejected' } },
      }),
    (err) => err instanceof BusinessLookupError && err.code === 'provider_error'
  )
})
