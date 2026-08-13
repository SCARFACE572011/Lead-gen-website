import { Lead, SearchParams, SearchResult } from '@/types/lead'
import { calculateLeadScore } from '@/lib/scoring'
import { resolveSearchLocation, effectiveRadiusMeters } from '@/lib/geocode'
import { formatPhone } from '@/lib/phoneFormatter'

const FSQ_SEARCH_URL = 'https://api.foursquare.com/v3/places/search'

// Foursquare category IDs mapped to LeadZipp categories
// Full list: https://location.foursquare.com/developer/reference/place-categories
const FSQ_CATEGORY_IDS: Record<string, string> = {
  'Restaurants':         '13065,13032,13064,13040',  // restaurant, cafe, fast food, bar
  'Dentists':            '15014',                     // dentist
  'Law Firms':           '11068',                     // law office
  'Contractors':         '11156,11175',               // contractor, construction
  'Auto Shops':          '11025,11026',               // auto repair, auto parts
  'Real Estate Agents':  '11108',                     // real estate
  'Medical Clinics':     '15019,15039,15000',         // clinic, urgent care, medical
  'Gyms & Fitness':      '18021,18004',               // gym, fitness center
  'Hair & Beauty Salons':'11165,11044',               // hair salon, beauty salon
  'Plumbers':            '11147',                     // plumber
  'Electricians':        '11052',                     // electrician
  'Landscaping':         '11077',                     // landscaping
  'HVAC Services':       '11064',                     // hvac
  'Cleaning Services':   '11135',                     // cleaning service / housekeeping
  'Photographers':       '11104',                     // photographer
  'Catering':            '13068',                     // catering
  'Pet Services':        '11097,15049',               // pet service, vet
  'Roofing':             '11110',                     // roofing
  'Moving Companies':    '11083',                     // moving company
  'Insurance Agents':    '11066',                     // insurance
  'Accountants':         '11010',                     // accounting
  'Chiropractors':       '15009',                     // chiropractor
  'Manufacturers':       '11078',                     // manufacturing
  'Distributors':        '11048',                     // distribution
}

// --- Foursquare API response types ---

interface FsqLocation {
  address?: string
  city?: string
  state?: string
  postcode?: string
  country?: string
}

interface FsqGeocode {
  main?: { latitude: number; longitude: number }
}

interface FsqPlace {
  fsq_id: string
  name: string
  location: FsqLocation
  geocodes?: FsqGeocode
  rating?: number          // 0–10 scale
  stats?: { total_ratings?: number; total_reviews?: number }
  tel?: string
  website?: string
}

interface FsqSearchResponse {
  results: FsqPlace[]
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

// --- Main export ---

// Fetch one page of FSQ results for a given center point
async function fetchFsqPage(
  apiKey: string,
  centerLat: number,
  centerLon: number,
  radiusMeters: number,
  categoryIds: string | undefined,
  query: string
): Promise<FsqPlace[]> {
  const urlParams = new URLSearchParams({
    ll: `${centerLat},${centerLon}`,
    radius: String(radiusMeters),
    limit: '50',
    fields: 'fsq_id,name,location,geocodes,rating,stats,tel,website',
  })
  if (categoryIds) urlParams.set('categories', categoryIds)
  if (query) urlParams.set('query', query)

  const res = await fetch(`${FSQ_SEARCH_URL}?${urlParams.toString()}`, {
    headers: { Authorization: apiKey, Accept: 'application/json' },
  })
  if (!res.ok) return []
  const data = (await res.json()) as FsqSearchResponse
  return data.results ?? []
}

export async function searchLeadsFoursquare(params: SearchParams): Promise<SearchResult> {
  const apiKey = process.env.FOURSQUARE_API_KEY
  if (!apiKey) throw new Error('FOURSQUARE_API_KEY not configured')

  const loc = params.resolved ?? (await resolveSearchLocation(params))
  const { lat, lon, city: geoCity, state: geoState } = loc

  // Foursquare caps radius at 100,000m (~62mi). For larger radii, tile the area
  // with multiple sub-searches at offset centers so we cover the full radius.
  const FSQ_MAX_RADIUS = 100000
  const radiusMeters = effectiveRadiusMeters(params)
  const categoryIds = FSQ_CATEGORY_IDS[params.category]
  const query = params.category === 'Custom Keyword' && params.keyword
    ? params.keyword
    : params.category === 'Custom Keyword' ? '' : params.category

  let allPlaces: FsqPlace[] = []

  if (radiusMeters <= FSQ_MAX_RADIUS) {
    // Single call covers the whole radius
    allPlaces = await fetchFsqPage(apiKey, lat, lon, radiusMeters, categoryIds, query)
  } else {
    // Tile with center + 4 offset sub-centers at ~60% of max radius distance
    // so each sub-circle overlaps and together they cover the full area
    const offsetDeg = (FSQ_MAX_RADIUS * 0.6) / 111320 // meters → degrees
    const centers = [
      [lat, lon],
      [lat + offsetDeg, lon],
      [lat - offsetDeg, lon],
      [lat, lon + offsetDeg / Math.cos((lat * Math.PI) / 180)],
      [lat, lon - offsetDeg / Math.cos((lat * Math.PI) / 180)],
    ]
    const pages = await Promise.allSettled(
      centers.map(([cLat, cLon]) =>
        fetchFsqPage(apiKey, cLat, cLon, FSQ_MAX_RADIUS, categoryIds, query)
      )
    )
    for (const p of pages) {
      if (p.status === 'fulfilled') allPlaces.push(...p.value)
    }
  }

  const places = allPlaces

  // Deduplicate by name + address
  const seen = new Set<string>()
  const partialLeads = places
    .map((place): Omit<Lead, 'leadScore' | 'status' | 'notes'> | null => {
      const coords = place.geocodes?.main
      if (!coords) return null

      const address = place.location.address ?? ''
      const city = place.location.city ?? geoCity
      const state = place.location.state ?? geoState
      const zipCode = place.location.postcode ?? params.zipCode

      const key = `${place.name.toLowerCase()}|${address.toLowerCase()}`
      if (seen.has(key)) return null
      seen.add(key)

      // Foursquare rates 0–10; convert to 0–5 for consistency with Google/Yelp
      const rating = place.rating != null ? Math.round((place.rating / 2) * 10) / 10 : null
      const reviewCount = place.stats?.total_ratings ?? place.stats?.total_reviews ?? null

      return {
        id: `fsq_${place.fsq_id}`,
        businessName: place.name,
        category: params.category,
        address,
        city,
        state,
        zipCode,
        phone: place.tel ? formatPhone(place.tel, loc.countryCode) : '',
        website: place.website ?? '',
        rating,
        reviewCount,
        latitude: coords.latitude,
        longitude: coords.longitude,
        distanceMiles: haversineDistanceMiles(lat, lon, coords.latitude, coords.longitude),
        createdAt: new Date().toISOString(),
      }
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
