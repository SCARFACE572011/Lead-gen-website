import { NextResponse } from 'next/server'
import { getClientIp } from '@/lib/clientIp'
import {
  freeAuditLimiter,
  freeAuditBurstLimiter,
  freeAuditGlobalLimiter,
  FREE_AUDIT_GLOBAL_KEY,
  checkRateLimit,
} from '@/lib/ratelimit'
import { findBusiness, BusinessLookupError } from '@/lib/businessLookup'
import { buildLeadHealth, cleanText } from '@/lib/auditReport'

/**
 * POST /api/free-audit — public, no-account Digital Health Score checker.
 *
 * Resolves ONE best-matching business from a name plus a city or ZIP, probes
 * its website through the same SSRF-guarded path as the authed audit route,
 * and returns the score as JSON. Deliberately writes NOTHING to the database:
 * audit_reports requires a user_id by design, and this endpoint exists to show
 * value before signup. Shareable links and PDF exports stay account features.
 *
 * Cost control: each accepted request is one billable Places call plus an
 * outbound probe, gated by three deny-on-outage limiters (per-IP daily, per-IP
 * burst, and a sitewide daily cap). See src/lib/ratelimit.ts.
 */

const MAX_NAME_LEN = 120
const MAX_LOCATION_LEN = 80
const DAILY_FREE_CHECKS = 3

function readField(v: unknown, max: number): string {
  return typeof v === 'string' ? cleanText(v, max) : ''
}

export async function POST(request: Request) {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const body = raw as { businessName?: unknown; location?: unknown }
  const businessName = readField(body.businessName, MAX_NAME_LEN)
  const location = readField(body.location, MAX_LOCATION_LEN)
  if (businessName.length < 2) {
    return NextResponse.json({ error: 'Enter the business name.' }, { status: 400 })
  }
  if (location.length < 2) {
    return NextResponse.json({ error: 'Enter a city or ZIP code.' }, { status: 400 })
  }

  // Per-IP checks run BEFORE the global check, so an abusive caller is denied
  // by its own bucket without draining the shared daily budget for everyone.
  const ip = getClientIp(request)
  try {
    const burst = await checkRateLimit(freeAuditBurstLimiter, ip)
    if (!burst.success) {
      return NextResponse.json(
        { error: 'Too many requests', retryAfter: burst.retryAfter },
        { status: 429, headers: { 'Retry-After': String(burst.retryAfter) } }
      )
    }
    const daily = await checkRateLimit(freeAuditLimiter, ip)
    if (!daily.success) {
      return NextResponse.json(
        {
          error: `You have used today's ${DAILY_FREE_CHECKS} free checks. Create a free LeadZipp account for 25 searches a month, no card needed.`,
          limitReached: true,
        },
        { status: 429, headers: { 'Retry-After': String(daily.retryAfter) } }
      )
    }
    const global = await checkRateLimit(freeAuditGlobalLimiter, FREE_AUDIT_GLOBAL_KEY)
    if (!global.success) {
      return NextResponse.json(
        {
          error:
            'The free checker is very popular today and has reached its daily limit. Please try again tomorrow, or create a free account to run searches inside LeadZipp.',
          globalLimit: true,
        },
        { status: 429, headers: { 'Retry-After': String(global.retryAfter) } }
      )
    }
  } catch (err) {
    // Limiter outage: fail CLOSED. Every request past this point spends money
    // at Google and fires an outbound probe, so unmetered is not an option.
    console.warn('[free-audit] rate limiter error — failing closed', err)
    return NextResponse.json(
      { error: 'The free checker is temporarily unavailable. Please try again in a few minutes.' },
      { status: 503, headers: { 'Retry-After': '30' } }
    )
  }

  let snapshot
  try {
    snapshot = await findBusiness(businessName, location)
  } catch (err) {
    // Provider detail (key state, quota, HTTP status) stays in the logs.
    console.error(
      '[free-audit] business lookup failed',
      err instanceof BusinessLookupError ? `${err.code}: ${err.message}` : err
    )
    return NextResponse.json(
      { error: 'The free checker is temporarily unavailable. Please try again in a few minutes.' },
      { status: 503, headers: { 'Retry-After': '30' } }
    )
  }

  if (!snapshot) {
    return NextResponse.json(
      {
        error: `We could not find "${businessName}" near "${location}". Check the spelling, or add more detail like a state or country.`,
        notFound: true,
      },
      { status: 404 }
    )
  }

  // Probe (when a website is listed) + score, via the same builder the authed
  // audit route uses. No database writes anywhere on this path.
  const health = await buildLeadHealth(snapshot)

  return NextResponse.json({ lead: snapshot, health })
}
