// Country data for the worldwide lead search country selector.
// Names come from Intl.DisplayNames (available in all modern browsers and
// Node 18+), so we only ship the ISO 3166-1 alpha-2 codes.

export interface Country {
  code: string
  name: string
}

/** Shown at the top of the dropdown, in this order. */
export const POPULAR_COUNTRY_CODES = [
  'US', 'CA', 'GB', 'AU', 'DE', 'FR', 'NL', 'ES', 'AE', 'SA', 'IN',
] as const

// Full ISO 3166-1 alpha-2 assigned country/territory codes.
const ISO_COUNTRY_CODES = [
  'AD', 'AE', 'AF', 'AG', 'AI', 'AL', 'AM', 'AO', 'AR', 'AT', 'AU', 'AW', 'AZ',
  'BA', 'BB', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ', 'BM', 'BN', 'BO', 'BR',
  'BS', 'BT', 'BW', 'BY', 'BZ', 'CA', 'CD', 'CF', 'CG', 'CH', 'CI', 'CK', 'CL',
  'CM', 'CN', 'CO', 'CR', 'CU', 'CV', 'CW', 'CY', 'CZ', 'DE', 'DJ', 'DK', 'DM',
  'DO', 'DZ', 'EC', 'EE', 'EG', 'ER', 'ES', 'ET', 'FI', 'FJ', 'FK', 'FM', 'FO',
  'FR', 'GA', 'GB', 'GD', 'GE', 'GF', 'GG', 'GH', 'GI', 'GL', 'GM', 'GN', 'GP',
  'GQ', 'GR', 'GT', 'GU', 'GW', 'GY', 'HK', 'HN', 'HR', 'HT', 'HU', 'ID', 'IE',
  'IL', 'IM', 'IN', 'IQ', 'IR', 'IS', 'IT', 'JE', 'JM', 'JO', 'JP', 'KE', 'KG',
  'KH', 'KI', 'KM', 'KN', 'KR', 'KW', 'KY', 'KZ', 'LA', 'LB', 'LC', 'LI', 'LK',
  'LR', 'LS', 'LT', 'LU', 'LV', 'LY', 'MA', 'MC', 'MD', 'ME', 'MG', 'MH', 'MK',
  'ML', 'MM', 'MN', 'MO', 'MQ', 'MR', 'MS', 'MT', 'MU', 'MV', 'MW', 'MX', 'MY',
  'MZ', 'NA', 'NC', 'NE', 'NG', 'NI', 'NL', 'NO', 'NP', 'NR', 'NZ', 'OM', 'PA',
  'PE', 'PF', 'PG', 'PH', 'PK', 'PL', 'PR', 'PS', 'PT', 'PW', 'PY', 'QA', 'RE',
  'RO', 'RS', 'RU', 'RW', 'SA', 'SB', 'SC', 'SD', 'SE', 'SG', 'SI', 'SK', 'SL',
  'SM', 'SN', 'SO', 'SR', 'SS', 'ST', 'SV', 'SX', 'SY', 'SZ', 'TC', 'TD', 'TG',
  'TH', 'TJ', 'TL', 'TM', 'TN', 'TO', 'TR', 'TT', 'TV', 'TW', 'TZ', 'UA', 'UG',
  'US', 'UY', 'UZ', 'VC', 'VE', 'VG', 'VI', 'VN', 'VU', 'WS', 'YE', 'ZA', 'ZM',
  'ZW',
]

// Search aliases so common shorthand finds the right country.
const COUNTRY_ALIASES: Record<string, string[]> = {
  GB: ['uk', 'britain', 'england', 'scotland', 'wales'],
  AE: ['uae', 'emirates', 'dubai'],
  US: ['usa', 'america', 'united states of america'],
  KR: ['south korea'],
  CZ: ['czech republic'],
  NL: ['holland'],
  CD: ['drc', 'congo'],
}

let displayNames: Intl.DisplayNames | null | undefined
function regionName(code: string): string {
  if (displayNames === undefined) {
    try {
      displayNames = new Intl.DisplayNames(['en'], { type: 'region' })
    } catch {
      displayNames = null
    }
  }
  try {
    return displayNames?.of(code) ?? code
  } catch {
    return code
  }
}

/** All countries, alphabetical by English name. */
export const COUNTRIES: Country[] = ISO_COUNTRY_CODES
  .map((code) => ({ code, name: regionName(code) }))
  .sort((a, b) => a.name.localeCompare(b.name))

/** Popular countries in pinned order, for the top of the dropdown. */
export const POPULAR_COUNTRIES: Country[] = POPULAR_COUNTRY_CODES.map((code) => ({
  code,
  name: regionName(code),
}))

export function countryName(code: string): string {
  return regionName(code.toUpperCase())
}

/** Case-insensitive match on code, name, or alias — powers the dropdown search. */
export function matchesCountry(country: Country, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  if (country.code.toLowerCase().includes(q)) return true
  if (country.name.toLowerCase().includes(q)) return true
  return (COUNTRY_ALIASES[country.code] ?? []).some((a) => a.includes(q))
}
