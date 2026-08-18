import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { auditLimiter, checkRateLimit } from '@/lib/ratelimit'
import { requireActiveUser } from '@/lib/requireActiveUser'
import { buildLeadHealth, sanitizeLead } from '@/lib/auditReport'
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
 *
 * The snapshot sanitizers and the probe-then-score builder live in
 * src/lib/auditReport.ts, shared with the public /api/free-audit checker.
 */

/**
 * INPUT TRUST MODEL FOR THIS ROUTE
 * --------------------------------
 * The `lead` in the body is whatever the caller sent. There is no server-side
 * row to check it against: the audit button on a lead card fires on SEARCH
 * RESULTS, which the user has not saved and which may have come from a live
 * provider call rather than a cached pool, so requiring a matching `leads` or
 * `leads_cache` row would break the primary flow. See the notes on
 * `sanitizeWebsite` in src/lib/auditReport.ts for what IS constrained instead.
 */

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

  // Probe (when a website is listed) + score, via the shared builder.
  const health = await buildLeadHealth(snapshot)

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
