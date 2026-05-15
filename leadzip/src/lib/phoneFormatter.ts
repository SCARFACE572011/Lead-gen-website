/**
 * Normalizes any US phone string to (XXX) XXX-XXXX format.
 * Returns empty string if not a valid 10-digit US number.
 */
export function formatPhone(raw: string): string {
  if (!raw) return ''
  const digits = raw.replace(/\D/g, '')
  // Strip leading country code (1)
  const local = digits.startsWith('1') && digits.length === 11 ? digits.slice(1) : digits
  if (local.length !== 10) return raw.trim() // return as-is if not 10 digits
  return `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`
}
