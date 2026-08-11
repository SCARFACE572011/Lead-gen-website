import { Lead, SearchParams, SearchResult } from '@/types/lead'
import { calculateLeadScore } from '@/lib/scoring'
import { searchLeadsDynamic } from './dynamicProvider'
import { geocodeZip } from '@/lib/geocode'
import { formatPhone } from '@/lib/phoneFormatter'

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'
const USER_AGENT = 'LeadZip/1.0 (+https://leadzip.vercel.app)'

// OSM tag expressions per category
const OSM_CATEGORY_TAGS: Record<string, string[]> = {
  'Restaurants': ['amenity=restaurant', 'amenity=cafe', 'amenity=fast_food', 'amenity=bar'],
  'Dentists': ['healthcare=dentist', 'amenity=dentist'],
  'Law Firms': ['office=lawyer', 'office=legal'],
  'Contractors': ['craft=builder', 'craft=construction', 'office=construction_company'],
  'Auto Shops': ['shop=car_repair', 'shop=tyres', 'shop=car_parts'],
  'Real Estate Agents': ['office=estate_agent', 'office=real_estate_agent'],
  'Medical Clinics': ['amenity=clinic', 'amenity=doctors', 'healthcare=clinic', 'healthcare=doctor'],
  'Gyms & Fitness': ['leisure=fitness_centre', 'leisure=sports_centre', 'shop=sports'],
  'Hair & Beauty Salons': ['shop=hairdresser', 'shop=beauty', 'shop=cosmetics'],
  'Manufacturers': ['industrial=factory', 'craft=fabricator'],
  'Distributors': ['industrial=warehouse', 'office=wholesale'],
  'Plumbers': ['craft=plumber'],
  'Electricians': ['craft=electrician'],
  'Landscaping': ['craft=gardener', 'shop=garden_centre'],
  'HVAC Services': ['craft=hvac', 'craft=heating_cooling'],
  'Cleaning Services': ['shop=cleaning', 'office=cleaning'],
  'Photographers': ['shop=photographer', 'office=photographer'],
  'Catering': ['shop=catering', 'amenity=catering'],
  'Pet Services': ['shop=pet', 'shop=veterinary', 'amenity=veterinary', 'craft=pet_grooming'],
  'Roofing': ['craft=roofer'],
  'Moving Companies': ['shop=moving', 'office=moving'],
  'Insurance Agents': ['office=insurance'],
  'Accountants': ['office=accountant', 'office=tax_advisor'],
  'Chiropractors': ['healthcare=alternative', 'amenity=chiropractor'],
  'IT Services': ['office=it', 'shop=computer'],
  'Financial Advisors': ['office=financial_advisor', 'office=financial'],
  'Mortgage Brokers': ['office=mortgage', 'office=financial'],
  'Property Management': ['office=property_management'],
  'Tutoring Centers': ['amenity=tutoring', 'office=tutoring', 'amenity=language_school'],
  'Childcare & Daycares': ['amenity=childcare', 'amenity=kindergarten'],
  'Yoga Studios': ['shop=yoga', 'leisure=yoga'],
  'Therapy & Counseling': ['healthcare=psychotherapist', 'healthcare=counselling', 'office=therapist'],
  'Veterinarians': ['amenity=veterinary'],
  'Optometrists': ['healthcare=optometrist', 'shop=optician'],
  'Pharmacies': ['amenity=pharmacy', 'healthcare=pharmacy'],
  'Event Planners': ['office=event_management'],
  'Printing Services': ['shop=copyshop', 'craft=printer', 'shop=printing'],
  'Security Companies': ['office=security', 'shop=security'],
  'Pest Control': ['craft=pest_control', 'shop=pest_control'],
  'Pool Services': ['shop=swimming_pool'],
  'Solar Installers': ['craft=solar_installer', 'shop=energy', 'shop=solar'],
  'Marketing Agencies': ['office=advertising_agency', 'office=marketing'],
}

interface OsmTags {
  name?: string
  'addr:housenumber'?: string
  'addr:street'?: string
  'addr:city'?: string
  'addr:state'?: string
  'addr:postcode'?: string
  phone?: string
  'contact:phone'?: string
  website?: string
  'contact:website'?: string
  opening_hours?: string
  [key: string]: string | undefined
}

interface OsmElement {
  type: 'node' | 'way' | 'relation'
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: OsmTags
}

interface OverpassResponse {
  elements: OsmElement[]
}



function buildOverpassQuery(
  tags: string[],
  lat: number,
  lon: number,
  radiusM: number
): string {
  const parts = tags.flatMap((tag) => {
    const eqIdx = tag.indexOf('=')
    const key = tag.slice(0, eqIdx)
    const val = tag.slice(eqIdx + 1)
    return [
      `node["${key}"="${val}"](around:${radiusM},${lat},${lon});`,
      `way["${key}"="${val}"](around:${radiusM},${lat},${lon});`,
      `relation["${key}"="${val}"](around:${radiusM},${lat},${lon});`,
    ]
  })
  return `[out:json][timeout:25][maxsize:1048576];\n(\n  ${parts.join('\n  ')}\n);\nout center tags qt;`
}

