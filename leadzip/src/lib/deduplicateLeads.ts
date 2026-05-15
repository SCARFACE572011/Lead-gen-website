import type { Lead } from '@/types/lead'

/**
 * Marks leads in `current` that already exist in `saved` by setting status to 'contacted'.
 * Matching is by businessName + zipCode (case-insensitive).
 */
export function markDuplicates(current: Lead[], saved: Lead[]): Lead[] {
  if (!saved.length) return current
  const savedKeys = new Set(
    saved.map((l) => `${l.businessName.toLowerCase().trim()}|${l.zipCode}`)
  )
  return current.map((lead) => {
    const key = `${lead.businessName.toLowerCase().trim()}|${lead.zipCode}`
    if (savedKeys.has(key)) {
      return { ...lead, status: 'contacted' as const }
    }
    return lead
  })
}
