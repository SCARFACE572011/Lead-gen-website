import { Lead, SearchParams, SearchResult } from '@/types/lead'
import { calculateLeadScore } from '@/lib/scoring'
import { geocodeZip } from '@/lib/geocode'

// Places API (New) — the legacy /maps/api/place endpoints are not enabled for
// API keys created after March 2025, so all requests go to places.googleapis.com.
const PLACES_SEARCH_TEXT_URL = 'https://places.googleapis.com/v1/places:searchText'
// Nearby Search returns the businesses actually around a point — every type,
// no text matching. Used for "All categories" searches, where a text query
// would literal-match its own words (e.g. businesses NAMED "business").
const PLACES_SEARCH_NEARBY_URL = 'https://places.googleapis.com/v1/places:searchNearby'

// Fields requested per place. Phone/website/hours arrive directly in the search
// response, so no per-place Details calls are needed.
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
  'places.priceLevel',
  'places.regularOpeningHours.openNow',
  'places.regularOpeningHours.weekdayDescriptions',
  'nextPageToken',
].join(',')

// searchNearby has no pagination, so its mask must not request nextPageToken
// (an unknown field in the mask is an INVALID_ARGUMENT error).
const NEARBY_FIELD_MASK = FIELD_MASK.replace(',nextPageToken', '')

// Curated SELLABLE business types for "All categories" nearby searches.
// Without includedTypes, Nearby Search returns every prominent place — schools,
// parks, malls, government buildings — none of which are prospects anyone can
// pitch. Grouped so we can fire the groups in parallel (20 results max per
// call → 3 groups ≈ up to 60 diverse leads). All names are long-established
// place types, valid in Places API (New) Table A.
const NEARBY_SMB_TYPE_GROUPS: string[][] = [
  // Food & retail storefronts
  [
    'restaurant', 'cafe', 'bakery', 'bar', 'florist', 'jewelry_store',
    'clothing_store', 'shoe_store', 'furniture_store', 'hardware_store',
    'pet_store', 'convenience_store', 'book_store', 'bicycle_store',
  ],
  // Health & personal care
  [
    'hair_care', 'beauty_salon', 'spa', 'gym', 'dentist', 'doctor',
    'physiotherapist', 'veterinary_care', 'pharmacy', 'laundry',
  ],
  // Professional services & trades
  [
    'lawyer', 'accounting', 'insurance_agency', 'real_estate_agency',
    'plumber', 'electrician', 'roofing_contractor', 'general_contractor',
    'painter', 'moving_company', 'storage', 'car_repair', 'car_dealer',
    'car_wash', 'locksmith', 'travel_agency',
  ],
]
const NEARBY_SMB_TYPES_ALL = NEARBY_SMB_TYPE_GROUPS.flat()

// Place type used as a precise first-pass filter (Places API New, Table A).
// If this returns < MIN_TYPED_RESULTS we fall back to the broad text search.
const GOOGLE_PLACES_TYPES: Record<string, string> = {
  'Restaurants': 'restaurant',
  'Dentists': 'dentist',
  'Law Firms': 'lawyer',
  'Contractors': 'general_contractor',
  'Auto Shops': 'car_repair',
  'Real Estate Agents': 'real_estate_agency',
  'Medical Clinics': 'doctor',
  'Gyms & Fitness': 'gym',
  'Hair & Beauty Salons': 'beauty_salon',
  'Plumbers': 'plumber',
  'Electricians': 'electrician',
  'Roofing': 'roofing_contractor',
  'Insurance Agents': 'insurance_agency',
  'Accountants': 'accounting',
  'Chiropractors': 'physiotherapist',
  'Moving Companies': 'moving_company',
  'Childcare & Daycares': 'child_care_agency',
  'Veterinarians': 'veterinary_care',
  'Pharmacies': 'pharmacy',
}

