import { Lead, SearchParams, SearchResult } from '@/types/lead'
import { calculateLeadScore } from '@/lib/scoring'
import { geocodeZip } from '@/lib/geocode'

const PLACES_TEXT_SEARCH_URL = 'https://maps.googleapis.com/maps/api/place/textsearch/json'

// Maps LeadZip categories to Google Places types for precise filtering
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
  'HVAC Services': 'plumber', // closest available type
  'Pet Services': 'veterinary_care',
  'Roofing': 'roofing_contractor',
  'Insurance Agents': 'insurance_agency',
  'Accountants': 'accounting',
  'Chiropractors': 'physiotherapist',
  'Photographers': 'photographer',
  'Cleaning Services': 'cleaning_service',
  'Catering': 'meal_delivery',
  'Moving Companies': 'moving_company',
}

// --- Google Places API response types ---

interface GooglePlacesGeometry {
  location: { lat: number; lng: number }
}

interface GooglePlacesResult {
  place_id: string
  name: string
  formatted_address: string
  geometry: GooglePlacesGeometry
  rating?: number
  user_ratings_total?: number
  // NOTE: phone and website are NOT returned by Text Search.
  // Use the Place Details API (GET /place/details/json?place_id=...&fields=formatted_phone_number,website)
  // to retrieve them — this adds one request per place and is intentionally deferred.
}

interface GooglePlacesResponse {
  status: string
  error_message?: string
  results: GooglePlacesResult[]
  next_page_token?: string
}

// --- Helpers ---

function haversineDistanceMiles(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
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

/**
 * Parse a Google Places formatted_address string into components.
 *
 * Typical format: "123 Main St, Springfield, IL 62701, USA"
 * We split on commas and work backwards: last non-"USA" segment is "State ZIP",
 * second-to-last is city, everything before that is street address.
 */
function parseFormattedAddress(
  formatted: string,
  fallbackCity: string,
  fallbackState: string,
  fallbackZip: string
): { address: string; city: string; state: string; zipCode: string } {
  // Strip trailing ", USA" / ", United States"
  const cleaned = formatted.replace(/,?\s*(USA|United States)\s*$/i, '').trim()
  const parts = cleaned.split(',').map((p) => p.trim()).filter(Boolean)

  if (parts.length >= 3) {
    // Last part: "IL 62701" or "IL" or "62701"
    const stateZip = parts[parts.length - 1]
    const stateZipMatch = stateZip.match(/^([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/)
    const state = stateZipMatch ? stateZipMatch[1] : fallbackState
    const zipCode = stateZipMatch ? stateZipMatch[2] : fallbackZip
    const city = parts[parts.length - 2] ?? fallbackCity
    const address = parts.slice(0, parts.length - 2).join(', ')
    return { address, city, state, zipCode }
  }

  if (parts.length === 2) {
    return {
      address: parts[0],
      city: fallbackCity,
      state: fallbackState,
      zipCode: fallbackZip,
    }
  }

  return { address: cleaned, city: fallbackCity, state: fallbackState, zipCode: fallbackZip }
}

function googlePlaceToLead(
  place: GooglePlacesResult,
  category: string,
  centerLat: number,
  centerLon: number,
  fallbackCity: string,
  fallbackState: string,
  searchZip: string
): Omit<Lead, 'leadScore' | 'status' | 'notes'> {
  const { lat, lng } = place.geometry.location
  const { address, city, state, zipCode } = parseFormattedAddress(
    place.formatted_address,
    fallbackCity,
    fallbackState,
    searchZip
  )

  return {
    id: `gp_${place.place_id}`,
    businessName: place.name,
    category,
    address,
    city,
    state,
    zipCode,
    // phone and website require a separate Place Details API call per place.
    // Set to empty strings for now; upgrade by fetching details when needed.
    phone: '',
    website: '',
    rating: place.rating ?? null,
    reviewCount: place.user_ratings_total ?? null,
    latitude: lat,
    longitude: lng,
    distanceMiles: haversineDistanceMiles(centerLat, centerLon, lat, lng),
    createdAt: new Date().toISOString(),
  }
}

// --- Main export ---

export async function searchLeadsGooglePlaces(params: SearchParams): Promise<SearchResult> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) throw new Error('GOOGLE_PLACES_API_KEY not configured')

  const { lat, lon, city: geoCity, state: geoState } = await geocodeZip(params.zipCode)
  const radiusMeters = Math.round(params.radiusMiles * 1609.34)

  // Build query text — use keyword for Custom Keyword searches, otherwise use category name
  const queryText =
    params.category === 'Custom Keyword' && params.keyword
      ? `${params.keyword} near ${geoCity}, ${geoState}`
      : `${params.category} near ${geoCity}, ${geoState}`

  const urlParams = new URLSearchParams({
    query: queryText,
    location: `${lat},${lon}`,
    radius: String(radiusMeters),
    key: apiKey,
  })

  // Add type filter for precision when a known mapping exists
  const placeType = GOOGLE_PLACES_TYPES[params.category]
  if (placeType) {
    urlParams.set('type', placeType)
  }

  const response = await fetch(`${PLACES_TEXT_SEARCH_URL}?${urlParams.toString()}`)
  if (!response.ok) {
    throw new Error(`Google Places API HTTP error ${response.status}`)
  }

  const data = (await response.json()) as GooglePlacesResponse

  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(
      `Google Places API error: ${data.status}${data.error_message ? ` — ${data.error_message}` : ''}`
    )
  }

  const results = data.results ?? []

  const partialLeads = results.map((place) =>
    googlePlaceToLead(place, params.category, lat, lon, geoCity, geoState, params.zipCode)
  )

  // Deduplicate by business name + address
  const seen = new Set<string>()
  const dedupedLeads = partialLeads.filter((l) => {
    const key = `${l.businessName.toLowerCase()}|${l.address.toLowerCase()}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  let leads: Lead[] = dedupedLeads.map((l) => ({
    ...l,
    leadScore: calculateLeadScore(l, params),
    status: 'new' as const,
    notes: '',
  }))

  // Apply rating filter (Google Places returns ratings)
  if (params.minRating != null) {
    leads = leads.filter((l) => l.rating != null && l.rating >= params.minRating!)
  }

  // hasWebsite / hasPhone will produce empty results since basic Text Search
  // does not return phone/website — callers should be aware of this limitation.
  if (params.hasWebsite === true) {
    leads = leads.filter((l) => !!l.website)
  }
  if (params.hasPhone === true) {
    leads = leads.filter((l) => !!l.phone)
  }

  // Keyword filter for non-Custom searches
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

  return { leads, total: leads.length }
}
