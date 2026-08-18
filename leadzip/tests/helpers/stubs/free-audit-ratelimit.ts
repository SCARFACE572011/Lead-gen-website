/**
 * Unit-test stand-in for @/lib/ratelimit used by the /api/free-audit ordering
 * tests. The route under test gets its own transpiled instance of this module,
 * so call records and denial switches live on globalThis where the test can
 * reach them (same pattern as the Supabase stub).
 */

export interface LimiterCall {
  limiter: string
  key: string
}

interface LimiterState {
  calls: LimiterCall[]
  deny: string[]
  outage: boolean
}

function state(): LimiterState {
  const g = globalThis as { __freeAuditLimiterState?: LimiterState }
  g.__freeAuditLimiterState ??= { calls: [], deny: [], outage: false }
  return g.__freeAuditLimiterState
}

export const freeAuditLimiter = { id: 'daily' }
export const freeAuditBurstLimiter = { id: 'burst' }
export const freeAuditGlobalLimiter = { id: 'global' }
export const FREE_AUDIT_GLOBAL_KEY = 'global'

export async function checkRateLimit(
  limiter: { id: string },
  identifier: string
): Promise<{ success: boolean; retryAfter: number }> {
  const s = state()
  s.calls.push({ limiter: limiter.id, key: identifier })
  if (s.outage) throw new Error('redis unavailable')
  return { success: !s.deny.includes(limiter.id), retryAfter: 60 }
}
