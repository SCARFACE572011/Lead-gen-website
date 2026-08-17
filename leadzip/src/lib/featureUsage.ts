import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Monthly fair-use allowances for signed-in features that create real upstream
 * cost. Keep these values in sync with reserve_feature_usage() in
 * supabase/migrations/20260817_feature_usage.sql.
 *
 * These limits are deliberately separate from short-window rate limiters:
 * rate limiters stop bursts, while this ledger bounds monthly cost even when a
 * customer spreads requests across devices or Agency workspace seats.
 */
export const FEATURE_MONTHLY_LIMITS = {
  ai_proposal: {
    label: 'AI proposal generations',
    free: 3,
    pro: 50,
    agency: 250,
  },
  market_gaps: {
    label: 'market gap analyses',
    free: 1,
    pro: 10,
    agency: 50,
  },
  competitors: {
    label: 'competitor analyses',
    free: 3,
    pro: 25,
    agency: 100,
  },
  audit_reports: {
    label: 'public audit reports',
    free: 3,
    pro: 25,
    agency: 100,
  },
  website_health: {
    label: 'website health checks',
    free: 10,
    pro: 250,
    agency: 1_000,
  },
} as const

export type MeteredFeature = keyof typeof FEATURE_MONTHLY_LIMITS
export type FeatureUsagePlan = 'free' | 'pro' | 'agency'

export interface FeatureUsageReservation {
  allowed: boolean
  feature: MeteredFeature
  reason: string | null
  plan: FeatureUsagePlan
  subjectUserId: string
  /** null only on a degraded reservation, where the real count is unknown. */
  used: number | null
  limit: number | null
  remaining: number | null
  resetAt: string
  upgradeRequired: boolean
  /**
   * True when the durable ledger could not answer because its migration is not
   * applied yet, so this reservation is the pre-ledger fallback. The counters on
   * a degraded reservation are placeholders and must never be shown to a
   * customer as their real usage.
   */
  degraded?: boolean
}

export type ReserveFeatureUsageResult =
  | { ok: true; usage: FeatureUsageReservation }
  | { ok: false; reason: 'unavailable' }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFeature(value: unknown): value is MeteredFeature {
  return typeof value === 'string' && Object.hasOwn(FEATURE_MONTHLY_LIMITS, value)
}

function nonNegativeInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null
}

/** Defensively validate the untyped JSON returned by the database RPC. */
export function parseFeatureUsageReservation(value: unknown): FeatureUsageReservation | null {
  if (!isRecord(value) || typeof value.allowed !== 'boolean' || !isFeature(value.feature)) {
    return null
  }

  const plan = value.plan
  const subjectUserId = value.subjectUserId
  const used = nonNegativeInteger(value.used)
  const limit = value.limit === null ? null : nonNegativeInteger(value.limit)
  const remaining = value.remaining === null ? null : nonNegativeInteger(value.remaining)
  const resetAt = value.resetAt

  if (
    (plan !== 'free' && plan !== 'pro' && plan !== 'agency') ||
    typeof subjectUserId !== 'string' ||
    subjectUserId.length === 0 ||
    used === null ||
    (value.limit !== null && limit === null) ||
    (value.remaining !== null && remaining === null) ||
    typeof resetAt !== 'string' ||
    Number.isNaN(Date.parse(resetAt)) ||
    typeof value.upgradeRequired !== 'boolean'
  ) {
    return null
  }

  return {
    allowed: value.allowed,
    feature: value.feature,
    reason: typeof value.reason === 'string' ? value.reason : null,
    plan,
    subjectUserId,
    used,
    limit,
    remaining,
    resetAt,
    upgradeRequired: value.upgradeRequired,
    degraded: false,
  }
}

/**
 * The ledger lives behind supabase/migrations/20260817_feature_usage.sql. Until
 * that migration is applied the RPC (and its tables) simply are not there.
 *
 * 42883 / PGRST202 = the function does not exist.
 * 42P01 / PGRST205 = the function exists but its tables do not (partial deploy).
 */
function isMissingFeatureUsageLedger(error: { code?: string; message?: string }): boolean {
  if (
    error.code === '42883' ||
    error.code === 'PGRST202' ||
    error.code === '42P01' ||
    error.code === 'PGRST205'
  ) {
    return true
  }
  const message = (error.message ?? '').toLowerCase()
  return (
    (message.includes('reserve_feature_usage') || message.includes('feature_usage')) &&
    (message.includes('does not exist') || message.includes('schema cache'))
  )
}

