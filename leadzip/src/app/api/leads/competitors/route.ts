import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { competitorsLimiter, checkRateLimit } from '@/lib/ratelimit'
import { requireActiveUser } from '@/lib/requireActiveUser'
import {
  findCompetitors,
  CompetitorLookupError,
  type CompetitorInput,
} from '@/lib/competitorAnalysis'

/**
 * POST /api/leads/competitors — top 5 nearby same-category competitors for a
 * lead, with side-by-side digital signals and generated insights.
 *
 * Costs one billable Places call per request, so it is auth-required, tightly
 * rate limited, and only ever triggered by an explicit user action (the
 * Competitors button on a lead card lazy-loads it — never automatic).
 */

export async function POST(request: Request) {
  const supabase = await createClient()
  // Billable Places call per request, so a deactivated session must not reach it.
  const auth = await requireActiveUser(supabase)
  if (!auth.ok) return auth.response
  const { user } = auth

  try {
    const { success, retryAfter } = await checkRateLimit(competitorsLimiter, user.id)
    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests', retryAfter },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      )
    }
  } catch (err) {
    // Limiter outage: fail CLOSED. Every request here is a billable Places call,
    // so an unmetered path would put spend at risk.
    console.warn('[competitors] rate limiter error — failing closed', err)
    return NextResponse.json(
      { error: 'Competitor analysis is temporarily unavailable. Please try again in a moment.', retryAfter: 30 },
      { status: 503, headers: { 'Retry-After': '30' } }
    )
  }

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const body = raw as { lead?: Partial<CompetitorInput> }
  const lead = body.lead
  if (!lead || typeof lead !== 'object') {
    return NextResponse.json({ error: 'lead is required' }, { status: 400 })
  }
  if (typeof lead.businessName !== 'string' || !lead.businessName.trim()) {
    return NextResponse.json({ error: 'lead.businessName is required' }, { status: 400 })
  }
  if (typeof lead.category !== 'string' || !lead.category.trim()) {
    return NextResponse.json({ error: 'lead.category is required' }, { status: 400 })
  }
  const hasCoords = typeof lead.latitude === 'number' && typeof lead.longitude === 'number'
  const hasZip = typeof lead.zipCode === 'string' && lead.zipCode.trim().length >= 5
  if (!hasCoords && !hasZip) {
    return NextResponse.json(
      { error: 'lead needs latitude/longitude or a zipCode' },
      { status: 400 }
    )
  }

  // ISO 3166-1 alpha-2, when the caller knows it. Without it a 5-digit postal
  // code is assumed to be a US ZIP, which is how a Berlin lead used to resolve
  // to a US location and return competitors from the wrong continent.
  const rawCountry = typeof lead.countryCode === 'string' ? lead.countryCode.trim().toUpperCase() : ''
  const countryCode = /^[A-Z]{2}$/.test(rawCountry) ? rawCountry : undefined

  const input: CompetitorInput = {
    businessName: lead.businessName.trim().slice(0, 200),
    category: lead.category.trim().slice(0, 100),
    latitude: hasCoords ? (lead.latitude as number) : null,
    longitude: hasCoords ? (lead.longitude as number) : null,
    zipCode: hasZip ? (lead.zipCode as string).trim().slice(0, 10) : undefined,
    countryCode,
    website: typeof lead.website === 'string' ? lead.website : null,
    rating: typeof lead.rating === 'number' ? lead.rating : null,
    reviewCount: typeof lead.reviewCount === 'number' ? lead.reviewCount : null,
  }

  try {
    const comparison = await findCompetitors(input)
    return NextResponse.json(comparison)
  } catch (err) {
    if (err instanceof CompetitorLookupError) {
      if (err.code === 'not_configured') {
        return NextResponse.json(
          { error: 'Competitor analysis is not configured on this server' },
          { status: 503 }
        )
      }
      if (err.code === 'no_location') {
        return NextResponse.json({ error: err.message }, { status: 400 })
      }
      console.error('competitors: provider error', err.message)
      return NextResponse.json(
        { error: 'Could not fetch competitors right now' },
        { status: 502 }
      )
    }
    console.error('competitors: unexpected error', err)
    return NextResponse.json({ error: 'Could not fetch competitors' }, { status: 500 })
  }
}
