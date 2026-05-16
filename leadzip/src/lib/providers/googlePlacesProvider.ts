import { Lead, SearchParams, SearchResult } from '@/types/lead'
import { calculateLeadScore } from '@/lib/scoring'
import { geocodeZip } from '@/lib/geocode'

const PLACES_TEXT_SEARCH_URL = 'https://maps.googleapis.com/maps/api/place/textsearch/json'
const PLACES_DETAILS_URL = 'https://maps.googleapis.com/maps/api/place/details/json'

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
  'HVAC Services': 'general_contractor',
  'Pet Services': 'veterinary_care',
  'Roofing': 'roofing_contractor',
  'Insurance Agents': 'insurance_agency',
  'Accountants': 'accounting',
  'Chiropractors': 'physiotherapist',
  'Photographers': 'photographer',
  'Cleaning Services': 'cleaning_service',
  'Catering': 'meal_delivery',
  'Moving Companies': 'moving_company',
  'Manufacturers': 'store',
  'Distributors': 'store',
}

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

// Fetch phone + website for up to 10 places concurrently via Place Details API
async function enrichWithDetails(
  placeIds: string[],
  apiKey: string
): Promise<Map<string, { phone: string; website: string }>> {
  const results = new Map<string, { phone: string; website: string }>()
  const batch = placeIds.slice(0, 10) // cap at 10 to avoid excessive API spend

  await Promise.allSettled(
    batch.map(async (placeId) => {
      try {
        const url = `${PLACES_DETAILS_URL}?place_id=${encodeURIComponent(placeId)}&fields=formatted_phone_number,website&key=${apiKey}`
        const res = await fetch(url)
        if (!res.ok) return
        const data = (await res.json()) as PlaceDetailsResponse
        if (data.status === 'OK' && data.result) {
          results.set(placeId, {
            phone: data.result.formatted_phone_number ?? '',
            website: data.result.website ?? '',
          })
        }
      } catch {
        // Non-fatal — lead still appears without phone/website
      }
    })
  )

  return results
}

// --- Main export ---

export async function searchLeadsGooglePlaces(params: SearchParams): Promise<SearchResult> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) throw new Error('GOOGLE_PLACES_API_KEY not configured')

  const { lat, lon, city: geoCity, state: geoState } = await geocodeZip(params.zipCode)
  const radiusMeters = Math.round(params.radiusMiles * 1609.34)

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

  const placeType = GOOGLE_PLACES_TYPES[params.category]
  if (placeType) urlParams.set('type', placeType)

  const response = await fetch(`${PLACES_TEXT_SEARCH_URL}?${urlParams.toString()}`)
  if (!response.ok) throw new Error(`Google Places HTTP ${response.status}`)

  const data = (await response.json()) as GooglePlacesResponse

  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(
      `Google Places error: ${data.status}${data.error_message ? ` — ${data.error_message}` : ''}`
    )
  }

  const results = data.results ?? []
  if (results.length === 0) throw new Error('Google Places returned zero results')

  // Enrich with phone + website via Place Details API
  const placeIds = results.map((r) => r.place_id)
  const details = await enrichWithDetails(placeIds, apiKey)

  // Deduplicate by name + address
  const seen = new Set<string>()
  const partialLeads = results
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
      } satisfies Omit<Lead, 'leadScore' | 'status' | 'notes'>
    })
    .filter((l): l is NonNullable<typeof l> => l !== null)

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
