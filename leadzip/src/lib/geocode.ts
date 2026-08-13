const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'
const GOOGLE_GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json'
const USER_AGENT = 'LeadZipp/1.0 (+https://leadzipp.com)'

/** Thrown when a location string cannot be geocoded — the API route maps this
 *  to a friendly 422 instead of a generic 500. */
export class LocationNotFoundError extends Error {
  constructor(query: string) {
    super(`Location not found: ${query}`)
    this.name = 'LocationNotFoundError'
  }
}

/** True when the input looks like a 5-digit US ZIP (optionally ZIP+4). */
export function isUsZip(input: string): boolean {
  return /^\d{5}(-\d{4})?$/.test(input.trim())
}

// State abbreviation → primary area code for unknown ZIPs
const STATE_AREA_CODES: Record<string, string> = {
  AL: '205', AK: '907', AZ: '602', AR: '501', CA: '213',
  CO: '303', CT: '203', DE: '302', FL: '305', GA: '404',
  HI: '808', ID: '208', IL: '312', IN: '317', IA: '515',
  KS: '316', KY: '502', LA: '504', ME: '207', MD: '410',
  MA: '617', MI: '313', MN: '612', MS: '601', MO: '314',
  MT: '406', NE: '402', NV: '702', NH: '603', NJ: '201',
  NM: '505', NY: '212', NC: '704', ND: '701', OH: '216',
  OK: '405', OR: '503', PA: '215', RI: '401', SC: '803',
  SD: '605', TN: '615', TX: '214', UT: '801', VT: '802',
  VA: '804', WA: '206', WV: '304', WI: '414', WY: '307',
  DC: '202',
}

export interface GeocodedZip {
  lat: number
  lon: number
  city: string
  state: string
  stateAbbr: string
  areaCode: string
}

interface NominatimResult {
  lat: string
  lon: string
  address?: {
    city?: string
    town?: string
    village?: string
    county?: string
    suburb?: string
    state?: string
    postcode?: string
  }
}

export async function geocodeZip(zipCode: string): Promise<GeocodedZip> {
  const url = `${NOMINATIM_URL}?postalcode=${encodeURIComponent(zipCode)}&country=US&format=json&limit=1&addressdetails=1`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 5000) // 5s max — never block the search pipeline
  let res: Response
  try {
    res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en' },
      signal: controller.signal,
      next: { revalidate: 86400 },
    })
  } finally {
    clearTimeout(timer)
  }
  if (!res.ok) throw new Error(`Nominatim ${res.status}`)
  const data = (await res.json()) as NominatimResult[]
  if (!data.length) throw new LocationNotFoundError(zipCode)

  const { lat, lon, address } = data[0]
  const stateAbbr = stateNameToAbbr(address?.state ?? '')
  const city =
    address?.city ??
    address?.town ??
    address?.suburb ??
    address?.village ??
    address?.county ??
    ''

  return {
    lat: parseFloat(lat),
    lon: parseFloat(lon),
    city,
    state: address?.state ?? '',
    stateAbbr,
    areaCode: STATE_AREA_CODES[stateAbbr] ?? '555',
  }
}

// Common US state names → two-letter abbreviations
const STATE_NAME_MAP: Record<string, string> = {
  'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR',
  'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE',
  'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID',
  'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS',
  'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
  'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS',
  'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV',
  'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
  'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK',
  'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
  'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT',
  'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV',
  'Wisconsin': 'WI', 'Wyoming': 'WY', 'District of Columbia': 'DC',
}

function stateNameToAbbr(name: string): string {
  if (!name) return ''
  if (name.length === 2) return name.toUpperCase()
  return STATE_NAME_MAP[name] ?? ''
}

// ── Worldwide free-text geocoding ─────────────────────────────────────────────

/** Unified location shape consumed by every lead provider. A superset of
 *  GeocodedZip so ZIP-mode callers keep working unchanged. */
