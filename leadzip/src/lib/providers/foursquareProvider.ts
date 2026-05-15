import { Lead, SearchParams, SearchResult } from '@/types/lead'
import { calculateLeadScore } from '@/lib/scoring'
import { geocodeZip } from '@/lib/geocode'
import { formatPhone } from '@/lib/phoneFormatter'

const FSQ_SEARCH_URL = 'https://api.foursquare.com/v3/places/search'

// Foursquare category IDs mapped to LeadZip categories
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
  'Cleaning Services':   '11044',                     // cleaning service
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

export async function searchLeadsFoursquare(params: SearchParams): Promise<SearchResult> {
  const apiKey = process.env.FOURSQUARE_API_KEY
  if (!apiKey) throw new Error('FOURSQUARE_API_KEY not configured')

  const { lat, lon, city: geoCity, state: geoState } = await geocodeZip(params.zipCode)
  const radiusMeters = Math.min(Math.round(params.radiusMiles * 1609.34), 100000)

  const urlParams = new URLSearchParams({
    ll: `${lat},${lon}`,
    radius: String(radiusMeters),
    limit: '50',
    fields: 'fsq_id,name,location,geocodes,rating,stats,tel,website',
  })

  // Use category IDs for known categories, text query for custom/unknown
  const categoryIds = FSQ_CATEGORY_IDS[params.category]
  if (params.category === 'Custom Keyword' && params.keyword) {
    urlParams.set('query', params.keyword)
  } else if (categoryIds) {
    urlParams.set('categories', categoryIds)
    urlParams.set('query', params.category) // helps rank relevance
  } else {
    urlParams.set('query', params.category)
  }

  const response = await fetch(`${FSQ_SEARCH_URL}?${urlParams.toString()}`, {
    headers: {
      Authorization: apiKey,
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Foursquare API HTTP ${response.status}`)
  }

  const data = (await response.json()) as FsqSearchResponse
  const places = data.results ?? []

  if (places.length === 0) throw new Error('Foursquare returned zero results')

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
        phone: place.tel ? formatPhone(place.tel) : '',
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
  return { leads, total: leads.length }
}
