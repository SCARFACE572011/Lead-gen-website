import type { SearchParams, Lead, SearchResult } from '@/types/lead'
import { resolveSearchLocation, effectiveRadiusMiles, effectiveRadiusMeters } from '@/lib/geocode'

// Simple text query map (more effective than category IDs for Here)
const CATEGORY_QUERY_HERE: Record<string, string> = {
  'Dentists': 'dentist dental',
  'Law Firms': 'law firm attorney',
  'Contractors': 'general contractor',
  'Auto Shops': 'auto repair mechanic',
  'Medical Clinics': 'medical clinic doctor',
  'Gyms & Fitness': 'gym fitness',
  'Hair & Beauty Salons': 'hair salon beauty',
  'Plumbers': 'plumber plumbing',
  'Electricians': 'electrician',
  'Landscaping': 'landscaping lawn',
  'HVAC Services': 'HVAC heating cooling',
  'Cleaning Services': 'cleaning service',
  'Roofing': 'roofing contractor',
  'Moving Companies': 'moving company',
  'Insurance Agents': 'insurance agency',
  'Accountants': 'accountant CPA',
  'Chiropractors': 'chiropractor',
  'Pet Services': 'pet grooming veterinary',
  'IT Services': 'IT services technology',
  'Financial Advisors': 'financial advisor',
  'Mortgage Brokers': 'mortgage broker',
  'Property Management': 'property management',
  'Tutoring Centers': 'tutoring learning center',
  'Childcare & Daycares': 'daycare childcare',
  'Yoga Studios': 'yoga studio',
  'Therapy & Counseling': 'therapy counseling',
  'Veterinarians': 'veterinarian animal hospital',
  'Optometrists': 'optometrist eye doctor',
  'Event Planners': 'event planning',
  'Pest Control': 'pest control exterminator',
  'Pool Services': 'pool service',
  'Solar Installers': 'solar installation',
  'Marketing Agencies': 'marketing agency',
  'Security Companies': 'security company',
  'Printing Services': 'printing service',
  'Catering': 'catering',
  'Photographers': 'photographer photography',
  'Restaurants': 'restaurant',
}

interface HerePlace {
  id: string
  title: string
  address: {
    label: string
    city?: string
    state?: string
    postalCode?: string
    street?: string
    houseNumber?: string
  }
  position: { lat: number; lng: number }
  distance: number
  contacts?: Array<{
    phone?: Array<{ value: string }>
    www?: Array<{ value: string }>
  }>
  openingHours?: Array<{ isOpen: boolean }>
  rating?: number
}

export async function searchLeadsHere(params: SearchParams): Promise<SearchResult> {
  const apiKey = process.env.HERE_API_KEY
  if (!apiKey) return { leads: [], total: 0 }

  const loc = params.resolved ?? (await resolveSearchLocation(params))
  const { lat, lon } = loc
  const radiusMeters = effectiveRadiusMeters(params)

  const isCustom = params.category === 'Custom Keyword'
  const q = isCustom && params.keyword
    ? params.keyword
    : (CATEGORY_QUERY_HERE[params.category] ?? params.category)

  const allPlaces: HerePlace[] = []
  // Here allows up to 100 per request; paginate up to 3 pages
  for (let offset = 0; offset < 300; offset += 100) {
    const urlParams = new URLSearchParams({
      at: `${lat},${lon}`,
      q,
      limit: '100',
      offset: String(offset),
      apiKey,
      in: `circle:${lat},${lon};r=${radiusMeters}`,
    })

    const res = await fetch(
      `https://discover.search.hereapi.com/v1/discover?${urlParams}`,
      { next: { revalidate: 0 } }
    )
    if (!res.ok) break

    const data = await res.json() as { items: HerePlace[] }
    if (!data.items?.length) break
    allPlaces.push(...data.items)
    if (data.items.length < 100) break
  }

  const leads: Lead[] = allPlaces
    .map((place): Lead => {
      const distanceMiles = (place.distance ?? 0) / 1609.34
      const phone = place.contacts?.[0]?.phone?.[0]?.value ?? ''
      const website = place.contacts?.[0]?.www?.[0]?.value ?? ''
      const openNow = place.openingHours?.[0]?.isOpen ?? undefined

      return {
        id: place.id,
        businessName: place.title,
        address: place.address.label ?? '',
        city: place.address.city ?? '',
        state: place.address.state ?? '',
        zipCode: place.address.postalCode ?? params.zipCode,
        phone,
        website,
        rating: place.rating ?? null,
        reviewCount: null,
        category: params.category,
        distanceMiles,
        openNow,
        businessHours: undefined,
        priceLevel: null,
        latitude: place.position.lat,
        longitude: place.position.lng,
        leadScore: Math.round(((place.rating ?? 3.5) / 5) * 100),
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
