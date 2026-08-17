import { NextRequest, NextResponse } from 'next/server'
import {
  validateApiKey,
  extractBearerKey,
  resolveApiAccess,
  legacyApiAccessHeaders,
} from '@/lib/api-key'
import { searchLeads } from '@/lib/providers/leadDataProvider'
import {
  apiKeyLimiterFree,
  apiKeyLimiterPro,
  apiKeyLimiterAgency,
  checkRateLimit,
} from '@/lib/ratelimit'
import type { SearchParams, Lead } from '@/types/lead'
import { buildCacheKey, CACHE_TTL_MS } from '@/lib/leadsCache'
import { reserveLiveSearch } from '@/lib/searchUsage'

// Cache key + TTL come from src/lib/leadsCache.ts, shared with the interactive
// search route, market-gaps and both crons, so v1 and the app hit the same rows.
// Every cache MISS hits the paid provider (~$0.10/search), so routing v1 through
// the same cache protects gross margin and keeps API results consistent with the
// app. (v1 previously called the provider on every request with no cache at all.)

// The caller's narrowing filters, applied to the raw POOL on BOTH cache hit and
// miss. This is the ONLY place they are applied: the provider call below
// deliberately withholds minRating / hasWebsite / hasPhone so the pool written to
// the shared cache stays raw. Passing them through meant one filtered API call
// could poison the filter-agnostic key for every later reader, the app included.
// Custom Keyword is excluded from the keyword filter: there the keyword is the
// query itself and lives in the cache key.
// reserveLiveSearch already reports a missing RPC distinctly, but the same
// migration also creates the tables and columns the RPC reads. If the function
// exists and its schema does not, Postgres raises undefined_table /
// undefined_column from inside it, which arrives here as a generic failure.
// Treat that as "the allowance schema is not deployed yet" too, so a half
// applied migration cannot 503 every API search.
function isMissingSchema(message: string): boolean {
  return /does not exist|schema cache/i.test(message)
}

function applyV1Filters(leads: Lead[], params: SearchParams): Lead[] {
  let out = leads
  if (params.minRating != null && params.minRating > 0) {
    out = out.filter((l) => l.rating != null && l.rating >= params.minRating!)
  }
  if (params.hasWebsite === true) out = out.filter((l) => !!l.website)
  if (params.hasPhone === true) out = out.filter((l) => !!l.phone)
  if (params.keyword && params.category !== 'Custom Keyword') {
    const kw = params.keyword.toLowerCase()
    out = out.filter(
      (l) =>
        l.businessName.toLowerCase().includes(kw) ||
        l.address.toLowerCase().includes(kw) ||
        l.category.toLowerCase().includes(kw)
    )
  }
  return out
}