export interface ResolvedLocation {
  lat: number
  lon: number
  city: string
  /** Region / state / admin area name ("California", "Dubai Emirate"). */
  state: string
  /** Two-letter US state abbreviation; empty outside the US. */
  stateAbbr: string
  /** US area code hint for fallback data; empty outside the US. */
  areaCode: string
  /** ISO 3166-1 alpha-2, uppercase (e.g. "US", "DE", "AE"). */
  countryCode: string
  /** Normalized display name, e.g. "Berlin, Germany" or "Beverly Hills, CA". */
  displayName: string
  isUS: boolean
}

interface GoogleGeocodeResponse {
  status: string
  results?: Array<{
    formatted_address?: string
    geometry?: { location?: { lat: number; lng: number } }
    address_components?: Array<{
      long_name: string
      short_name: string
      types: string[]
    }>
  }>
}

/** Google Geocoding API — worldwide, uses the same key as the Places provider.
 *  Throws on any failure so the caller can fall back to Nominatim. */
async function geocodeGoogle(query: string, countryCode?: string): Promise<ResolvedLocation> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) throw new Error('No Google geocoding key configured')

  const qs = new URLSearchParams({ address: query, key: apiKey, language: 'en' })
  if (countryCode) {
    qs.set('components', `country:${countryCode.toUpperCase()}`)
    qs.set('region', countryCode.toLowerCase())
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 5000)
  let res: Response
  try {
    res = await fetch(`${GOOGLE_GEOCODE_URL}?${qs.toString()}`, {
      signal: controller.signal,
      next: { revalidate: 86400 },
    })
  } finally {
    clearTimeout(timer)
  }
  if (!res.ok) throw new Error(`Google Geocoding HTTP ${res.status}`)

  const data = (await res.json()) as GoogleGeocodeResponse
  if (data.status === 'ZERO_RESULTS') throw new LocationNotFoundError(query)
  if (data.status !== 'OK' || !data.results?.length) {
    // REQUEST_DENIED / OVER_QUERY_LIMIT / key restrictions → let Nominatim try
    throw new Error(`Google Geocoding status ${data.status}`)
  }

  const best = data.results[0]
  const loc = best.geometry?.location
  if (!loc) throw new LocationNotFoundError(query)

  const comps = best.address_components ?? []
  const find = (type: string) => comps.find((c) => c.types.includes(type))
  const country = find('country')
  const cc = (country?.short_name ?? countryCode ?? '').toUpperCase()
  const admin1 = find('administrative_area_level_1')
  const city =
    find('locality')?.long_name ??
    find('postal_town')?.long_name ??
    find('sublocality')?.long_name ??
    find('administrative_area_level_2')?.long_name ??
    admin1?.long_name ??
    ''
  const isUS = cc === 'US'
  const stateAbbr = isUS ? (admin1?.short_name ?? '') : ''

  const displayName = isUS
    ? [city, stateAbbr || admin1?.long_name].filter(Boolean).join(', ')
    : [city, country?.long_name].filter(Boolean).join(', ') ||
      (best.formatted_address ?? query)

  return {
    lat: loc.lat,
    lon: loc.lng,
    city,
    state: admin1?.long_name ?? '',
    stateAbbr,
    areaCode: isUS ? (STATE_AREA_CODES[stateAbbr] ?? '555') : '',
    countryCode: cc,
    displayName: displayName || query,
    isUS,
  }
}

interface NominatimFreeTextResult {
  lat: string
  lon: string
  name?: string
  display_name?: string
  address?: {
    city?: string
    town?: string
    village?: string
    suburb?: string
    county?: string
    state?: string
    country?: string
    country_code?: string
    administrative?: string
  }
}

