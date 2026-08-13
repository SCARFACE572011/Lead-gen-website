import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { auditLimiter, checkRateLimit } from '@/lib/ratelimit'
import { computeHealthScore, probeWebsite, type HealthScoreInput } from '@/lib/healthScore'

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

function str(v: unknown, max = 300): string {
  return typeof v === 'string' ? v.slice(0, max) : ''
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function sanitizeLead(raw: Record<string, unknown>): LeadSnapshot | null {
  const businessName = str(raw.businessName, 200).trim()
  if (!businessName) return null
  const hours = Array.isArray(raw.businessHours)
    ? raw.businessHours.filter((h): h is string => typeof h === 'string').slice(0, 7)
    : null
  return {
    businessName,
    category: str(raw.category, 100),
    address: str(raw.address),
    city: str(raw.city, 100),
    state: str(raw.state, 50),
    zipCode: str(raw.zipCode, 10),
    phone: str(raw.phone, 30),
    website: str(raw.website, 500),
    rating: num(raw.rating),
    reviewCount: num(raw.reviewCount),
    businessHours: hours && hours.length > 0 ? hours : null,
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
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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
  if (!body.lead || typeof body.lead !== 'object') {
    return NextResponse.json({ error: 'lead is required' }, { status: 400 })
  }

  const snapshot = sanitizeLead(body.lead)
  if (!snapshot) {
    return NextResponse.json({ error: 'lead.businessName is required' }, { status: 400 })
  }

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