// More specific search queries per category — improves Google relevance ranking
// vs just using the raw category name.
const CATEGORY_QUERY: Record<string, string> = {
  'Dentists': 'dental office dentist',
  'Law Firms': 'law firm attorney office',
  'Contractors': 'general contractor home improvement',
  'Auto Shops': 'auto repair shop mechanic',
  'Medical Clinics': 'medical clinic doctor office',
  'Gyms & Fitness': 'gym fitness center',
  'Hair & Beauty Salons': 'hair salon beauty salon',
  'Plumbers': 'plumbing contractor',
  'Electricians': 'electrical contractor electrician',
  'Landscaping': 'landscaping lawn care',
  'HVAC Services': 'HVAC heating cooling air conditioning',
  'Cleaning Services': 'cleaning service janitorial',
  'Roofing': 'roofing contractor',
  'Moving Companies': 'moving company movers',
  'Insurance Agents': 'insurance agency',
  'Accountants': 'accounting firm CPA',
  'Chiropractors': 'chiropractic office',
  'Pet Services': 'pet grooming veterinary',
  'IT Services': 'IT services managed services technology',
  'Financial Advisors': 'financial advisor wealth management',
  'Mortgage Brokers': 'mortgage broker lender',
  'Property Management': 'property management company',
  'Tutoring Centers': 'tutoring center learning',
  'Childcare & Daycares': 'daycare childcare center',
  'Yoga Studios': 'yoga studio',
  'Therapy & Counseling': 'therapy counseling mental health',
  'Veterinarians': 'veterinary clinic animal hospital',
  'Optometrists': 'optometrist eye doctor',
  'Event Planners': 'event planning company',
  'Pest Control': 'pest control exterminator',
  'Pool Services': 'pool service maintenance',
  'Solar Installers': 'solar panel installation',
  'Marketing Agencies': 'marketing agency digital marketing',
  'Security Companies': 'security company alarm systems',
  'Printing Services': 'printing service print shop',
  'Catering': 'catering company',
  'Photographers': 'photography studio',
}

// Keywords that MUST appear in results for each category to pass relevance filter.
// Any result matching at least one keyword is kept. Overly broad to avoid
// false positives — only obvious mismatches are removed.
const RELEVANCE_KEYWORDS: Record<string, string[]> = {
  'Dentists': ['dental', 'dentist', 'orthodont', 'endodont', 'periodon', 'smile', 'teeth', 'oral'],
  'Law Firms': ['law', 'legal', 'attorney', 'lawyer', 'counsel', 'llp', 'pc', 'litigation'],
  'Auto Shops': ['auto', 'car', 'vehicle', 'motor', 'tire', 'brake', 'transmission', 'mechanic', 'automotive'],
  'Medical Clinics': ['medical', 'clinic', 'health', 'doctor', 'physician', 'urgent care', 'primary care', 'medicine'],
  'Plumbers': ['plumb', 'pipe', 'drain', 'sewer', 'water', 'leak'],
  'Electricians': ['electric', 'wiring', 'power', 'lighting', 'voltage'],
  'HVAC Services': ['hvac', 'heating', 'cooling', 'air condition', 'furnace', 'heat pump', 'climate'],
  'Roofing': ['roof', 'shingle', 'gutter'],
  'Pest Control': ['pest', 'exterminator', 'termite', 'bug', 'rodent', 'insect'],
  'Cleaning Services': ['clean', 'maid', 'janitorial', 'housekeeping', 'sanitiz'],
  'Moving Companies': ['moving', 'mover', 'relocation', 'storage', 'hauling'],
  'Landscaping': ['landscape', 'lawn', 'garden', 'tree', 'yard', 'mow', 'turf'],
  'Chiropractors': ['chiro', 'spine', 'wellness', 'adjustment'],
  'Yoga Studios': ['yoga', 'pilates', 'meditation', 'mindfulness'],
  'Solar Installers': ['solar', 'photovoltaic', 'renewable', 'energy'],
  'Pool Services': ['pool', 'spa', 'hot tub', 'aquatic'],
}

// Minimum results from the typed search before we fall back to broad text search
const MIN_TYPED_RESULTS = 8

// Places API (New) enum → legacy numeric price level
const PRICE_LEVEL_MAP: Record<string, number> = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
}

// --- Places API (New) response types ---

interface GooglePlaceNew {
  id: string
  displayName?: { text?: string }
  formattedAddress?: string
  location?: { latitude: number; longitude: number }
  rating?: number
  userRatingCount?: number
  nationalPhoneNumber?: string
  websiteUri?: string
  businessStatus?: string
  priceLevel?: string
  regularOpeningHours?: { openNow?: boolean; weekdayDescriptions?: string[] }
}

