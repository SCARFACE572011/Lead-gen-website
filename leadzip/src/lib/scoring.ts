import { Lead, SearchParams } from '@/types/lead'

export function calculateLeadScore(lead: Partial<Lead>, params?: Partial<SearchParams>): number {
  let score = 0

  // Has phone number (+20)
  if (lead.phone && lead.phone.trim().length > 6) score += 20

  // Has website (+10 if has one, but WEAK presence = BETTER opportunity)
  if (!lead.website || lead.website.trim() === '') {
    score += 25 // No website = prime opportunity for web design pitch
  } else {
    score += 5
  }

  // Rating quality (+15 max)
  if (lead.rating) {
    if (lead.rating >= 4.5) score += 15
    else if (lead.rating >= 4.0) score += 12
    else if (lead.rating >= 3.5) score += 8
    else score += 3
  }

  // Review count signals established business (+15 max)
  if (lead.reviewCount) {
    if (lead.reviewCount >= 100) score += 15
    else if (lead.reviewCount >= 50) score += 10
    else if (lead.reviewCount >= 10) score += 6
    else score += 2
  }

  // Within close radius (+15)
  if (lead.distanceMiles !== null && lead.distanceMiles !== undefined) {
    if (lead.distanceMiles <= 5) score += 15
    else if (lead.distanceMiles <= 10) score += 12
    else if (lead.distanceMiles <= 25) score += 8
    else score += 3
  }

  // Category match (+10)
  if (params?.category && lead.category) {
    if (lead.category.toLowerCase().includes(params.category.toLowerCase())) {
      score += 10
    }
  }

  return Math.min(100, Math.max(0, score))
}

export function getScoreLabel(score: number): { label: string; color: string; bg: string } {
  if (score >= 80) return { label: 'Hot Lead', color: 'text-red-700', bg: 'bg-red-100' }
  if (score >= 50) return { label: 'Warm Lead', color: 'text-orange-700', bg: 'bg-orange-100' }
  return { label: 'Low Priority', color: 'text-slate-600', bg: 'bg-slate-100' }
}
