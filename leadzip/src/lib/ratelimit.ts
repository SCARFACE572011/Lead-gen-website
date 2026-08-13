import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

/**
 * WHY EVERY LIMITER BELOW PASSES `timeout: 0`
 * -------------------------------------------
 * @upstash/ratelimit defaults to `timeout: 5000`, and its `limit()` runs
 * `Promise.race([redisCall, timeoutPromise])` where the timeout branch
 * RESOLVES with `{ success: true, reason: "timeout" }`. So a degraded Upstash
 * (slow, not erroring) made every limiter in this file wave traffic through
 * after five seconds, success = true, no exception. None of the "fail closed"
 * try/catch blocks around the app ran, because nothing was thrown. Verified
 * against the shipped library: a 1-request-per-DAY limiter passed request after
 * request while Redis hung.
 *
 * `timeout: 0` removes that branch entirely, so a Redis failure surfaces as a
 * real rejection. The Upstash REST client has no request deadline of its own
 * (and retries with backoff), so `checkRateLimit` adds `REDIS_DEADLINE_MS` as a
 * bound of our own and treats hitting it as a FAILURE, never as a pass.
 *
 * WHAT HAPPENS ON A REDIS OUTAGE, PER ROUTE CLASS
 * -----------------------------------------------
 * Each limiter declares an `onOutage` policy:
 *
 *   'deny'  — `checkRateLimit` THROWS `RateLimitUnavailableError`. Callers that
 *             already wrap the call decide what that means (search fails closed
 *             for free users and open for paid/admin by design; chat drops to
 *             its free local FAQ engine; audit and market-gaps return 503/429).
 *             A caller with no try/catch surfaces a 500, which is still a
 *             denial. Used for everything that costs money or enforces billing:
 *             Google Places searches, the Anthropic chat path, Hunter.io email
 *             enrichment, outbound website probes, and the api/v1 daily quotas.
 *
 *   'local' — no throw. An in-process sliding window (same shape as the Redis
 *             one) decides instead, and the result carries `degraded: true`.
 *             Used where the request costs us nothing upstream but denying it
 *             would break the product during an infra blip: saving leads,
 *             pipeline moves, saved searches, and the auth limiter (a hard deny
 *             there would lock everyone out of password reset). The local
 *             window is per instance, so it is a backstop against a runaway
 *             script rather than an exact global cap.
 *
 * The rule of thumb: an outage must never be cheaper for an attacker than
 * normal operation, and must never bill us.
 */

/** Our own bound on a limiter call. Upstash REST is normally well under 100ms. */
const REDIS_DEADLINE_MS = 2000

type OutagePolicy = 'deny' | 'local'

interface LocalBackstop {
  limit: number
  windowMs: number
}

interface LimiterSpec {
  limiter: ConstructorParameters<typeof Ratelimit>[0]['limiter']
  prefix: string
  onOutage: OutagePolicy
  /** Required when onOutage is 'local'. Mirrors the Redis window. */
  local?: LocalBackstop
}

const OUTAGE_POLICIES = new WeakMap<Ratelimit, Required<Pick<LimiterSpec, 'prefix' | 'onOutage'>> & { local?: LocalBackstop }>()

function createLimiter(spec: LimiterSpec): Ratelimit {
  const instance = new Ratelimit({
    redis,
    limiter: spec.limiter,
    prefix: spec.prefix,
    // See the note above: never let a slow Redis be read as "allowed".
    timeout: 0,
  })
  OUTAGE_POLICIES.set(instance, { prefix: spec.prefix, onOutage: spec.onOutage, local: spec.local })
  return instance
}

// Per-user limiters. Each search can hit the billable Google Places API, so an
// outage throws and the route decides (free: closed, paid/admin: open).
export const searchLimiterFree = createLimiter({
  limiter: Ratelimit.slidingWindow(15, '1 m'),
  prefix: 'rl:search:free',
  onOutage: 'deny',
})

export const searchLimiterPaid = createLimiter({
  limiter: Ratelimit.slidingWindow(60, '1 m'),
  prefix: 'rl:search:paid',
  onOutage: 'deny',
})

// Anonymous (no-account) search limiters, keyed by client IP. These gate the
// billable provider for logged-out callers: without them an anonymous user could
// hit the paid Google Places API with no limit at all. The daily cap doubles as a
// value-first signup gate (5 free searches, then prompt to create an account); the
// burst guard blocks rapid-fire scraping within the daily allowance.
export const anonSearchLimiter = createLimiter({
  limiter: Ratelimit.slidingWindow(5, '1 d'),
  prefix: 'rl:search:anon',
  onOutage: 'deny',
})

