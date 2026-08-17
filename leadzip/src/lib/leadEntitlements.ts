import {
  PLAN_POLICY,
  effectiveProductPlan,
  normalizeProductPlan,
  type ProductPlan,
} from '@/lib/planPolicy'

export type LeadPlan = ProductPlan
export type AccountRole = 'user' | 'admin'

/**
 * Lead storage/export policy used by both route handlers and client UI.
 *
 * Keep this aligned with the public pricing page:
 * - Free: 25 saved leads and the first 25 CSV rows
 * - Pro: 1,000 saved leads, bulk save, and full export
 * - Agency: 10,000 saved leads, bulk save, and full export
 *
 * `null` means no product-plan ceiling. Request-size/rate limits still apply.
 */
export interface LeadEntitlements {
  plan: LeadPlan
  canBulkSave: boolean
  canExportAll: boolean
  maxSavedLeads: number | null
  maxExportRows: number | null
}
export const FREE_SAVED_LEADS_LIMIT = PLAN_POLICY.free.savedLeads
export const PRO_SAVED_LEADS_LIMIT = PLAN_POLICY.pro.savedLeads
export const AGENCY_SAVED_LEADS_LIMIT = PLAN_POLICY.agency.savedLeads
export const FREE_EXPORT_ROWS_LIMIT = PLAN_POLICY.free.exportRows!

/** One API request. The client deliberately sends smaller sequential chunks. */
export const MAX_BULK_SAVE_REQUEST = 250
export const BULK_SAVE_CLIENT_BATCH_SIZE = 200

/** Large enough for a 25-ZIP Agency result set, bounded for CSV CPU/memory use. */
export const MAX_EXPORT_REQUEST = 2_000

export function normalizeLeadPlan(value: unknown): LeadPlan {
  return normalizeProductPlan(value)
}

export function getLeadEntitlements(
  rawPlan: unknown,
  rawRole: unknown = 'user'
): LeadEntitlements {
  // The owner/admin account retains full product access independently of its
  // billing row. Role assignment itself is protected server-side elsewhere.
  const plan = effectiveProductPlan(rawPlan, rawRole)

  if (rawRole === 'admin') {
    return {
      plan,
      canBulkSave: true,
      canExportAll: true,
      maxSavedLeads: null,
      maxExportRows: null,
    }
  }

  if (plan === 'agency') {
    return {
      plan,
      canBulkSave: true,
      canExportAll: true,
      maxSavedLeads: AGENCY_SAVED_LEADS_LIMIT,
      maxExportRows: null,
    }
  }

  if (plan === 'pro') {
    return {
      plan,
      canBulkSave: true,
      canExportAll: true,
      maxSavedLeads: PRO_SAVED_LEADS_LIMIT,
      maxExportRows: null,
    }
  }

  return {
    plan,
    canBulkSave: false,
    canExportAll: false,
    maxSavedLeads: FREE_SAVED_LEADS_LIMIT,
    maxExportRows: FREE_EXPORT_ROWS_LIMIT,
  }
}
