export type LeadPlan = 'free' | 'pro' | 'agency'
export type AccountRole = 'user' | 'admin'

/**
 * Lead storage/export policy used by both route handlers and client UI.
 *
 * Keep this aligned with the public pricing page:
 * - Free: 25 saved leads and the first 25 CSV rows
 * - Pro: 1,000 saved leads, bulk save, and full export
 * - Agency: unlimited saved leads, bulk save, and full export
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
export const FREE_SAVED_LEADS_LIMIT = 25
export const PRO_SAVED_LEADS_LIMIT = 1_000
export const FREE_EXPORT_ROWS_LIMIT = 25

/** One API request. The client deliberately sends smaller sequential chunks. */
export const MAX_BULK_SAVE_REQUEST = 250
export const BULK_SAVE_CLIENT_BATCH_SIZE = 200

/** Large enough for a 25-ZIP Agency result set, bounded for CSV CPU/memory use. */
export const MAX_EXPORT_REQUEST = 2_000

export function normalizeLeadPlan(value: unknown): LeadPlan {
  return value === 'pro' || value === 'agency' ? value : 'free'
}

export function getLeadEntitlements(
  rawPlan: unknown,
  rawRole: unknown = 'user'
): LeadEntitlements {
  // The owner/admin account retains full product access independently of its
  // billing row. Role assignment itself is protected server-side elsewhere.
  const plan = rawRole === 'admin' ? 'agency' : normalizeLeadPlan(rawPlan)

  if (plan === 'agency') {
    return {
      plan,
      canBulkSave: true,
      canExportAll: true,
      maxSavedLeads: null,
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