interface SearchTextResponse {
  places?: GooglePlaceNew[]
  nextPageToken?: string
}

interface SearchTextRequest {
  textQuery: string
  pageSize: number
  locationBias: {
    circle: { center: { latitude: number; longitude: number }; radius: number }
  }
  includedType?: string
  pageToken?: string
}

// --- Helpers ---

function haversineDistanceMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function parseFormattedAddress(
  formatted: string,
  fallbackCity: string,
  fallbackState: string,
  fallbackZip: string
): { address: string; city: string; state: string; zipCode: string } {
  const cleaned = formatted.replace(/,?\s*(USA|United States)\s*$/i, '').trim()
  const parts = cleaned.split(',').map((p) => p.trim()).filter(Boolean)

  if (parts.length >= 3) {
    const stateZip = parts[parts.length - 1]
    const stateZipMatch = stateZip.match(/^([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/)
    const state = stateZipMatch ? stateZipMatch[1] : fallbackState
    const zipCode = stateZipMatch ? stateZipMatch[2] : fallbackZip
    const city = parts[parts.length - 2] ?? fallbackCity
    const address = parts.slice(0, parts.length - 2).join(', ')
    return { address, city, state, zipCode }
  }

  if (parts.length === 2) {
    return { address: parts[0], city: fallbackCity, state: fallbackState, zipCode: fallbackZip }
  }

  return { address: cleaned, city: fallbackCity, state: fallbackState, zipCode: fallbackZip }
}

// Returns true if the business name passes the relevance check for the category.
// Only filters when we have explicit keywords for that category.
function isRelevant(businessName: string, category: string): boolean {
  const keywords = RELEVANCE_KEYWORDS[category]
  if (!keywords) return true // no filter defined — keep everything
  const lower = businessName.toLowerCase()
  return keywords.some((kw) => lower.includes(kw))
}

async function fetchPage(body: SearchTextRequest, apiKey: string): Promise<SearchTextResponse> {
  const res = await fetch(PLACES_SEARCH_TEXT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    // Surface the real API error (REQUEST_DENIED, key restrictions, API not
    // enabled, …) instead of letting it masquerade as "zero results".
    let detail = ''
    try {
      const err = (await res.json()) as { error?: { status?: string; message?: string } }
      detail = ` ${err.error?.status ?? ''}: ${err.error?.message ?? ''}`
    } catch {
      /* non-JSON error body */
    }
    throw new Error(`Google Places HTTP ${res.status}${detail}`)
  }
  return res.json() as Promise<SearchTextResponse>
}

// Nearby Search: the businesses actually around a point, all types, ranked by
// prominence. Max 20 per call, no pagination.
async function fetchNearbyPage(
  center: { latitude: number; longitude: number },
  radiusMeters: number,
  apiKey: string,
  includedTypes?: string[]
): Promise<GooglePlaceNew[]> {
  const res = await fetch(PLACES_SEARCH_NEARBY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': NEARBY_FIELD_MASK,
    },
    body: JSON.stringify({
      maxResultCount: 20,
      rankPreference: 'POPULARITY',
      locationRestriction: { circle: { center, radius: radiusMeters } },
      ...(includedTypes?.length ? { includedTypes } : {}),
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
    throw new Error(`Google Places Nearby HTTP ${res.status}${detail}`)
  }
  const data = (await res.json()) as { places?: GooglePlaceNew[] }
  return data.places ?? []
}

// Fetch up to 3 pages (60 results) for a given request.
// Places API (New) page tokens are usable immediately — no forced delay.
async function fetchAllPages(base: SearchTextRequest, apiKey: string): Promise<GooglePlaceNew[]> {
  const all: GooglePlaceNew[] = []
  let token: string | undefined

  for (let page = 0; page < 3; page++) {
    const data = await fetchPage(token ? { ...base, pageToken: token } : base, apiKey)
    all.push(...(data.places ?? []))
    if (!data.nextPageToken) break
    token = data.nextPageToken
  }

  return all
}

// For radius > 30 miles, generate a ring of additional search centers.
// Each center is within Google's ~31-mile bias cap, so together they
// tile the full requested radius with overlapping circles.
function generateRingCenters(
  lat: number,
  lon: number,
  radiusMiles: number
): Array<{ lat: number; lon: number }> {
  // Ring at 55% of the search radius — keeps ring centers' 31-mile bias
  // from extending outside the requested boundary.
  const ringMiles = Math.min(radiusMiles * 0.55, 42)
  // 4 directions for 31–60 mi, 8 directions for 60+ mi
  const count = radiusMiles > 60 ? 8 : 4
  const centers: Array<{ lat: number; lon: number }> = []

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * 2 * Math.PI
    const dLat = (ringMiles / 69.0) * Math.cos(angle)
    const dLon = (ringMiles / (69.0 * Math.cos((lat * Math.PI) / 180))) * Math.sin(angle)
    centers.push({ lat: lat + dLat, lon: lon + dLon })
  }

  return centers
}

// --- Main export ---

export async function searchLeadsGooglePlaces(params: SearchParams): Promise<SearchResult> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) throw new Error('GOOGLE_PLACES_API_KEY not configured')

  const { lat, lon, city: geoCity, state: geoState } = await geocodeZip(params.zipCode)
  // Text Search location bias caps at 50km regardless of what's requested
  const radiusMeters = Math.min(Math.round(params.radiusMiles * 1609.34), 50000)

  const queryTerm = CATEGORY_QUERY[params.category] ?? params.category
  const rawQuery =
    params.category === 'Custom Keyword' && params.keyword ? params.keyword : queryTerm
  // "All categories" (no category, no keyword): a text query would literal-match
  // its own words, so this mode uses Nearby Search below instead of text search.
  const allCategoriesMode = !rawQuery && !params.keyword
  const queryText = rawQuery || params.keyword || 'local businesses'

  const baseRequest: SearchTextRequest = {
    textQuery: queryText,
    pageSize: 20,
    locationBias: {
      circle: { center: { latitude: lat, longitude: lon }, radius: radiusMeters },
    },
  }

  // --- Strategy: typed search first, broad fallback if too few results ---
  let allResults: GooglePlaceNew[] = []
  const placeType = GOOGLE_PLACES_TYPES[params.category]

  if (allCategoriesMode) {
    // Sellable businesses around the point, ranked by prominence. Three
    // type-group calls in parallel (20 max each) give a diverse pool of up to
    // 60 actual prospects — and the whitelist keeps schools, parks, and other
    // non-business places out entirely.
    const groups = await Promise.allSettled(
      NEARBY_SMB_TYPE_GROUPS.map((types) =>
        fetchNearbyPage({ latitude: lat, longitude: lon }, radiusMeters, apiKey, types)
      )
    )
    const seenIds = new Set<string>()
    for (const g of groups) {
      if (g.status !== 'fulfilled') {
        console.warn('[googlePlacesProvider] nearby type-group failed:', g.reason)
        continue
      }
      for (const r of g.value) {
        if (!seenIds.has(r.id)) {
          seenIds.add(r.id)
          allResults.push(r)
        }
      }
    }
  } else if (placeType) {
    // Page 1 with type filter to gauge result quality. A rejected type
    // (INVALID_ARGUMENT) falls through to the broad search rather than
    // failing the whole provider.
    let firstData: SearchTextResponse | null = null
    try {
      firstData = await fetchPage({ ...baseRequest, includedType: placeType }, apiKey)
    } catch (err) {
      console.warn(`[googlePlacesProvider] typed search (${placeType}) failed, using broad search:`, err)
    }

    if (firstData) {
      const firstPage = firstData.places ?? []

      if (firstPage.length >= MIN_TYPED_RESULTS) {
        // Good signal — paginate this typed search for up to 60 results
        allResults = [...firstPage]
        let token = firstData.nextPageToken
        for (let p = 1; p < 3 && token; p++) {
          const next = await fetchPage(
            { ...baseRequest, includedType: placeType, pageToken: token },
            apiKey
          )
          allResults.push(...(next.places ?? []))
          token = next.nextPageToken
        }
      } else {
        // Typed search is too sparse — switch to broad text search.
        // Keep any typed results and supplement with broad results.
        const broadResults = await fetchAllPages(baseRequest, apiKey)
        const seenIds = new Set(firstPage.map((r) => r.id))
        allResults = [...firstPage]
        for (const r of broadResults) {
          if (!seenIds.has(r.id)) {
            seenIds.add(r.id)
            allResults.push(r)
          }
        }
      }
    } else {
      allResults = await fetchAllPages(baseRequest, apiKey)
    }
  } else {
    // No type mapping for this category — go straight to broad text search
    allResults = await fetchAllPages(baseRequest, apiKey)
  }

  // --- Multi-center radius expansion for radius > 30 miles ---
  // Text Search caps effective bias at ~31 miles. For larger radii we fire
  // additional 1-page searches from ring points so the full requested area
  // is covered. Parallel calls — no page-token waits needed here.
  if (params.radiusMiles > 30) {
    const ringCenters = generateRingCenters(lat, lon, params.radiusMiles)
    const seenPlaceIds = new Set(allResults.map((r) => r.id))

    const ringSearches = await Promise.allSettled(
      ringCenters.map((center) =>
        allCategoriesMode
          ? fetchNearbyPage(
              { latitude: center.lat, longitude: center.lon },
              50000,
              apiKey,
              NEARBY_SMB_TYPES_ALL
            )
          : fetchPage(
              {
                textQuery: queryText,
                pageSize: 20,
                locationBias: {
                  circle: {
                    center: { latitude: center.lat, longitude: center.lon },
                    radius: 50000,
                  },
                },
              },
              apiKey
            ).then((data) => data.places ?? [])
      )
    )

    for (const res of ringSearches) {
      if (res.status === 'fulfilled') {
        for (const r of res.value) {
          if (!seenPlaceIds.has(r.id)) {
            seenPlaceIds.add(r.id)
            allResults.push(r)
          }
        }
      }
    }
  }

  if (allResults.length === 0) throw new Error('Google Places returned zero results')

  // Deduplicate by name + address, filter closed + irrelevant businesses
  const seen = new Set<string>()
  const partialLeads = allResults
    .map((place) => {
      const name = place.displayName?.text ?? ''
      const pLat = place.location?.latitude
      const pLng = place.location?.longitude
      if (!name || pLat == null || pLng == null) return null

      const { address, city, state, zipCode } = parseFormattedAddress(
        place.formattedAddress ?? '',
        geoCity,
        geoState,
        params.zipCode
      )
      const key = `${name.toLowerCase()}|${address.toLowerCase()}`
      if (seen.has(key)) return null
      seen.add(key)

      if (place.businessStatus === 'CLOSED_PERMANENTLY') return null

      // Relevance filter — drop obvious category mismatches
      if (!isRelevant(name, params.category)) return null

      return {
        id: `gp_${place.id}`,
        businessName: name,
        category: params.category,
        address,
        city,
        state,
        zipCode,
        phone: place.nationalPhoneNumber ?? '',
        website: place.websiteUri ?? '',
        rating: place.rating ?? null,
        reviewCount: place.userRatingCount ?? null,
        latitude: pLat,
        longitude: pLng,
        distanceMiles: haversineDistanceMiles(lat, lon, pLat, pLng),
        createdAt: new Date().toISOString(),
        priceLevel: place.priceLevel != null ? PRICE_LEVEL_MAP[place.priceLevel] ?? null : null,
        openNow: place.regularOpeningHours?.openNow,
        businessHours: place.regularOpeningHours?.weekdayDescriptions,
      } satisfies Omit<Lead, 'leadScore' | 'status' | 'notes'>
    })
    .filter((l): l is NonNullable<typeof l> => l !== null && l.distanceMiles <= params.radiusMiles * 1.1)

  let leads: Lead[] = partialLeads.map((l) => ({
    ...l,
    leadScore: calculateLeadScore(l, params),
    status: 'new' as const,
    notes: '',
  }))

  if (params.minRating != null) {
    leads = leads.filter((l) => l.rating != null && l.rating >= params.minRating!)
  }
  if (params.hasWebsite === true) leads = leads.filter((l) => !!l.website)
  if (params.hasPhone === true) leads = leads.filter((l) => !!l.phone)
  if (params.keyword && params.category !== 'Custom Keyword') {
    const kw = params.keyword.toLowerCase()
    leads = leads.filter(
      (l) =>
        l.businessName.toLowerCase().includes(kw) ||
        l.address.toLowerCase().includes(kw) ||
        l.category.toLowerCase().includes(kw)
    )
  }

  leads.sort((a, b) => b.leadScore - a.leadScore)
  return { leads, total: leads.length, center: { lat, lon } }
}
