/**
 * Unit-test stand-in for @/lib/ratelimit. Burst protection is orthogonal to the
 * credit accounting under test and has its own behaviour (fail closed on a
 * limiter outage) that these tests are not exercising.
 */
export const enrichEmailLimiter = null

export async function checkRateLimit(): Promise<{ success: boolean; retryAfter: number }> {
  return { success: true, retryAfter: 0 }
}
