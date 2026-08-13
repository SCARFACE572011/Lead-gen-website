import { LocationNotFoundError, resolveSearchLocation } from '@/lib/geocode'

/**
 * COMPETITOR ANALYSIS — top nearby same-category businesses for a lead.
 *
 * Deliberately a thin, self-contained Google Places (New) wrapper rather than
 * a call into googlePlacesProvider.searchLeadsGooglePlaces: the provider's
 * search fans out to multiple billable pages and ring searches, while this
 * feature needs exactly ONE cheap searchText call (pageSize 10) biased around
 * the lead's own location.
 *
 * COUPLING NOTE: googlePlacesProvider exports only the full search today; if a
 * lighter `fetchPage`-style helper is ever exported there, this wrapper can be
 * collapsed onto it. Until then the only shared surface is `resolveSearchLocation`.
 */

const PLACES_SEARCH_TEXT_URL = 'https://places.googleapis.com/v1/places:searchText'

// Minimal field mask — only what the comparison table needs.
const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.rating',
  'places.userRatingCount',
  'places.nationalPhoneNumber',
  'places.websiteUri',
  'places.businessStatus',
].join(',')

const FETCH_CAP = 10 // one page, ten results — a single billable call
const TOP_N = 5
const DEFAULT_RADIUS_METERS = 8047 // 5 miles

export interface CompetitorInput {
  businessName: string
  category: string
  latitude?: number | null
  longitude?: number | null
  zipCode?: string
  /** ISO 3166-1 alpha-2 for the lead's country. Without it a 5-digit postal
   *  code is treated as a US ZIP. */
  countryCode?: string
  address?: string
  website?: string | null
  rating?: number | null
  reviewCount?: number | null
}

export interface CompetitorRow {
  name: string
  rating: number | null
  reviewCount: number | null
  hasWebsite: boolean
  https: boolean
  hasPhone: boolean
  distanceMiles: number | null
  address: string
}

export interface CompetitorComparison {
  competitors: CompetitorRow[]
  insights: string[]
}

interface GooglePlaceLite {
  id: string
  displayName?: { text?: string }
  formattedAddress?: string
  location?: { latitude: number; longitude: number }
  rating?: number
  userRatingCount?: number
  nationalPhoneNumber?: string
  websiteUri?: string
  businessStatus?: string
}

function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export class CompetitorLookupError extends Error {
  constructor(
    message: string,
    public readonly code: 'not_configured' | 'no_location' | 'provider_error'
  ) {
    super(message)
    this.name = 'CompetitorLookupError'
  }
}

