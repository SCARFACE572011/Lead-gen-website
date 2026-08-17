/**
 * LeadZipp's public product allowances.
 *
 * Keep this file safe to import from both browser and server code. Enforcement
 * still belongs on the server/database; these values also power honest pricing
 * and usage UI so the product never says "unlimited" while a hidden cap exists.
 *
 * A "live search" is a cache miss that reaches the data-provider path. Opening
 * cached results and refining an existing result set do not consume allowance.
 */
export type ProductPlan = 'free' | 'pro' | 'agency'

export interface PlanPolicy {
  liveSearchesPerMonth: number
  /** Smaller first-period allowance while Stripe status is trialing. */
  trialLiveSearches: number
  liveSearchesPerDay: number
  savedLeads: number
  exportRows: number | null
  bulkZipLimit: number
  includedEmailCredits: number
  apiRequestsPerDay: number
  teamSeats: number
  savedSearches: number
  activeAlerts: number
  crmConnections: number
}

export const PLAN_POLICY: Record<ProductPlan, PlanPolicy> = {
  free: {
    liveSearchesPerMonth: 25,
    trialLiveSearches: 25,
    liveSearchesPerDay: 25,
    savedLeads: 25,
    exportRows: 25,
    bulkZipLimit: 1,
    // A one-time starter balance, not a monthly grant.
    includedEmailCredits: 5,
    apiRequestsPerDay: 0,
    teamSeats: 1,
    savedSearches: 3,
    activeAlerts: 0,
    crmConnections: 0,
  },
  pro: {
    liveSearchesPerMonth: 100,
    trialLiveSearches: 25,
    liveSearchesPerDay: 50,
    savedLeads: 1_000,
    exportRows: null,
    bulkZipLimit: 10,
    includedEmailCredits: 100,
    apiRequestsPerDay: 0,
    teamSeats: 1,
    savedSearches: 25,
    activeAlerts: 10,
    crmConnections: 1,
  },
  agency: {
    // Shared by an Agency workspace. This is intentionally generous while
    // still bounding upstream Places/geocoding spend.
    liveSearchesPerMonth: 300,
    trialLiveSearches: 75,
    liveSearchesPerDay: 150,
    savedLeads: 10_000,
    exportRows: null,
    bulkZipLimit: 25,
    includedEmailCredits: 500,
    apiRequestsPerDay: 500,
    teamSeats: 5,
    savedSearches: 100,
    activeAlerts: 50,
    crmConnections: 3,
  },
}

export function normalizeProductPlan(value: unknown): ProductPlan {
  return value === 'pro' || value === 'agency' ? value : 'free'
}

/** Platform owners keep product access without being constrained by billing. */
export function effectiveProductPlan(rawPlan: unknown, rawRole: unknown = 'user'): ProductPlan {
  return rawRole === 'admin' ? 'agency' : normalizeProductPlan(rawPlan)
}

export function getPlanPolicy(rawPlan: unknown, rawRole: unknown = 'user'): PlanPolicy {
  return PLAN_POLICY[effectiveProductPlan(rawPlan, rawRole)]
}

export function formatAllowance(value: number | null): string {
  return value === null ? 'Full' : value.toLocaleString('en-US')
}