export const anonSearchBurstLimiter = createLimiter({
  limiter: Ratelimit.slidingWindow(3, '1 m'),
  prefix: 'rl:search:anon:burst',
  onOutage: 'deny',
})

// Hunter.io lookups are paid per call.
export const enrichEmailLimiter = createLimiter({
  limiter: Ratelimit.slidingWindow(10, '1 m'),
  prefix: 'rl:enrich:email',
  onOutage: 'deny',
})

// Makes an outbound request to a user-supplied host; never run it unmetered.
export const enrichHealthLimiter = createLimiter({
  limiter: Ratelimit.slidingWindow(10, '1 m'),
  prefix: 'rl:enrich:health',
  onOutage: 'deny',
})

// Competitor analysis costs one billable Places call per request, so it gets a
// tight per-user cap.
export const competitorsLimiter = createLimiter({
  limiter: Ratelimit.slidingWindow(6, '1 m'),
  prefix: 'rl:competitors',
  onOutage: 'deny',
})

// Audit generation does a short website probe + a DB insert per request.
export const auditLimiter = createLimiter({
  limiter: Ratelimit.slidingWindow(10, '1 m'),
  prefix: 'rl:audit',
  onOutage: 'deny',
})

// Cheap DB writes. A Redis outage must not stop customers saving their work,
// so these degrade to a per-instance window instead of denying.
export const saveLimiter = createLimiter({
  limiter: Ratelimit.slidingWindow(30, '1 m'),
  prefix: 'rl:save',
  onOutage: 'local',
  local: { limit: 30, windowMs: 60_000 },
})

export const savedSearchesLimiter = createLimiter({
  limiter: Ratelimit.slidingWindow(30, '1 m'),
  prefix: 'rl:saved-searches',
  onOutage: 'local',
  local: { limit: 30, windowMs: 60_000 },
})

// Pipeline stage moves (drag-and-drop on the /saved board) — cheap DB updates,
// but cap rapid-fire scripting.
export const pipelineLimiter = createLimiter({
  limiter: Ratelimit.slidingWindow(60, '1 m'),
  prefix: 'rl:pipeline',
  onOutage: 'local',
  local: { limit: 60, windowMs: 60_000 },
})

// AI proposal generation — each request may hit the Claude API, so keep a tight
// per-user cap to protect spend.
export const proposalLimiter = createLimiter({
  limiter: Ratelimit.slidingWindow(10, '1 m'),
  prefix: 'rl:proposal',
  onOutage: 'deny',
})

// Market Gap Finder — one analysis fans out to up to 6 category searches, each a
// potential paid provider call on cache miss (~$0.10 apiece). Low hourly cap per
// user bounds worst-case upstream cost; cache hits make repeats nearly free.
export const marketGapsLimiter = createLimiter({
  limiter: Ratelimit.slidingWindow(6, '1 h'),
  prefix: 'rl:market-gaps',
  onOutage: 'deny',
})

// API v1 key limiters (daily quota per plan). These ARE the billing enforcement
// for the public API, so an outage must never hand out free quota.
export const apiKeyLimiterFree = createLimiter({
  limiter: Ratelimit.fixedWindow(100, '1 d'),
  prefix: 'rl:v1:free',
  onOutage: 'deny',
})

export const apiKeyLimiterPro = createLimiter({
  limiter: Ratelimit.fixedWindow(1000, '1 d'),
  prefix: 'rl:v1:pro',
  onOutage: 'deny',
})

export const apiKeyLimiterAgency = createLimiter({
  limiter: Ratelimit.fixedWindow(10000, '1 d'),
  prefix: 'rl:v1:agency',
  onOutage: 'deny',
})

// Per-IP limiter for auth endpoints. Called from the proxy, which has no
// try/catch: denying on a Redis blip would take password reset down for
// everyone, so this degrades to the local backstop instead.
export const authLimiter = createLimiter({
  limiter: Ratelimit.slidingWindow(5, '15 m'),
  prefix: 'rl:auth',
  onOutage: 'local',
  local: { limit: 5, windowMs: 15 * 60_000 },
})

// Chat widget limiters, keyed by client IP. The route is public (no account
// needed) and can call the paid Anthropic API, so it needs both a burst guard
// and a daily cost cap. On an outage these throw and /api/chat degrades to its
// free local FAQ engine, which costs nothing to serve.
export const chatLimiter = createLimiter({
  limiter: Ratelimit.slidingWindow(12, '1 m'),
  prefix: 'rl:chat',
  onOutage: 'deny',
})

