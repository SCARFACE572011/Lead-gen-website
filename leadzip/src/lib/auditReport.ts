import { computeHealthScore, probeWebsite, type HealthScoreInput, type HealthScoreResult } from '@/lib/healthScore'

/**
 * Shared Digital Presence Audit builder.
 *
 * Extracted from /api/leads/audit so the authed audit route and the public
 * free checker (/api/free-audit) sanitize business snapshots and compute the
 * health score through exactly one code path. The sanitizers here are the
 * SECURITY boundary for both routes: everything they admit is later rendered
 * on a public page, and the website field becomes an outbound request.
 */

// Public snapshot of the lead used by the report. Only these fields are kept:
// report pages are public, so nothing beyond business-directory data belongs
// in the snapshot.
export interface LeadSnapshot {
  businessName: string
  category: string
  address: string
  city: string
  state: string
  zipCode: string
  phone: string
  website: string
  rating: number | null
  reviewCount: number | null
  businessHours: string[] | null
}

/** C0 and C1 control characters. Snapshots are rendered on public pages and
 *  serialized as JSON, so NULs, newlines and terminal escapes have no place
 *  in them. */
const CONTROL_CHARS_RE = /[\u0000-\u001F\u007F-\u009F]/g

/** Strip control characters, trim, and cap length. Shared with route-level
 *  input validation so free-text fields get the same treatment everywhere. */
export function cleanText(v: unknown, max: number): string {
  if (typeof v !== 'string') return ''
  return v.replace(CONTROL_CHARS_RE, ' ').trim().slice(0, max)
}

/** A business website is always a registrable public domain, never an IP or a
 *  single-label host. Rejects a trailing all-numeric TLD, so "192.168.1.1"
 *  cannot pass as a hostname. */
const PUBLIC_HOSTNAME_RE =
  /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*\.[a-z]{2,63}$/

/** Hostnames that only ever resolve inside a network. safeProbe rejects these
 *  too; refusing them here keeps them out of stored snapshots as well. */
const INTERNAL_SUFFIXES = ['.local', '.localhost', '.internal', '.intranet', '.home.arpa', '.test']

const MAX_WEBSITE_LEN = 200

/**
 * The only field that turns into an outbound request, so it gets the tightest
 * rules. `safeProbe` already blocks SSRF (DNS-resolved private-range rejection,
 * socket pinning, per-redirect revalidation); this narrows the remaining
 * "arbitrary outbound GET from our servers" primitive:
 *
 *   - http/https only, no embedded credentials, no explicit port
 *   - registrable public hostname, no IP literals, no internal-only suffixes
 *   - 200 characters max, in and out
 *   - query string and fragment are DROPPED, so a caller cannot use this path
 *     to fire parameterized GETs at a third party from our IP
 *
 * Returns '' for anything unusable rather than failing the request: directory
 * data (OSM in particular) carries free-text website tags, and an unusable URL
 * is a legitimate audit finding ("no working website"), not an error.
 */
function sanitizeWebsite(raw: unknown): string {
  const input = cleanText(raw, MAX_WEBSITE_LEN)
  if (!input) return ''

  let url: URL
  try {
    url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`)
  } catch {
    return ''
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return ''
  if (url.username || url.password) return ''
  if (url.port) return ''

  const host = url.hostname.toLowerCase()
  if (host.length > 253 || !PUBLIC_HOSTNAME_RE.test(host)) return ''
  if (INTERNAL_SUFFIXES.some((suffix) => host.endsWith(suffix))) return ''

  const normalized = `${url.protocol}//${host}${url.pathname}`
  return normalized.length > MAX_WEBSITE_LEN ? '' : normalized
}

/** Google ratings are 0-5. Anything else is not a rating. */
function rating(v: unknown): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null
  if (v < 0 || v > 5) return null
  return Math.round(v * 10) / 10
}

function reviewCount(v: unknown): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null
  if (v < 0 || v > 10_000_000) return null
  return Math.floor(v)
}

export function sanitizeLead(raw: Record<string, unknown>): LeadSnapshot | null {
  const businessName = cleanText(raw.businessName, 200)
  if (!businessName) return null

  // Slice BEFORE filtering so a huge array is never walked end to end.
  const hours = Array.isArray(raw.businessHours)
    ? raw.businessHours
        .slice(0, 14)
        .map((h) => cleanText(h, 120))
        .filter((h) => h.length > 0)
        .slice(0, 7)
    : []

  return {
    businessName,
    category: cleanText(raw.category, 100),
    address: cleanText(raw.address, 200),
    city: cleanText(raw.city, 100),
    state: cleanText(raw.state, 50),
    zipCode: cleanText(raw.zipCode, 12),
    phone: cleanText(raw.phone, 30),
    website: sanitizeWebsite(raw.website),
    rating: rating(raw.rating),
    reviewCount: reviewCount(raw.reviewCount),
    businessHours: hours.length > 0 ? hours : null,
  }
}

/**
 * Score a sanitized snapshot. When the snapshot lists a website it is probed
 * server-side first (short timeout, SSRF-guarded via safeFetch) so the score
 * is verified rather than estimated; a failed probe still produces a valid
 * (lower) score rather than failing the report.
 */
export async function buildLeadHealth(snapshot: LeadSnapshot): Promise<HealthScoreResult> {
  const signals = snapshot.website ? await probeWebsite(snapshot.website) : undefined

  const input: HealthScoreInput = {
    businessName: snapshot.businessName,
    phone: snapshot.phone,
    website: snapshot.website,
    rating: snapshot.rating,
    reviewCount: snapshot.reviewCount,
    businessHours: snapshot.businessHours,
  }
  return computeHealthScore(input, signals)
}
