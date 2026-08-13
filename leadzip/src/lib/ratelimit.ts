import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

// Per-user limiters
export const searchLimiterFree = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(15, '1 m'),
  prefix: 'rl:search:free',
})

export const searchLimiterPaid = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(60, '1 m'),
  prefix: 'rl:search:paid',
})

// Anonymous (no-account) search limiters, keyed by client IP. These gate the
// billable provider for logged-out callers: without them an anonymous user could
// hit the paid Google Places API with no limit at all. The daily cap doubles as a
// value-first signup gate (5 free searches, then prompt to create an account); the
// burst guard blocks rapid-fire scraping within the daily allowance.
export const anonSearchLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '1 d'),
  prefix: 'rl:search:anon',
})

export const anonSearchBurstLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(3, '1 m'),
  prefix: 'rl:search:anon:burst',
})

export const enrichEmailLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 m'),
  prefix: 'rl:enrich:email',
})

export const enrichHealthLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 m'),
  prefix: 'rl:enrich:health',
})

// Competitor analysis costs one billable Places call per request, so it gets a
// tight per-user cap.
export const competitorsLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(6, '1 m'),
  prefix: 'rl:competitors',
})

// Audit generation does a short website probe + a DB insert per request.
export const auditLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 m'),
  prefix: 'rl:audit',
})

export const saveLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, '1 m'),
  prefix: 'rl:save',
})

export const savedSearchesLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, '1 m'),
  prefix: 'rl:saved-searches',
})

// Pipeline stage moves (drag-and-drop on the /saved board) — cheap DB updates,
// but cap rapid-fire scripting.
export const pipelineLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(60, '1 m'),
  prefix: 'rl:pipeline',
})

// AI proposal generation — each request may hit the Claude API, so keep a tight
// per-user cap to protect spend.
export const proposalLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 m'),
  prefix: 'rl:proposal',
})

// Market Gap Finder — one analysis fans out to up to 6 category searches, each a
// potential paid provider call on cache miss (~$0.10 apiece). Low hourly cap per
// user bounds worst-case upstream cost; cache hits make repeats nearly free.
export const marketGapsLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(6, '1 h'),
  prefix: 'rl:market-gaps',
})

// API v1 key limiters (daily quota per plan)
export const apiKeyLimiterFree = new Ratelimit({
  redis,
  limiter: Ratelimit.fixedWindow(100, '1 d'),
  prefix: 'rl:v1:free',
})

export const apiKeyLimiterPro = new Ratelimit({
  redis,
  limiter: Ratelimit.fixedWindow(1000, '1 d'),
  prefix: 'rl:v1:pro',
})

export const apiKeyLimiterAgency = new Ratelimit({
  redis,
  limiter: Ratelimit.fixedWindow(10000, '1 d'),
  prefix: 'rl:v1:agency',
})

// Per-IP limiter for auth endpoints
export const authLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '15 m'),
  prefix: 'rl:auth',
})

// Chat widget limiters, keyed by client IP. The route is public (no account
// needed) and can call the paid Anthropic API, so it needs both a burst guard
// and a daily cost cap. In FAQ fallback mode the same limits stop abuse.
export const chatLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(12, '1 m'),
  prefix: 'rl:chat',
})

export const chatDailyLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(80, '1 d'),
  prefix: 'rl:chat:day',
})

export interface RateLimitResult {
  success: boolean
  retryAfter: number
}

export async function checkRateLimit(
  limiter: Ratelimit,
  identifier: string
): Promise<RateLimitResult> {
  const { success, reset } = await limiter.limit(identifier)
  const retryAfter = Math.ceil((reset - Date.now()) / 1000)
  return { success, retryAfter: success ? 0 : Math.max(retryAfter, 1) }
}
