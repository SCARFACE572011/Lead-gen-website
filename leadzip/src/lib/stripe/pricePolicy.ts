export type PaidStripePlan = 'pro' | 'agency'

export interface SubscriptionPriceMapping {
  proMonthly?: string
  proAnnual?: string
  agencyMonthly?: string
  agencyAnnual?: string
}

/**
 * Resolve a paid plan from a server-owned Stripe Price catalog. Unknown,
 * placeholder and duplicate mappings fail closed.
 */
export function mapPaidPlanFromPriceId(
  priceId: string,
  mapping: SubscriptionPriceMapping
): PaidStripePlan | null {
  const candidates: Array<{ plan: PaidStripePlan; priceId: string | undefined }> = [
    { plan: 'pro', priceId: mapping.proMonthly },
    { plan: 'pro', priceId: mapping.proAnnual },
    { plan: 'agency', priceId: mapping.agencyMonthly },
    { plan: 'agency', priceId: mapping.agencyAnnual },
  ]
  const matches = candidates.filter(
    (candidate) =>
      candidate.priceId?.startsWith('price_') &&
      !candidate.priceId.includes('placeholder') &&
      candidate.priceId === priceId
  )
  return matches.length === 1 ? matches[0].plan : null
}