export async function POST(request: NextRequest) {
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
    // Limiter outage: fail CLOSED. This is the daily plan quota in front of a
    // paid provider, so serving unmetered requests would uncap API spend.
    console.warn('[v1/search] rate limiter error, failing closed', err)
    return NextResponse.json(
      { error: 'Rate limiting is temporarily unavailable. Please retry in a moment.', retryAfter: 30 },
      { status: 503, headers: { ...legacyHeaders, 'Retry-After': '30' } }
    )
  }

  let body: Partial<SearchParams>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.zipCode || body.zipCode.length < 5) {
    return NextResponse.json({ error: 'zipCode (5-digit) is required' }, { status: 400 })
  }
  if (!body.category) {
    return NextResponse.json({ error: 'category is required' }, { status: 400 })
  }

  const params: SearchParams = {
    zipCode: body.zipCode,
    radiusMiles: body.radiusMiles ?? 10,
    category: body.category,
    keyword: body.keyword,
    minRating: body.minRating,
    hasWebsite: body.hasWebsite,
    hasPhone: body.hasPhone,
  }

  // ── Shared leads_cache: read-then-write, same pattern as the interactive route ──
  // v1 has no user session, so use the service-role client for both cache read and
  // write (leads_cache is service-role-write under RLS).
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const cacheEnabled = !!(
    supabaseUrl && supabaseUrl !== 'https://placeholder.supabase.co' && serviceRoleKey
  )
  const cacheKey = buildCacheKey(params)

  let admin: import('@supabase/supabase-js').SupabaseClient | null = null
  if (cacheEnabled) {
    const { createClient } = await import('@supabase/supabase-js')
    admin = createClient(supabaseUrl!, serviceRoleKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  }

  // Cache read — an empty cached pool is treated as a MISS (a transient provider
  // failure shouldn't pin "0 results" for the whole TTL).
  if (admin) {
    try {
      const { data: cached } = await admin
        .from('leads_cache')
        .select('leads, total, source, expires_at')
        .eq('cache_key', cacheKey)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle()

      if (cached && ((cached.leads as Lead[])?.length ?? 0) > 0) {
        const leads = applyV1Filters((cached.leads as Lead[]) ?? [], params)
        return NextResponse.json(
          {
            leads,
            total: leads.length,
            meta: {
              zipCode: params.zipCode,
              radiusMiles: params.radiusMiles,
              category: params.category,
              plan: validated.plan,
              fromCache: true,
            },
          },
          { headers: legacyHeaders }
        )
      }
    } catch (err) {
      console.warn('[v1/search] cache read failed — falling through to live fetch', err)
    }
  }


  // Cache misses reach a paid provider and therefore share the Agency
  // workspace's 300 monthly live-search allowance. API request quota and live
  // data quota are deliberately separate: cached API reads cost no search.
  if (admin) {
    // Pass the actor, not the pooled owner. The RPC resolves the shared billing
    // subject itself while preserving that an admin-owner's teammate is a normal
    // Agency seat (only the actual platform admin is exempt).
    const reservation = await reserveLiveSearch(admin, validated.userId)
    if (reservation.status === 'reserved') {
      if (!reservation.reservation.allowed) {
        const daily = reservation.reservation.reason === 'daily'
        return NextResponse.json(
          {
            error: daily ? 'Daily live-search limit reached' : 'Monthly live-search limit reached',
            plan: reservation.reservation.plan ?? validated.plan,
            limit: daily
              ? reservation.reservation.dailyLimit
              : reservation.reservation.monthlyLimit,
            retryAfter: daily ? 'tomorrow' : 'next month',
          },
          { status: 429, headers: legacyHeaders }
        )
      }
    } else if (reservation.status === 'error' && !isMissingSchema(reservation.message)) {
      // The metering path answered with a real failure. Refuse rather than
      // hand out an unmetered paid-provider call.
      console.error('[v1/search] live-search reservation failed:', reservation.message)
      return NextResponse.json(
        { error: 'Search metering is temporarily unavailable. Please retry in a moment.' },
        { status: 503, headers: { ...legacyHeaders, 'Retry-After': '30' } }
      )
    } else {
      // The allowance schema does not exist in this database yet (the migration
      // has not been applied). Before it existed the daily API quota checked
      // above was the only meter on this path, so fall back to exactly that
      // instead of 503-ing a working integration on deploy day.
      console.warn(
        '[v1/search] live-search allowance schema is missing, falling back to the daily API quota. Apply supabase/migrations/20260815_product_allowances.sql.',
        reservation.status === 'error' ? reservation.message : ''
      )
    }
  } else {
    // No Supabase service credentials: the live-search allowance cannot be
    // metered here, and the daily API quota above remains the only bound. This
    // matches the behaviour before allowances existed.
    console.warn('[v1/search] Supabase is not configured, live-search allowance not metered')
  }

  try {
    // Pool-defining params only. minRating / hasWebsite / hasPhone are pure
    // post-filters in every provider (they do not change the upstream query or its
    // cost), so withholding them costs nothing and keeps the cached pool raw.
    const providerParams: SearchParams = {
      ...params,
      minRating: undefined,
      hasWebsite: undefined,
      hasPhone: undefined,
    }
    const results = await searchLeads(providerParams)

    // Snapshot the raw provider pool BEFORE filtering — this is what gets cached,
    // so later requests (app or API) can refine it any way they like.
    const poolLeads = results.leads

    // Cache write — skip EMPTY pools (never pin "0 results" for the TTL).
    if (admin && poolLeads.length > 0) {
      try {
        await admin.from('leads_cache').upsert({
          cache_key: cacheKey,
          leads: poolLeads,
          total: poolLeads.length,
          source: results.source ?? 'osm',
          expires_at: new Date(Date.now() + CACHE_TTL_MS).toISOString(),
        })
      } catch (err) {
        console.warn('[v1/search] cache write failed', err)
      }
    }

    // Narrow for THIS response, identically to the cache-hit path above.
    const leads = applyV1Filters(poolLeads, params)

    return NextResponse.json(
      {
        leads,
        total: leads.length,
        meta: {
          zipCode: params.zipCode,
          radiusMiles: params.radiusMiles,
          category: params.category,
          plan: validated.plan,
        },
      },
      { headers: legacyHeaders }
    )
  } catch (err) {
    console.error('[v1/search]', err)
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500, headers: legacyHeaders }
    )
  }
}
