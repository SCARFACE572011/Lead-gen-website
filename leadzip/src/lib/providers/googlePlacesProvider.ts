import { Lead, SearchParams, SearchResult } from '@/types/lead'
import { calculateLeadScore } from '@/lib/scoring'
import { geocodeZip } from '@/lib/geocode'

const PLACES_TEXT_SEARCH_URL = 'https://maps.googleapis.com/maps/api/place/textsearch/json'
const PLACES_DETAILS_URL = 'https://maps.googleapis.com/maps/api/place/details/json'

// Google Places type used as a precise first-pass filter.
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
  'Landscaping': 'landscaping',
  'Roofing': 'roofing_contractor',
  'Insurance Agents': 'insurance_agency',
  'Accountants': 'accounting',
  'Chiropractors': 'physiotherapist',
  'Photographers': 'photographer',
  'Cleaning Services': 'cleaning_service',
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

// --- Google Places API response types ---

interface GooglePlacesResult {
  place_id: string
  name: string
  formatted_address: string
  geometry: { location: { lat: number; lng: number } }
  rating?: number
  user_ratings_total?: number
}

interface GooglePlacesResponse {
  status: string
  error_message?: string
  results: GooglePlacesResult[]
  next_page_token?: string
}

interface PlaceDetailsResponse {
  status: string
  result?: {
    formatted_phone_number?: string
    website?: string
    business_status?: string
    price_level?: number
    opening_hours?: {
      open_now?: boolean
      weekday_text?: string[]
    }
  }
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

interface PlaceEnrichment {
  phone: string
  website: string
  businessStatus: string
  priceLevel: number | null
  openNow?: boolean
  businessHours?: string[]
}

// Enrich all leads with phone, website, hours, price level concurrently
async function enrichWithDetails(
  placeIds: string[],
  apiKey: string
): Promise<Map<string, PlaceEnrichment>> {
  const enriched = new Map<string, PlaceEnrichment>()

  await Promise.allSettled(
    placeIds.map(async (placeId) => {
      try {
        const url = `${PLACES_DETAILS_URL}?place_id=${encodeURIComponent(placeId)}&fields=formatted_phone_number,website,business_status,price_level,opening_hours&key=${apiKey}`
        const res = await fetch(url)
        if (!res.ok) return
        const data = (await res.json()) as PlaceDetailsResponse
        if (data.status === 'OK' && data.result) {
          enriched.set(placeId, {
            phone: data.result.formatted_phone_number ?? '',
            website: data.result.website ?? '',
            businessStatus: data.result.business_status ?? 'OPERATIONAL',
            priceLevel: data.result.price_level ?? null,
            openNow: data.result.opening_hours?.open_now,
            businessHours: data.result.opening_hours?.weekday_text,
          })
        }
      } catch {
        // Non-fatal — lead still appears without enrichment
      }
    })
  )

  return enriched
}

async function fetchPage(
  urlParams: URLSearchParams,
  apiKey: string,
  pageToken?: string
): Promise<GooglePlacesResponse> {
  const p = new URLSearchParams(urlParams)
  if (pageToken) p.set('pagetoken', pageToken)
  const res = await fetch(`${PLACES_TEXT_SEARCH_URL}?${p.toString()}`)
  if (!res.ok) throw new Error(`Google Places HTTP ${res.status}`)
  return res.json() as Promise<GooglePlacesResponse>
}

// Fetch up to 3 pages (60 results) for a given URL params set.
// Google requires a 2s pause before each subsequent page token is valid.
async function fetchAllPages(urlParams: URLSearchParams, apiKey: string): Promise<GooglePlacesResult[]> {
  const all: GooglePlacesResult[] = []
  let token: string | undefined

  for (let page = 0; page < 3; page++) {
    if (page > 0) await new Promise((r) => setTimeout(r, 2000))
    const data = await fetchPage(urlParams, apiKey, token)
    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') break
    all.push(...(data.results ?? []))
    if (!data.next_page_token) break
    token = data.next_page_token
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
  // Google Text Search caps effective radius at ~50km regardless of what's passed
  const radiusMeters = Math.min(Math.round(params.radiusMiles * 1609.34), 50000)

  const queryTerm = CATEGORY_QUERY[params.category] ?? params.category
  const queryText =
    params.category === 'Custom Keyword' && params.keyword
      ? params.keyword
      : queryTerm

  const baseParams = new URLSearchParams({
    query: queryText,
    location: `${lat},${lon}`,
    radius: String(radiusMeters),
    key: apiKey,
  })

  // --- Strategy: typed search first, broad fallback if too few results ---
  let allResults: GooglePlacesResult[] = []
  const placeType = GOOGLE_PLACES_TYPES[params.category]

  if (placeType) {
    // Page 1 with type filter to gauge result quality
    const typedParams = new URLSearchParams(baseParams)
    typedParams.set('type', placeType)
    const firstData = await fetchPage(typedParams, apiKey)

    if (firstData.status === 'OK' || firstData.status === 'ZERO_RESULTS') {
      const firstPage = firstData.results ?? []

      if (firstPage.length >= MIN_TYPED_RESULTS) {
        // Good signal — paginate this typed search for up to 60 results
        allResults = [...firstPage]
        let token = firstData.next_page_token
        for (let p = 1; p < 3 && token; p++) {
          await new Promise((r) => setTimeout(r, 2000))
          const next = await fetchPage(typedParams, apiKey, token)
          allResults.push(...(next.results ?? []))
          token = next.next_page_token
        }
      } else {
        // Typed search is too sparse — switch to broad text search.
        // Keep any typed results and supplement with broad results.
        const broadResults = await fetchAllPages(baseParams, apiKey)
        const seenIds = new Set(firstPage.map((r) => r.place_id))
        allResults = [...firstPage]
        for (const r of broadResults) {
          if (!seenIds.has(r.place_id)) {
            seenIds.add(r.place_id)
            allResults.push(r)
          }
        }
      }
    }
  } else {
    // No type mapping for this category — go straight to broad text search
    allResults = await fetchAllPages(baseParams, apiKey)
  }

  // --- Multi-center radius expansion for radius > 30 miles ---
  // Google's Text Search caps effective bias at ~31 miles. For larger radii
  // we fire additional 1-page searches from ring points so the full requested
  // area is covered. Parallel calls — no page-token waits needed here.
  if (params.radiusMiles > 30) {
    const ringCenters = generateRingCenters(lat, lon, params.radiusMiles)
    const seenPlaceIds = new Set(allResults.map((r) => r.place_id))

    const ringSearches = await Promise.allSettled(
      ringCenters.map(async (center) => {
        const ringParams = new URLSearchParams({
          query: queryText,
          location: `${center.lat},${center.lon}`,
          radius: '50000',
          key: apiKey,
        })
        const data = await fetchPage(ringParams, apiKey)
        return data.status === 'OK' ? (data.results ?? []) : []
      })
    )

    for (const res of ringSearches) {
      if (res.status === 'fulfilled') {
        for (const r of res.value) {
          if (!seenPlaceIds.has(r.place_id)) {
            seenPlaceIds.add(r.place_id)
            allResults.push(r)
          }
        }
      }
    }
  }

  if (allResults.length === 0) throw new Error('Google Places returned zero results')

  // Enrich ALL results with phone + website + hours + price level concurrently
  const placeIds = allResults.map((r) => r.place_id)
  const details = await enrichWithDetails(placeIds, apiKey)

  // Deduplicate by name + address, filter closed + irrelevant businesses
  const seen = new Set<string>()
  const partialLeads = allResults
    .map((place) => {
      const { lat: pLat, lng: pLng } = place.geometry.location
      const { address, city, state, zipCode } = parseFormattedAddress(
        place.formatted_address,
        geoCity,
        geoState,
        params.zipCode
      )
      const d = details.get(place.place_id)
      const key = `${place.name.toLowerCase()}|${address.toLowerCase()}`
      if (seen.has(key)) return null
      seen.add(key)

      if (d?.businessStatus === 'CLOSED_PERMANENTLY') return null

      // Relevance filter — drop obvious category mismatches
      if (!isRelevant(place.name, params.category)) return null

      return {
        id: `gp_${place.place_id}`,
        businessName: place.name,
        category: params.category,
        address,
        city,
        state,
        zipCode,
        phone: d?.phone ?? '',
        website: d?.website ?? '',
        rating: place.rating ?? null,
        reviewCount: place.user_ratings_total ?? null,
        latitude: pLat,
        longitude: pLng,
        distanceMiles: haversineDistanceMiles(lat, lon, pLat, pLng),
        createdAt: new Date().toISOString(),
        priceLevel: d?.priceLevel ?? null,
        openNow: d?.openNow,
        businessHours: d?.businessHours,
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
