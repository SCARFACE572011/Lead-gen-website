// Countries on the North American Numbering Plan, where the (XXX) XXX-XXXX
// display format is correct. Everywhere else, numbers are displayed exactly as
// the data provider returned them — US-style reformatting would mangle them.
const NANP_COUNTRIES = new Set(['US', 'CA', 'PR', 'VI', 'GU', 'AS', 'MP'])

/**
 * Normalizes a US/NANP phone string to (XXX) XXX-XXXX format.
 *
 * Pass the lead's country code when known: non-NANP numbers are returned
 * untouched (trimmed only), since e.g. an Indian 10-digit national number
 * would otherwise be reformatted as if it were a US number.
 *
 * With no countryCode (legacy callers), behavior is unchanged: 10-digit
 * numbers get US formatting, anything else passes through as-is.
 */
export function formatPhone(raw: string, countryCode?: string): string {
  if (!raw) return ''
  const cc = countryCode?.trim().toUpperCase()
  if (cc && !NANP_COUNTRIES.has(cc)) return raw.trim()

  const digits = raw.replace(/\D/g, '')
  // Strip leading country code (1)
  const local = digits.startsWith('1') && digits.length === 11 ? digits.slice(1) : digits
  if (local.length !== 10) return raw.trim() // return as-is if not 10 digits
  return `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`
}
