import type { SearchParams, Lead, SearchResult } from '@/types/lead'
import { resolveSearchLocation, effectiveRadiusMiles, effectiveRadiusMeters } from '@/lib/geocode'

const TOMTOM_QUERY_MAP: Record<string, string> = {
  'Dentists': 'dentist',
  'Law Firms': 'law firm',
  'Contractors': 'general contractor',
  'Auto Shops': 'auto repair',
  'Medical Clinics': 'medical clinic',
  'Gyms & Fitness': 'gym',
  'Hair & Beauty Salons': 'hair salon',
  'Plumbers': 'plumber',
  'Electricians': 'electrician',
  'Landscaping': 'landscaping',
  'HVAC Services': 'HVAC',
  'Cleaning Services': 'cleaning service',
  'Roofing': 'roofing',
  'Moving Companies': 'moving company',
  'Insurance Agents': 'insurance',
  'Accountants': 'accountant',
  'Chiropractors': 'chiropractor',
  'Pet Services': 'pet services',
  'IT Services': 'IT services',
  'Financial Advisors': 'financial advisor',
  'Mortgage Brokers': 'mortgage broker',
  'Property Management': 'property management',
  'Tutoring Centers': 'tutoring',
  'Childcare & Daycares': 'daycare',
  'Yoga Studios': 'yoga',
  'Therapy & Counseling': 'therapist',
  'Veterinarians': 'veterinarian',
  'Optometrists': 'optometrist',
  'Event Planners': 'event planner',
  'Pest Control': 'pest control',
  'Pool Services': 'pool service',
  'Solar Installers': 'solar',
  'Marketing Agencies': 'marketing agency',
  'Security Companies': 'security',
  'Printing Services': 'printing',
  'Catering': 'catering',
  'Photographers': 'photographer',
  'Restaurants': 'restaurant',
}

interface TomTomResult {
  id: string
  poi?: {
    name: string
    phone?: string
    url?: string
  }
  address: {
    freeformAddress: string
    municipality?: string
    countrySubdivision?: string
    postalCode?: string
  }
  position: { lat: number; lon: number }
  dist: number
}

export async function searchLeadsTomTom(params: SearchParams): Promise<SearchResult> {
  const apiKey = process.env.TOMTOM_API_KEY
  if (!apiKey) return { leads: [], total: 0 }

  const loc = params.resolved ?? (await resolveSearchLocation(params))
  const { lat, lon } = loc
  const radiusMeters = effectiveRadiusMeters(params)

  const isCustom = params.category === 'Custom Keyword'
  const query = encodeURIComponent(
    isCustom && params.keyword
      ? params.keyword
      : (TOMTOM_QUERY_MAP[params.category] ?? params.category)
  )

  const allResults: TomTomResult[] = []
  const pageSize = 100

  for (let offset = 0; offset < 300; offset += pageSize) {
    const urlParams = new URLSearchParams({
      key: apiKey,
      lat: String(lat),
      lon: String(lon),
      radius: String(radiusMeters),
      limit: String(pageSize),
      offset: String(offset),
      language: 'en-US',
    })

    const res = await fetch(
      `https://api.tomtom.com/search/2/poiSearch/${query}.json?${urlParams}`,
      { next: { revalidate: 0 } }
    )
    if (!res.ok) break

    const data = await res.json() as { results: TomTomResult[]; summary: { totalResults: number } }
    if (!data.results?.length) break
    allResults.push(...data.results)
    if (allResults.length >= (data.summary?.totalResults ?? 0)) break
  }

  const leads: Lead[] = allResults
    .map((r): Lead => {
      const distanceMiles = (r.dist ?? 0) / 1609.34
      return {
        id: r.id,
        businessName: r.poi?.name ?? 'Unknown',
        address: r.address.freeformAddress ?? '',
        city: r.address.municipality ?? '',
        state: r.address.countrySubdivision ?? '',
        zipCode: r.address.postalCode ?? params.zipCode,
        // Country the search resolved to. Carried so a postal-code-only lookup
        // later (competitor analysis) does not read a non-US postcode as a ZIP.
        countryCode: loc.countryCode || undefined,
        phone: r.poi?.phone ?? '',
        website: r.poi?.url ?? '',
        rating: null,
        reviewCount: null,
        category: params.category,
        distanceMiles,
        latitude: r.position.lat,
        longitude: r.position.lon,
        leadScore: 50,
        status: 'new' as const,
        notes: '',
        createdAt: new Date().toISOString(),
        facebookUrl: null,
        instagramUrl: null,
        linkedinUrl: null,
      }
    })
    .filter(l => (l.distanceMiles ?? 0) <= effectiveRadiusMiles(params) * 1.1)

  return { leads, total: leads.length, center: { lat, lon } }
}