/**
 * Pre-ledger behaviour: the feature is allowed and bounded only by the route's
 * own rate limiter and plan gate, exactly as it was before the monthly ledger
 * existed. Used when the ledger migration has not been applied yet, so a
 * pending migration never turns a paid feature into a 503.
 */
function degradedReservation(feature: MeteredFeature, userId: string): FeatureUsageReservation {
  const now = new Date()
  return {
    allowed: true,
    feature,
    reason: null,
    // Real plan resolution lives in the RPC. Nothing consumes this field on an
    // allowed reservation, and `degraded` marks the whole record as untrusted.
    plan: 'free',
    subjectUserId: userId,
    // Not zero: nothing counted this request, and a fabricated zero would read
    // as "you have used none of your allowance", which we cannot know here.
    used: null,
    limit: null,
    remaining: null,
    resetAt: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString(),
    upgradeRequired: false,
    degraded: true,
  }
}

/**
 * Atomically reserve one unit immediately before an expensive operation.
 *
 * Database/RPC failures fail closed: callers must not reach a paid provider
 * when the durable ledger cannot confirm remaining allowance. The one exception
 * is a ledger that does not exist yet, which is a deployment ordering state
 * rather than an outage: there the caller falls back to the bounds that applied
 * before this ledger shipped (per-user rate limiter plus plan gate) instead of
 * denying a working feature to a paying customer.
 */
export async function reserveFeatureUsage(
  client: SupabaseClient,
  userId: string,
  feature: MeteredFeature
): Promise<ReserveFeatureUsageResult> {
  let result: Awaited<ReturnType<SupabaseClient['rpc']>>
  try {
    result = await client.rpc('reserve_feature_usage', {
      uid: userId,
      feature_name: feature,
    })
  } catch (error) {
    console.error(`[feature-usage] ${feature} reservation threw`, error)
    return { ok: false, reason: 'unavailable' }
  }

  const { data, error } = result

  if (error) {
    if (isMissingFeatureUsageLedger(error)) {
      console.warn(
        `[feature-usage] ${feature} ledger is not migrated yet; falling back to rate-limit bounds`
      )
      return { ok: true, usage: degradedReservation(feature, userId) }
    }
    console.error(`[feature-usage] ${feature} reservation failed`, error.message)
    return { ok: false, reason: 'unavailable' }
  }

  const usage = parseFeatureUsageReservation(data)
  if (!usage) {
    console.error(`[feature-usage] ${feature} reservation returned an invalid response`)
    return { ok: false, reason: 'unavailable' }
  }

  return { ok: true, usage }
}

export function buildFeatureQuotaExceededBody(usage: FeatureUsageReservation) {
  const label = FEATURE_MONTHLY_LIMITS[usage.feature].label
  const reset = new Date(usage.resetAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })

  return {
    error: `Monthly allowance for ${label} reached. It resets ${reset}.`,
    code: 'FEATURE_QUOTA_EXCEEDED',
    feature: usage.feature,
    quota: {
      period: 'month',
      used: usage.used,
      limit: usage.limit,
      remaining: usage.remaining,
      resetAt: usage.resetAt,
    },
    used: usage.used,
    limit: usage.limit,
    remaining: usage.remaining,
    resetAt: usage.resetAt,
    upgradeRequired: usage.upgradeRequired,
  }
}

/** Standard 429 used by blocking feature routes. */
export function featureQuotaExceededResponse(usage: FeatureUsageReservation): Response {
  return Response.json(buildFeatureQuotaExceededBody(usage), {
    status: 429,
    headers: { 'Retry-After': new Date(usage.resetAt).toUTCString() },
  })
}

export function buildFeatureUsageUnavailableBody(feature: MeteredFeature) {
  return {
    error: 'Usage could not be verified. Please try again in a moment.',
    code: 'FEATURE_USAGE_UNAVAILABLE',
    feature,
    upgradeRequired: false,
  }
}

/** Standard fail-closed response when the durable quota ledger is unavailable. */
export function featureUsageUnavailableResponse(feature: MeteredFeature): Response {
  return Response.json(buildFeatureUsageUnavailableBody(feature), {
    status: 503,
    headers: { 'Retry-After': '30' },
  })
}
