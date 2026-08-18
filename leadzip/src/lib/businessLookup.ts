import { sanitizeLead, type LeadSnapshot } from '@/lib/auditReport'

/**
 * SINGLE-BUSINESS LOOKUP — resolve one best-matching business from a name and
 * a city or postal code, for the public free checker (/api/free-audit).
 *
 * Deliberately a thin Google Places (New) wrapper in the same style as
 * src/lib/competitorAnalysis.ts, and for the same reason: the full
 * googlePlacesProvider search fans out to multiple billable pages and ring
 * searches, while this feature needs exactly ONE cheap searchText call with a
 * small page and a minimal field mask. Places' own text relevance does the
 * geographic work ("Rossi Plumbing, Austin TX"), so no separate geocode call
 * is spent per check.
 */

const PLACES_SEARCH_TEXT_URL = 'https://places.googleapis.com/v1/places:searchText'

// Minimal field mask — only what the health score and the report header need.
const FIELD_MASK = [
  'places.displayName',
  'places.formattedAddress',
  'places.rating',
  'places.userRatingCount',
  'places.nationalPhoneNumber',
  'places.internationalPhoneNumber',
  'places.websiteUri',
  'places.businessStatus',
  'places.primaryTypeDisplayName',
  'places.regularOpeningHours.weekdayDescriptions',
].join(',')

const FETCH_CAP = 5 // one page, five candidates — a single billable call

interface GooglePlaceLite {
  displayName?: { text?: string }
  formattedAddress?: string
  rating?: number
  userRatingCount?: number
  nationalPhoneNumber?: string
  internationalPhoneNumber?: string
  websiteUri?: string
  businessStatus?: string
  primaryTypeDisplayName?: { text?: string }
  regularOpeningHours?: { weekdayDescriptions?: string[] }
}

export class BusinessLookupError extends Error {
  constructor(
    message: string,
    public readonly code: 'not_configured' | 'provider_error'
  ) {
    super(message)
    this.name = 'BusinessLookupError'
  }
}

/** Distinctive tokens of a business name, for a loose "is this even the same
 *  business" check. Three-character minimum drops connectives and initials. */
function nameTokens(name: string): string[] {
  return [
    ...new Set(
      name
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((t) => t.length >= 3)
    ),
  ]
}

/**
 * Resolve the single best-matching business. Returns null (rather than
 * throwing) when nothing plausible matches, so the route can answer with a
 * helpful 404. Throws BusinessLookupError on configuration or provider
 * failures; the caller maps those to a generic 503, never to user-visible
 * provider detail.
 */
export async function findBusiness(
  businessName: string,
  location: string
): Promise<LeadSnapshot | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) {
    throw new BusinessLookupError('GOOGLE_PLACES_API_KEY not configured', 'not_configured')
  }

  let places: GooglePlaceLite[] = []
  try {
    const res = await fetch(PLACES_SEARCH_TEXT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': FIELD_MASK,
      },
      body: JSON.stringify({
        textQuery: `${businessName}, ${location}`,
        pageSize: FETCH_CAP,
      }),
    })
    if (!res.ok) {
      let detail = ''
      try {
        const err = (await res.json()) as { error?: { status?: string; message?: string } }
        detail = ` ${err.error?.status ?? ''}: ${err.error?.message ?? ''}`
      } catch {
        /* non-JSON error body */
      }
      throw new BusinessLookupError(`Google Places HTTP ${res.status}${detail}`, 'provider_error')
    }
    const data = (await res.json()) as { places?: GooglePlaceLite[] }
    places = data.places ?? []
  } catch (err) {
    if (err instanceof BusinessLookupError) throw err
    throw new BusinessLookupError(
      err instanceof Error ? err.message : 'Places request failed',
      'provider_error'
    )
  }

  const open = places.filter(
    (p) => p.businessStatus !== 'CLOSED_PERMANENTLY' && p.displayName?.text
  )
  if (open.length === 0) return null

  // Places text search is fuzzy by design, so the top result can be an
  // unrelated business that merely dominates the searched area. Prefer the
  // candidate sharing the most distinctive name tokens with the query, and
  // treat zero overlap across every candidate as "not found" rather than
  // scoring a stranger. Names made only of short tokens ("H&M") have no
  // distinctive tokens to compare, so the top result stands for them.
  const queryTokens = nameTokens(businessName)
  let best = open[0]
  let bestOverlap = -1
  for (const p of open) {
    const candidate = nameTokens(p.displayName?.text ?? '')
    const overlap = queryTokens.filter((t) => candidate.includes(t)).length
    if (overlap > bestOverlap) {
      bestOverlap = overlap
      best = p
    }
  }
  if (queryTokens.length > 0 && bestOverlap === 0) return null

  // Same sanitizer as the authed audit route: control-character stripping,
  // hardened website validation, bounded field lengths.
  return sanitizeLead({
    businessName: best.displayName?.text ?? '',
    category: best.primaryTypeDisplayName?.text ?? '',
    address: best.formattedAddress ?? '',
    phone: best.nationalPhoneNumber ?? best.internationalPhoneNumber ?? '',
    website: best.websiteUri ?? '',
    rating: best.rating ?? null,
    reviewCount: best.userRatingCount ?? null,
    businessHours: best.regularOpeningHours?.weekdayDescriptions ?? null,
  })
}