export const chatDailyLimiter = createLimiter({
  limiter: Ratelimit.slidingWindow(80, '1 d'),
  prefix: 'rl:chat:day',
  onOutage: 'deny',
})

/** Why a limiter could not give a real answer. */
export type RateLimitFailure = 'timeout' | 'error'

/**
 * Thrown by `checkRateLimit` when Redis could not be reached and the limiter's
 * policy is 'deny'. Callers should treat it as "denied", not as "allowed".
 */
export class RateLimitUnavailableError extends Error {
  readonly failure: RateLimitFailure
  constructor(failure: RateLimitFailure, prefix: string) {
    super(`rate limiter unavailable (${failure}) for ${prefix}`)
    this.name = 'RateLimitUnavailableError'
    this.failure = failure
  }
}

export function isRateLimitUnavailable(err: unknown): err is RateLimitUnavailableError {
  return err instanceof RateLimitUnavailableError
}

export interface RateLimitResult {
  success: boolean
  retryAfter: number
  /** True when Redis was unusable and this verdict came from the local backstop. */
  degraded?: boolean
  /** Set together with `degraded`: why the real limiter could not answer. */
  reason?: RateLimitFailure
}

// ---------------------------------------------------------------------------
// In-process backstop used only while Redis is unusable. Per instance, so it is
// a brake on runaway scripts rather than an exact global cap.
// ---------------------------------------------------------------------------

const LOCAL_MAX_KEYS = 5000
const localHits = new Map<string, number[]>()

function localCheck(key: string, backstop: LocalBackstop): { success: boolean; retryAfter: number } {
  const now = Date.now()
  // Bounded memory: a flood of distinct identifiers must not grow this forever.
  if (localHits.size > LOCAL_MAX_KEYS) localHits.clear()

  const hits = (localHits.get(key) ?? []).filter((t) => now - t < backstop.windowMs)
  if (hits.length >= backstop.limit) {
    localHits.set(key, hits)
    const retryAfter = Math.max(1, Math.ceil((backstop.windowMs - (now - hits[0])) / 1000))
    return { success: false, retryAfter }
  }
  hits.push(now)
  localHits.set(key, hits)
  return { success: true, retryAfter: 0 }
}

class DeadlineExceeded extends Error {}

function withDeadline<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new DeadlineExceeded()), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (err: unknown) => {
        clearTimeout(timer)
        reject(err instanceof Error ? err : new Error(String(err)))
      }
    )
  })
}

/**
 * Check a limiter. Returns `{ success: false }` when the caller is over the
 * limit, and never returns `{ success: true }` because Redis was slow.
 *
 * On a Redis outage this either throws `RateLimitUnavailableError` (limiters
 * marked 'deny' — anything that costs money or enforces billing) or answers
 * from an in-process backstop with `degraded: true` (limiters marked 'local').
 * See the policy table at the top of this file.
 */
export async function checkRateLimit(
  limiter: Ratelimit,
  identifier: string
): Promise<RateLimitResult> {
  // Unknown limiter (constructed outside this module): treat as cost-incurring.
  const policy = OUTAGE_POLICIES.get(limiter) ?? { prefix: 'unknown', onOutage: 'deny' as OutagePolicy }

  let outcome: Awaited<ReturnType<Ratelimit['limit']>>
  try {
    outcome = await withDeadline(limiter.limit(identifier), REDIS_DEADLINE_MS)
  } catch (err) {
    const failure: RateLimitFailure = err instanceof DeadlineExceeded ? 'timeout' : 'error'
    return handleOutage(policy, identifier, failure, err)
  }

  // Belt and braces: if a `timeout` is ever configured again, that response is a
  // library-generated pass, not a real verdict. Treat it as an outage.
  if (outcome.reason === 'timeout') {
    return handleOutage(policy, identifier, 'timeout', undefined)
  }

  const retryAfter = Math.ceil((outcome.reset - Date.now()) / 1000)
  return { success: outcome.success, retryAfter: outcome.success ? 0 : Math.max(retryAfter, 1) }
}

function handleOutage(
  policy: { prefix: string; onOutage: OutagePolicy; local?: LocalBackstop },
  identifier: string,
  failure: RateLimitFailure,
  err: unknown
): RateLimitResult {
  console.warn(
    `[ratelimit] ${policy.prefix} unavailable (${failure}); policy=${policy.onOutage}`,
    err instanceof Error ? err.message : err
  )

  if (policy.onOutage === 'local' && policy.local) {
    const verdict = localCheck(`${policy.prefix}:${identifier}`, policy.local)
    return { ...verdict, degraded: true, reason: failure }
  }
  throw new RateLimitUnavailableError(failure, policy.prefix)
}