function buildKeywordQuery(
  keyword: string,
  lat: number,
  lon: number,
  radiusM: number
): string {
  // Sanitize keyword for Overpass regex
  const safe = keyword.replace(/[^a-zA-Z0-9 &'-]/g, '').trim()
  if (!safe) return buildOverpassQuery(['amenity=restaurant'], lat, lon, radiusM)
  return `[out:json][timeout:25][maxsize:1048576];\n(\n  node["name"~"${safe}",i](around:${radiusM},${lat},${lon});\n  way["name"~"${safe}",i](around:${radiusM},${lat},${lon});\n  relation["name"~"${safe}",i](around:${radiusM},${lat},${lon});\n);\nout center tags qt;`
}

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

function osmElementToPartialLead(
  el: OsmElement,
  category: string,
  centerLat: number,
  centerLon: number,
  fallbackCity: string,
  fallbackState: string,
  searchZip: string
): Omit<Lead, 'leadScore' | 'status' | 'notes'> | null {
  const tags = el.tags ?? {}
  const name = tags.name
  if (!name) return null

  const elLat = el.type === 'node' ? el.lat : el.center?.lat
  const elLon = el.type === 'node' ? el.lon : el.center?.lon
  if (elLat == null || elLon == null) return null

  const houseNum = tags['addr:housenumber'] ?? ''
  const street = tags['addr:street'] ?? ''
  const address = [houseNum, street].filter(Boolean).join(' ')

  const phone = tags.phone ?? tags['contact:phone'] ?? ''
  const website = tags.website ?? tags['contact:website'] ?? ''

  return {
    id: `osm_${el.type}_${el.id}`,
    businessName: name,
    category,
    address,
    city: tags['addr:city'] ?? fallbackCity,
    state: tags['addr:state'] ?? fallbackState,
    zipCode: tags['addr:postcode'] ?? searchZip,
    phone: formatPhone(phone),
    website,
    rating: null,
    reviewCount: null,
    latitude: elLat,
    longitude: elLon,
    distanceMiles: haversineDistanceMiles(centerLat, centerLon, elLat, elLon),
    createdAt: new Date().toISOString(),
  }
}

export async function searchLeadsOSM(params: SearchParams): Promise<SearchResult> {
  try {
    const { lat, lon, city: geoCity, state: geoState } = await geocodeZip(params.zipCode)
    const radiusM = Math.round(params.radiusMiles * 1609.34)

    let query: string
    if (params.category === 'Custom Keyword' && params.keyword) {
      query = buildKeywordQuery(params.keyword, lat, lon, radiusM)
    } else {
      const tags = OSM_CATEGORY_TAGS[params.category]
      if (!tags || tags.length === 0) {
        console.warn(`[osmProvider] No OSM tags for category "${params.category}", falling back to mock`)
        return searchLeadsDynamic(params)
      }
      query = buildOverpassQuery(tags, lat, lon, radiusM)
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 20000)
    let overpassRes: Response
    try {
      overpassRes = await fetch(OVERPASS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': USER_AGENT,
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timer)
    }

    if (!overpassRes.ok) {
      throw new Error(`Overpass API returned ${overpassRes.status}`)
    }

    const overpassData = (await overpassRes.json()) as OverpassResponse
    const elements = overpassData.elements ?? []

    const partialLeads = elements
      .map((el) =>
        osmElementToPartialLead(el, params.category, lat, lon, geoCity, geoState, params.zipCode)
      )
      .filter((l): l is NonNullable<typeof l> => l !== null)

    // Deduplicate by name + address
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

    // Apply filters (skip minRating — OSM has no ratings)
    if (params.hasWebsite === true) {
      leads = leads.filter((l) => !!l.website)
    }
    if (params.hasPhone === true) {
      leads = leads.filter((l) => !!l.phone)
    }
    if (params.keyword && params.category !== 'Custom Keyword') {
      const kw = params.keyword.toLowerCase()
      leads = leads.filter(
        (l) =>
          l.businessName.toLowerCase().includes(kw) ||
          l.address.toLowerCase().includes(kw) ||
          l.category.toLowerCase().includes(kw)
      )
    }

    leads = leads.filter((l) => (l.distanceMiles ?? 0) <= params.radiusMiles)

    leads.sort((a, b) => b.leadScore - a.leadScore)

    // Sparse area: fall back to dynamic provider for region-appropriate results
    if (leads.length === 0) {
      console.warn('[osmProvider] 0 real results from Overpass, falling back to dynamic provider')
      return searchLeadsDynamic(params)
    }

    return { leads, total: leads.length, center: { lat, lon }, source: 'osm' }
  } catch (err) {
    console.error('[osmProvider] Error, falling back to dynamic provider:', err)
    return searchLeadsDynamic(params)
  }
}
