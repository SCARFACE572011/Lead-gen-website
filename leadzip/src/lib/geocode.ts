const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'
const USER_AGENT = 'LeadZipp/1.0 (+https://leadzipp.com)'

// State abbreviation → primary area code for unknown ZIPs
const STATE_AREA_CODES: Record<string, string> = {
  AL: '205', AK: '907', AZ: '602', AR: '501', CA: '213',
  CO: '303', CT: '203', DE: '302', FL: '305', GA: '404',
  HI: '808', ID: '208', IL: '312', IN: '317', IA: '515',
  KS: '316', KY: '502', LA: '504', ME: '207', MD: '410',
  MA: '617', MI: '313', MN: '612', MS: '601', MO: '314',
  MT: '406', NE: '402', NV: '702', NH: '603', NJ: '201',
  NM: '505', NY: '212', NC: '704', ND: '701', OH: '216',
  OK: '405', OR: '503', PA: '215', RI: '401', SC: '803',
  SD: '605', TN: '615', TX: '214', UT: '801', VT: '802',
  VA: '804', WA: '206', WV: '304', WI: '414', WY: '307',
  DC: '202',
}

export interface GeocodedZip {
  lat: number
  lon: number
  city: string
  state: string
  stateAbbr: string
  areaCode: string
}

interface NominatimResult {
  lat: string
  lon: string
  address?: {
    city?: string
    town?: string
    village?: string
    county?: string
    suburb?: string
    state?: string
    postcode?: string
  }
}

export async function geocodeZip(zipCode: string): Promise<GeocodedZip> {
  const url = `${NOMINATIM_URL}?postalcode=${encodeURIComponent(zipCode)}&country=US&format=json&limit=1&addressdetails=1`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 5000) // 5s max — never block the search pipeline
  let res: Response
  try {
    res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en' },
      signal: controller.signal,
      next: { revalidate: 86400 },
    })
  } finally {
    clearTimeout(timer)
  }
  if (!res.ok) throw new Error(`Nominatim ${res.status}`)
  const data = (await res.json()) as NominatimResult[]
  if (!data.length) throw new Error(`ZIP ${zipCode} not found`)

  const { lat, lon, address } = data[0]
  const stateAbbr = stateNameToAbbr(address?.state ?? '')
  const city =
    address?.city ??
    address?.town ??
    address?.suburb ??
    address?.village ??
    address?.county ??
    ''

  return {
    lat: parseFloat(lat),
    lon: parseFloat(lon),
    city,
    state: address?.state ?? '',
    stateAbbr,
    areaCode: STATE_AREA_CODES[stateAbbr] ?? '555',
  }
}

// Common US state names → two-letter abbreviations
const STATE_NAME_MAP: Record<string, string> = {
  'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR',
  'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE',
  'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID',
  'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS',
  'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
  'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS',
  'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV',
  'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
  'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK',
  'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
  'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT',
  'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV',
  'Wisconsin': 'WI', 'Wyoming': 'WY', 'District of Columbia': 'DC',
}

function stateNameToAbbr(name: string): string {
  if (!name) return ''
  if (name.length === 2) return name.toUpperCase()
  return STATE_NAME_MAP[name] ?? ''
}
