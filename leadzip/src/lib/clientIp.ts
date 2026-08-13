/**
 * Caller IP for rate-limit keys.
 *
 * These keys are the only thing standing in front of unauthenticated, money
 * spending paths (the anonymous lead search, which bills Google Places, and
 * the chat endpoint, which bills Anthropic), so the value has to come from a
 * header the caller cannot write.
 *
 * The previous implementation read the leftmost value of `x-forwarded-for`.
 * That header is an append-only chain, and its leftmost entry is whatever the
 * client claimed before the proxy appended anything, so a caller could rotate
 * it per request and buy unlimited quota.
 *
 * Precedence:
 *   1. `x-vercel-forwarded-for` - written by Vercel's edge on every request and
 *      not passed through from the client. This is the trustworthy source in
 *      production.
 *   2. `x-real-ip` - also platform-set on Vercel.
 *   3. RIGHTMOST `x-forwarded-for` entry - the hop nearest our infrastructure,
 *      and the only entry a client cannot forge. Never the leftmost.
 *
 * Falls back to a single shared bucket, which throttles harder rather than
 * softer when no IP can be established.
 */

const SHARED_FALLBACK_BUCKET = 'anon'

function firstValidIp(values: string[]): string | null {
  for (const raw of values) {
    const candidate = raw.trim()
    if (candidate && isIpLike(candidate)) return candidate
  }
  return null
}

/**
 * Loose shape check. This guards against a header full of junk becoming a
 * rate-limit key (which would let an attacker mint unlimited buckets); it is
 * not an attempt at full IP validation.
 */
function isIpLike(value: string): boolean {
  if (value.length > 45) return false
  // IPv4, optionally with a port.
  if (/^\d{1,3}(\.\d{1,3}){3}(:\d{1,5})?$/.test(value)) return true
  // IPv6, including bracketed and IPv4-mapped forms.
  if (/^\[?[0-9a-fA-F:]+\]?(:\d{1,5})?$/.test(value) && value.includes(':')) return true
  return false
}

export function getClientIp(request: Request): string {
  const vercelIp = request.headers.get('x-vercel-forwarded-for')
  const fromVercel = firstValidIp(vercelIp ? vercelIp.split(',') : [])
  if (fromVercel) return fromVercel

  const realIp = request.headers.get('x-real-ip')
  const fromRealIp = firstValidIp(realIp ? [realIp] : [])
  if (fromRealIp) return fromRealIp

  // Rightmost first: the closer to us, the less forgeable.
  const xff = request.headers.get('x-forwarded-for')
  const fromXff = firstValidIp(xff ? xff.split(',').reverse() : [])
  if (fromXff) return fromXff

  return SHARED_FALLBACK_BUCKET
}
