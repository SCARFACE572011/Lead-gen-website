import { NextRequest, NextResponse } from 'next/server'
import {
  validateApiKey,
  extractBearerKey,
  resolveApiAccess,
  legacyApiAccessHeaders,
} from '@/lib/api-key'
import {
  apiKeyLimiterFree,
  apiKeyLimiterPro,
  apiKeyLimiterAgency,
  checkRateLimit,
} from '@/lib/ratelimit'
import { createClient } from '@supabase/supabase-js'

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function GET(request: NextRequest) {
  const raw = extractBearerKey(request.headers.get('authorization'))
  if (!raw) {
    return NextResponse.json({ error: 'Missing API key. Pass Authorization: Bearer <key>' }, { status: 401 })
  }

  const auth = await validateApiKey(raw)
  if (auth.status === 'unavailable') {
    // We could not check the key, so we must not claim it is invalid.
    return NextResponse.json(
      { error: 'Could not verify your API key right now. Please retry in a moment.' },
      { status: 503, headers: { 'Retry-After': '30' } }
    )
  }
  if (auth.status !== 'valid') {
    return NextResponse.json({ error: 'Invalid or revoked API key' }, { status: 401 })
  }
  const validated = auth.key

  const access = resolveApiAccess(validated)
  if (!access.allowed) {
    return NextResponse.json(
      { error: access.message, upgradeRequired: true, plan: validated.plan },
      { status: 403 }
    )
  }
  // Grandfathered Free/Pro keys keep the quota they were sold until the sunset
  // date and carry the deprecation notice on every response.
  const legacyHeaders = access.legacy ? legacyApiAccessHeaders() : {}
  const limiter =
    access.quotaPlan === 'agency' ? apiKeyLimiterAgency
    : access.quotaPlan === 'pro' ? apiKeyLimiterPro
    : apiKeyLimiterFree

  try {
    const { success, retryAfter } = validated.role === 'admin'
      ? { success: true, retryAfter: 0 }
      : await checkRateLimit(limiter, validated.quotaSubjectUserId)
    if (!success) {
      return NextResponse.json(
        { error: 'Daily API limit reached', retryAfter, plan: validated.plan },
        { status: 429, headers: { ...legacyHeaders, 'Retry-After': String(retryAfter) } }
      )
    }
  } catch (err) {
    // Limiter outage: fail CLOSED. This is the daily plan quota, so serving
    // unmetered requests would let any key exceed its purchased allowance.
    console.warn('[v1/leads] rate limiter error, failing closed', err)
    return NextResponse.json(
      { error: 'Rate limiting is temporarily unavailable. Please retry in a moment.', retryAfter: 30 },
      { status: 503, headers: { ...legacyHeaders, 'Retry-After': '30' } }
    )
  }

  const params = request.nextUrl.searchParams
  const page = Math.max(1, parseInt(params.get('page') ?? '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(params.get('limit') ?? '25', 10)))
  const offset = (page - 1) * limit

  const db = serviceClient()
  // saved_at alone is not a total order, so leads saved in the same instant
  // could shuffle between pages and drop out of a paged read. leads.id is the
  // provider ID and is unique within one user's list in BOTH schema states
  // (globally before 20260813, per user after it), so it is a stable
  // tiebreaker that does not depend on an unapplied migration.
  const { data, count, error } = await db
    .from('leads')
    .select('*', { count: 'exact' })
    .eq('user_id', validated.userId)
    .order('saved_at', { ascending: false })
    .order('id', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    console.error('[v1/leads] leads fetch failed:', error.message)
    return NextResponse.json(
      { error: 'Failed to fetch leads' },
      { status: 500, headers: legacyHeaders }
    )
  }

  return NextResponse.json(
    {
      leads: data ?? [],
      meta: {
        page,
        limit,
        total: count ?? 0,
        totalPages: Math.ceil((count ?? 0) / limit),
      },
    },
    { headers: legacyHeaders }
  )
}
