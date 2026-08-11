import type { SearchParams, Lead, SearchResult } from '@/types/lead'
import { geocodeZip } from '@/lib/geocode'
import { calculateLeadScore } from '@/lib/scoring'
import { formatPhone } from '@/lib/phoneFormatter'

// Yelp category aliases mapped to LeadZipp categories
// Full list: https://docs.developer.yelp.com/docs/resources-categories
const YELP_CATEGORY_MAP: Record<string, string> = {
  'Dentists': 'dentists',
  'Law Firms': 'lawyers',
  'Contractors': 'contractors',
  'Auto Shops': 'autorepair',
  'Medical Clinics': 'medicalhealthservices',
  'Gyms & Fitness': 'gyms',
  'Hair & Beauty Salons': 'hair',
  'Plumbers': 'plumbing',
  'Electricians': 'electricians',
  'Landscaping': 'landscaping',
  'HVAC Services': 'hvac',
  'Cleaning Services': 'homecleaning',
  'Roofing': 'roofing',
  'Moving Companies': 'movers',
  'Insurance Agents': 'insurance',
  'Accountants': 'accountants',
  'Chiropractors': 'chiropractors',
  'Pet Services': 'petservices',
  'IT Services': 'itservices',
  'Financial Advisors': 'financialservices',
  'Mortgage Brokers': 'mortgagebrokers',
  'Property Management': 'propertymanagement',
  'Tutoring Centers': 'tutoring',
  'Childcare & Daycares': 'childcare',
  'Yoga Studios': 'yoga',
  'Therapy & Counseling': 'counseling',
  'Veterinarians': 'veterinarians',
  'Optometrists': 'optometrists',
  'Event Planners': 'eventplanning',
  'Pest Control': 'pestcontrol',
  'Pool Services': 'poolcleaners',
  'Solar Installers': 'solar',
  'Marketing Agencies': 'marketing',
  'Security Companies': 'security',
  'Printing Services': 'printing',
  'Catering': 'caterers',
  'Photographers': 'photographers',
  'Restaurants': 'restaurants',
}

// --- Yelp API response types ---

interface YelpBusiness {
  id: string
  name: string
  is_closed: boolean
  phone: string
  rating: number
  review_count: number
  price?: string
  distance?: number
  url: string
  coordinates: { latitude: number; longitude: number }
  location: {
    address1: string
    city: string
    state: string
    zip_code: string
  }
  categories: Array<{ alias: string; title: string }>
}

interface YelpSearchResponse {
  businesses: YelpBusiness[]
  total: number
}

// --- Main export ---

export async function searchLeadsYelp(params: SearchParams): Promise<SearchResult> {
  const apiKey = process.env.YELP_API_KEY
  if (!apiKey) return { leads: [], total: 0 }

  const { lat, lon, city: geoCity, state: geoState } = await geocodeZip(params.zipCode)

  // Yelp radius is in meters, max 40,000 (≈ 24.85 miles)
  const radiusMeters = Math.min(Math.round(params.radiusMiles * 1609.34), 40000)

  const yelpCategories = YELP_CATEGORY_MAP[params.category]
  const isCustom = params.category === 'Custom Keyword'
  const term =
    isCustom && params.keyword
      ? params.keyword
      : !yelpCategories
      ? params.category
      : undefined

  const allBusinesses: YelpBusiness[] = []
  const limit = 50
  // Yelp allows max offset of 1000 and max 50 per call → up to 4 pages
  for (let offset = 0; offset < 200; offset += limit) {
    const urlParams = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      radius: String(radiusMeters),
      limit: String(limit),
      offset: String(offset),
      sort_by: 'rating',
    })
    if (yelpCategories && !isCustom) urlParams.set('categories', yelpCategories)
    if (term) urlParams.set('term', term)

    const res = await fetch(`https://api.yelp.com/v3/businesses/search?${urlParams}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      next: { revalidate: 0 },
    })

    if (!res.ok) {
      // Surface auth/quota failures — a dead key must not read as "no results"
      const body = await res.text().catch(() => '')
      console.warn(`[yelpProvider] HTTP ${res.status}: ${body.slice(0, 300)}`)
      break
    }

    const data = (await res.json()) as YelpSearchResponse
    if (!data.businesses?.length) break
    allBusinesses.push(...data.businesses)
    if (allBusinesses.length >= data.total) break
  }

  const seen = new Set<string>()
  const partialLeads = allBusinesses
    .filter((b) => !b.is_closed)
    .filter((b) => {
      const distanceMiles = (b.distance ?? 0) / 1609.34
      return distanceMiles <= params.radiusMiles * 1.1
    })
    .map((b): Omit<Lead, 'leadScore' | 'status' | 'notes'> | null => {
      const key = `${b.name.toLowerCase()}|${b.location.address1?.toLowerCase() ?? ''}`
      if (seen.has(key)) return null
      seen.add(key)

      const distanceMiles = (b.distance ?? 0) / 1609.34
      const address = b.location.address1 ?? ''
      const city = b.location.city ?? geoCity
      const state = b.location.state ?? geoState
      const zipCode = b.location.zip_code ?? params.zipCode

      return {
        id: `yelp_${b.id}`,
        businessName: b.name,
        category: params.category,
        address,
        city,
        state,
        zipCode,
        phone: b.phone ? formatPhone(b.phone) : '',
        website: b.url ?? '',
        rating: b.rating ?? null,
        reviewCount: b.review_count ?? null,
        latitude: b.coordinates?.latitude ?? null,
        longitude: b.coordinates?.longitude ?? null,
        distanceMiles,
        createdAt: new Date().toISOString(),
        priceLevel: b.price ? b.price.length : null,
        facebookUrl: null,
        instagramUrl: null,
        linkedinUrl: null,
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