export async function findCompetitors(input: CompetitorInput): Promise<CompetitorComparison> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) {
    throw new CompetitorLookupError('GOOGLE_PLACES_API_KEY not configured', 'not_configured')
  }

  // Center the search on the lead itself when we have coordinates; otherwise
  // fall back to geocoding its postal code. resolveSearchLocation is used rather
  // than geocodeZip because the latter pins every lookup to &country=US, which
  // silently resolved international postal codes (Berlin's 10117) to a US
  // location and returned competitors from the wrong continent.
  let lat = input.latitude ?? null
  let lon = input.longitude ?? null
  if (lat == null || lon == null) {
    if (!input.zipCode) {
      throw new CompetitorLookupError('Lead has no coordinates or ZIP code', 'no_location')
    }
    try {
      const geo = await resolveSearchLocation({
        zipCode: input.zipCode,
        countryCode: input.countryCode,
      })
      lat = geo.lat
      lon = geo.lon
    } catch (err) {
      if (err instanceof LocationNotFoundError) {
        throw new CompetitorLookupError(
          'Could not locate this lead from its postal code. Try again from a lead with a map location.',
          'no_location'
        )
      }
      throw new CompetitorLookupError(
        err instanceof Error ? `Geocoding failed: ${err.message}` : 'Geocoding failed',
        'provider_error'
      )
    }
  }

  const query =
    input.category && input.category !== 'Custom Keyword'
      ? input.category
      : input.category || 'local businesses'

  // CLDR region hint, exactly as googlePlacesProvider derives it: only for a
  // valid non-US code, so the US request stays byte-for-byte what it was. Most
  // leads carry coordinates and skip the geocode above, so this is the only way
  // the lead's country reaches the query at all — it biases result formatting
  // and ranking to the lead's own market instead of a US-centric default.
  const cc = (input.countryCode ?? '').trim().toUpperCase()
  const regionCode = /^[A-Z]{2}$/.test(cc) && cc !== 'US' ? cc : undefined

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
        textQuery: query,
        pageSize: FETCH_CAP,
        locationBias: {
          circle: { center: { latitude: lat, longitude: lon }, radius: DEFAULT_RADIUS_METERS },
        },
        ...(regionCode ? { regionCode } : {}),
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
      throw new CompetitorLookupError(`Google Places HTTP ${res.status}${detail}`, 'provider_error')
    }
    const data = (await res.json()) as { places?: GooglePlaceLite[] }
    places = data.places ?? []
  } catch (err) {
    if (err instanceof CompetitorLookupError) throw err
    throw new CompetitorLookupError(
      err instanceof Error ? err.message : 'Places request failed',
      'provider_error'
    )
  }

  const leadNorm = normalizeName(input.businessName)
  const competitors = places
    .filter((p) => {
      if (p.businessStatus === 'CLOSED_PERMANENTLY') return false
      const name = p.displayName?.text ?? ''
      if (!name) return false
      // Exclude the lead itself: same normalized name, or effectively the same
      // premises (< ~30 meters away with overlapping names).
      const norm = normalizeName(name)
      if (norm === leadNorm) return false
      if (p.location && lat != null && lon != null) {
        const d = haversineMiles(lat, lon, p.location.latitude, p.location.longitude)
        if (d < 0.02 && (norm.includes(leadNorm) || leadNorm.includes(norm))) return false
      }
      return true
    })
    .map<CompetitorRow>((p) => ({
      name: p.displayName?.text ?? '',
      rating: p.rating ?? null,
      reviewCount: p.userRatingCount ?? null,
      hasWebsite: Boolean(p.websiteUri),
      https: Boolean(p.websiteUri && p.websiteUri.startsWith('https://')),
      hasPhone: Boolean(p.nationalPhoneNumber),
      distanceMiles:
        p.location && lat != null && lon != null
          ? Math.round(haversineMiles(lat, lon, p.location.latitude, p.location.longitude) * 10) / 10
          : null,
      address: p.formattedAddress ?? '',
    }))
    .sort((a, b) => (b.reviewCount ?? 0) - (a.reviewCount ?? 0))
    .slice(0, TOP_N)

  return { competitors, insights: buildInsights(input, competitors) }
}

function buildInsights(lead: CompetitorInput, competitors: CompetitorRow[]): string[] {
  const insights: string[] = []
  const n = competitors.length
  if (n === 0) {
    return ['No same-category competitors found nearby. This business may own its local market.']
  }

  const name = lead.businessName
  const withSites = competitors.filter((c) => c.hasWebsite).length
  const leadHasSite = Boolean(lead.website && lead.website.trim())

  // Website gap is the highest-value pitch angle for agencies.
  if (!leadHasSite && withSites > 0) {
    insights.push(
      `${withSites} of ${n} nearby competitors have websites; ${name} does not. Customers comparing options online never see them.`
    )
  } else if (leadHasSite && withSites < n) {
    insights.push(
      `${name} has a website but ${n - withSites} of ${n} nearby competitors do not. A visibility push now could lock in that lead.`
    )
  }

  // Review volume and rating gaps.
  const top = competitors[0]
  const leadReviews = lead.reviewCount ?? 0
  if (top && (top.reviewCount ?? 0) > leadReviews * 2 && (top.reviewCount ?? 0) >= 20) {
    insights.push(
      `${top.name} leads the area with ${top.reviewCount} reviews${top.rating != null ? ` (${top.rating.toFixed(1)} stars)` : ''}; ${name} has ${leadReviews}. Review generation is the clearest gap to close.`
    )
  } else {
    const rated = competitors.filter((c) => c.rating != null)
    if (rated.length > 0 && lead.rating != null) {
      const avg = rated.reduce((s, c) => s + (c.rating ?? 0), 0) / rated.length
      if (lead.rating < avg - 0.2) {
        insights.push(
          `${name} rates ${lead.rating.toFixed(1)} stars against a local average of ${avg.toFixed(1)}. Reputation work would move them up the map results.`
        )
      } else if (lead.rating >= avg + 0.2) {
        insights.push(
          `${name} rates ${lead.rating.toFixed(1)} stars, above the local average of ${avg.toFixed(1)}. Their reputation is an asset worth promoting.`
        )
      }
    }
  }

  return insights.slice(0, 2)
}