/** Nominatim free-text search — keyless worldwide fallback. */
async function geocodeNominatim(query: string, countryCode?: string): Promise<ResolvedLocation> {
  const qs = new URLSearchParams({
    q: query,
    format: 'json',
    limit: '1',
    addressdetails: '1',
  })
  if (countryCode) qs.set('countrycodes', countryCode.toLowerCase())

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 5000)
  let res: Response
  try {
    res = await fetch(`${NOMINATIM_URL}?${qs.toString()}`, {
      headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en' },
      signal: controller.signal,
      next: { revalidate: 86400 },
    })
  } finally {
    clearTimeout(timer)
  }
  if (!res.ok) throw new Error(`Nominatim ${res.status}`)

  const data = (await res.json()) as NominatimFreeTextResult[]
  if (!data.length) throw new LocationNotFoundError(query)

  const { lat, lon, name, address } = data[0]
  const cc = (address?.country_code ?? countryCode ?? '').toUpperCase()
  const isUS = cc === 'US'
  // Prefer the matched place's own name ("London") over the containing admin
  // area ("Greater London") — it's what the user actually searched for.
  const city =
    name ??
    address?.city ??
    address?.town ??
    address?.village ??
    address?.suburb ??
    address?.administrative ??
    address?.county ??
    ''
  const stateAbbr = isUS ? stateNameToAbbr(address?.state ?? '') : ''
  const displayName = isUS
    ? [city, stateAbbr || address?.state].filter(Boolean).join(', ')
    : [city, address?.country].filter(Boolean).join(', ') || query

  return {
    lat: parseFloat(lat),
    lon: parseFloat(lon),
    city,
    state: address?.state ?? '',
    stateAbbr,
    areaCode: isUS ? (STATE_AREA_CODES[stateAbbr] ?? '555') : '',
    countryCode: cc,
    displayName: displayName || query,
    isUS,
  }
}

/** Geocode a free-text location ("Berlin, Germany", "Dubai", "SW1A 1AA").
 *  Tries Google Geocoding (worldwide, same key as Places) first, falls back to
 *  Nominatim. Throws LocationNotFoundError when neither can place the input. */
export async function geocodeFreeText(query: string, countryCode?: string): Promise<ResolvedLocation> {
  const q = query.trim()
  if (!q) throw new LocationNotFoundError(q)
  try {
    return await geocodeGoogle(q, countryCode)
  } catch (err) {
    // Only give up early on a definitive "no such place" WITH country bias
    // removed below via Nominatim; key/quota/network errors also fall through.
    if (!(err instanceof LocationNotFoundError)) {
      console.warn('[geocode] Google geocoding unavailable, using Nominatim:', err)
    }
  }
  return geocodeNominatim(q, countryCode)
}

/** Search radius in miles: km is canonical for international searches. */
export function effectiveRadiusMiles(params: { radiusMiles: number; radiusKm?: number }): number {
  return params.radiusKm != null ? params.radiusKm * 0.621371 : params.radiusMiles
}

/** Search radius in meters, from km (international) or miles (ZIP mode). */
export function effectiveRadiusMeters(params: { radiusMiles: number; radiusKm?: number }): number {
  return Math.round(params.radiusKm != null ? params.radiusKm * 1000 : params.radiusMiles * 1609.34)
}

/** Params accepted by the resolver — a structural subset of SearchParams so
 *  providers can pass their params object straight through. */
export interface LocationParams {
  zipCode?: string
  location?: string
  countryCode?: string
}

/**
 * Single entry point used by every provider (and the search API route).
 *
 * Mode detection:
 *  - 5-digit input with country US (or none) → existing US ZIP fast path
 *  - anything else → worldwide free-text geocoding, biased by countryCode
 *
 * Non-US postal codes that happen to be 5 digits (e.g. "10117" in Germany)
 * take the free-text path because a non-US country is selected.
 */
export async function resolveSearchLocation(params: LocationParams): Promise<ResolvedLocation> {
  const raw = (params.location ?? '').trim() || (params.zipCode ?? '').trim()
  if (!raw) throw new LocationNotFoundError(raw)

  const cc = (params.countryCode ?? '').trim().toUpperCase()
  const usIntent = cc === '' || cc === 'US'

  if (usIntent && isUsZip(raw)) {
    const zip = raw.slice(0, 5)
    const geo = await geocodeZip(zip)
    return {
      ...geo,
      countryCode: 'US',
      displayName: [geo.city, geo.stateAbbr || geo.state].filter(Boolean).join(', ') || zip,
      isUS: true,
    }
  }

  return geocodeFreeText(raw, cc || undefined)
}
