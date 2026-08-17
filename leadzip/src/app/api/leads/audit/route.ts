import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { auditLimiter, checkRateLimit } from '@/lib/ratelimit'
import { requireActiveUser } from '@/lib/requireActiveUser'
import { computeHealthScore, probeWebsite, type HealthScoreInput } from '@/lib/healthScore'
import {
  featureQuotaExceededResponse,
  featureUsageUnavailableResponse,
  reserveFeatureUsage,
} from '@/lib/featureUsage'

/**
 * POST /api/leads/audit — generate a shareable Digital Presence Audit for a lead.
 *
 * Snapshots the lead + its computed health score into audit_reports and returns
 * the public slug. When the lead has a website we probe it server-side (short
 * timeout, SSRF-guarded) so the stored score is verified, not estimated.
 */

// Public snapshot of the lead stored in the report. Only these fields are kept:
// the report page is public, so nothing beyond business-directory data belongs
// in the row.
interface LeadSnapshot {
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

/**
 * INPUT TRUST MODEL FOR THIS ROUTE
 * --------------------------------
 * The `lead` in the body is whatever the caller sent. There is no server-side
 * row to check it against: the audit button on a lead card fires on SEARCH
 * RESULTS, which the user has not saved and which may have come from a live
 * provider call rather than a cached pool, so requiring a matching `leads` or
 * `leads_cache` row would break the primary flow. See the notes on
 * `sanitizeWebsite` for what IS constrained instead.
 */

/** C0 and C1 control characters. The snapshot is rendered on a public page and
 *  stored as JSON, so NULs, newlines and terminal escapes have no place in it. */
const CONTROL_CHARS_RE = /[\u0000-\u001F\u007F-\u009F]/g

function clean(v: unknown, max: number): string {
  if (typeof v !== 'string') return ''
  return v.replace(CONTROL_CHARS_RE, ' ').trim().slice(0, max)
}

/** A business website is always a registrable public domain, never an IP or a
 *  single-label host. Rejects a trailing all-numeric TLD, so "192.168.1.1"
 *  cannot pass as a hostname. */
const PUBLIC_HOSTNAME_RE =
  /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*\.[a-z]{2,63}$/

/** Hostnames that only ever resolve inside a network. safeProbe rejects these
 *  too; refusing them here keeps them out of the stored snapshot as well. */
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
 *   - query string and fragment are DROPPED, so a caller cannot use this route
 *     to fire parameterized GETs at a third party from our IP
 *
 * Returns '' for anything unusable rather than failing the request: directory
 * data (OSM in particular) carries free-text website tags, and an unusable URL
 * is a legitimate audit finding ("no working website"), not an error.
 */
function sanitizeWebsite(raw: unknown): string {
  const input = clean(raw, MAX_WEBSITE_LEN)
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

function sanitizeLead(raw: Record<string, unknown>): LeadSnapshot | null {
  const businessName = clean(raw.businessName, 200)
  if (!businessName) return null

  // Slice BEFORE filtering so a huge array is never walked end to end.
  const hours = Array.isArray(raw.businessHours)
    ? raw.businessHours
        .slice(0, 14)
        .map((h) => clean(h, 120))
        .filter((h) => h.length > 0)
        .slice(0, 7)
    : []

  return {
    businessName,
    category: clean(raw.category, 100),
    address: clean(raw.address, 200),
    city: clean(raw.city, 100),
    state: clean(raw.state, 50),
    zipCode: clean(raw.zipCode, 12),
    phone: clean(raw.phone, 30),
    website: sanitizeWebsite(raw.website),
    rating: rating(raw.rating),
    reviewCount: reviewCount(raw.reviewCount),
    businessHours: hours.length > 0 ? hours : null,
  }
}

function makeSlug(businessName: string): string {
  const base = businessName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  const token = crypto.randomUUID().replace(/-/g, '').slice(0, 16)
  return base ? `${base}-${token}` : token
}

function isMissingTableError(error: { code?: string; message?: string }): boolean {
  if (error.code === '42P01' || error.code === 'PGRST205') return true
  const msg = (error.message ?? '').toLowerCase()
  return msg.includes('audit_reports') && (msg.includes('does not exist') || msg.includes('schema cache'))
}

export async function POST(request: Request) {
  const supabase = await createClient()
  // Each audit is an outbound probe plus a public-page insert, so a deactivated
  // session must not reach it.
  const auth = await requireActiveUser(supabase)
  if (!auth.ok) return auth.response
  const { user } = auth

  try {
    const { success, retryAfter } = await checkRateLimit(auditLimiter, user.id)
    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests', retryAfter },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      )
    }
  } catch (err) {
    // Limiter outage: fail CLOSED. Each audit does an outbound website probe plus
    // a DB write, so an unmetered path is worth more than the lost request.
    console.warn('[audit] rate limiter error — failing closed', err)
    return NextResponse.json(
      { error: 'Audits are temporarily unavailable. Please try again in a moment.', retryAfter: 30 },
      { status: 503, headers: { 'Retry-After': '30' } }
    )
  }

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const body = raw as { lead?: Record<string, unknown> }
  // An array is `typeof 'object'` too, and would sail through the allowlist
  // below producing an empty snapshot.
  if (!body.lead || typeof body.lead !== 'object' || Array.isArray(body.lead)) {
    return NextResponse.json({ error: 'lead is required' }, { status: 400 })
  }

  const snapshot = sanitizeLead(body.lead)
  if (!snapshot) {
    return NextResponse.json({ error: 'lead.businessName is required' }, { status: 400 })
  }

  // One reservation covers the public report and its optional live probe. It
  // happens after validation, immediately before the expensive work begins.
  const usageDb = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  const reservation = await reserveFeatureUsage(usageDb, user.id, 'audit_reports')
  if (!reservation.ok) return featureUsageUnavailableResponse('audit_reports')
  if (!reservation.usage.allowed) return featureQuotaExceededResponse(reservation.usage)

  // Verify the website server-side when one is listed; a failed probe still
  // produces a valid (lower) score rather than failing the audit.
  const signals = snapshot.website ? await probeWebsite(snapshot.website) : undefined

  const input: HealthScoreInput = {
    businessName: snapshot.businessName,
    phone: snapshot.phone,
    website: snapshot.website,
    rating: snapshot.rating,
    reviewCount: snapshot.reviewCount,
    businessHours: snapshot.businessHours,
  }
  const health = computeHealthScore(input, signals)

  const slug = makeSlug(snapshot.businessName)

  const { error } = await supabase.from('audit_reports').insert({
    user_id: user.id,
    slug,
    lead: snapshot,
    health,
  })

  if (error) {
    if (isMissingTableError(error)) {
      // Operator-facing detail stays in the logs: the response is rendered
      // verbatim to paying customers, so it must not name internal files.
      console.error(
        'audit: audit_reports table is missing. Run supabase/migrations/20260812_audit_reports.sql on this environment.',
        error
      )
      return NextResponse.json(
        { error: 'Audit reports are not enabled yet. We are on it.' },
        { status: 503 }
      )
    }
    console.error('audit: insert failed', error)
    return NextResponse.json({ error: 'Could not create audit report' }, { status: 500 })
  }

  return NextResponse.json({ slug, url: `/audit/${slug}`, health })
}
