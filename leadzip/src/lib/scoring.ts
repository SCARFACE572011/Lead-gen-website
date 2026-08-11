import { Lead, SearchParams } from '@/types/lead'

/**
 * OPPORTUNITY SCORING MODEL — digital weakness = opportunity.
 *
 * LeadZipp sells to agencies whose product is *fixing* a business's online
 * presence (websites, reputation, marketing). So the highest-value lead is NOT
 * the thriving business with a polished site and hundreds of 5-star reviews —
 * it's the one with a GAP the agency can close. This scorer therefore rewards
 * signals of digital weakness, matching the marketing promise that "the
 * businesses that need you most (no website, few/low reviews) score highest."
 *
 * Signal weights (higher = bigger opportunity):
 *   - No website ............. dominant positive signal (the core pitch)
 *   - Thin review footprint .. few/no reviews = under-invested online
 *   - Low/middling rating .... a fixable reputation problem
 *   - Reachability & locality  phone + proximity keep the lead actionable
 * Established, thriving businesses (big site presence, many reviews, top
 * ratings) accumulate little from the opportunity signals and fall to the
 * bottom of the list — exactly where an agency wants them.
 */
export function calculateLeadScore(lead: Partial<Lead>, params?: Partial<SearchParams>): number {
  let score = 0

  // Reachable by phone (+15) — you can actually pitch them today.
  if (lead.phone && lead.phone.trim().length > 6) score += 15

  // WEBSITE — the dominant opportunity signal. No website = the strongest
  // "needs you" flag an agency can find, so it earns the biggest single boost.
  if (!lead.website || lead.website.trim() === '') {
    score += 35 // No website = prime opportunity for a web-design/marketing pitch
  } else {
    score += 5 // Already has a site — still reachable, but far less to sell
  }

  // REVIEW FOOTPRINT (inverted vs. a "quality" score): a thin review presence
  // signals a business that hasn't invested online yet — the easiest yes. Many
  // reviews mean an established operation that needs little, so it adds almost
  // nothing. A missing count is treated as thin (opportunity), not neutral.
  const reviews = lead.reviewCount ?? 0
  if (reviews < 5) score += 20 // barely any footprint = wide-open opportunity
  else if (reviews < 15) score += 15
  else if (reviews < 40) score += 10
  else if (reviews < 100) score += 5
  else score += 2 // established — needs the least help

  // RATING as reputation gap: a low/middling rating is a fixable reputation
  // problem (they need help); a stellar rating means they're already thriving.
  // Missing rating is neutral opportunity. Guard the very bottom so 1-star
  // spam / defunct listings don't rocket to the top of the list.
  if (!lead.rating) {
    score += 10 // no/unknown rating — neutral opportunity
  } else if (lead.rating < 2.0) {
    score += 5 // likely spam or defunct — not a real opportunity
  } else if (lead.rating < 3.0) {
    score += 18 // clear reputation problem — needs help most
  } else if (lead.rating < 3.8) {
    score += 15 // middling reputation — strong opportunity
  } else if (lead.rating < 4.4) {
    score += 8 // solid but improvable
  } else {
    score += 3 // thriving reputation — needs the least help
  }

  // Within close radius (+12) — local territory is easier to work.
  if (lead.distanceMiles !== null && lead.distanceMiles !== undefined) {
    if (lead.distanceMiles <= 5) score += 12
    else if (lead.distanceMiles <= 10) score += 9
    else if (lead.distanceMiles <= 25) score += 5
    else score += 2
  }

  // Category match (+10) — honors the SearchParams-driven adjustment.
  if (params?.category && lead.category) {
    if (lead.category.toLowerCase().includes(params.category.toLowerCase())) {
      score += 10
    }
  }

  return Math.min(100, Math.max(0, score))
}

export function getScoreLabel(score: number): { label: string; color: string; bg: string } {
  // "Hot" now maps to genuine opportunity (digital weakness), not to a
  // thriving business. A no-website lead with a thin/weak reputation clears
  // the Hot bar; polished, established businesses land in Low Priority.
  if (score >= 80) return { label: 'Hot Lead', color: 'text-red-700', bg: 'bg-red-100' }
  if (score >= 50) return { label: 'Warm Lead', color: 'text-orange-700', bg: 'bg-orange-100' }
  return { label: 'Low Priority', color: 'text-slate-600', bg: 'bg-slate-100' }
}
