import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey, extractBearerKey } from '@/lib/api-key'
import { searchLeads } from '@/lib/providers/leadDataProvider'
import { apiKeyLimiterFree, apiKeyLimiterPro, apiKeyLimiterAgency, checkRateLimit } from '@/lib/ratelimit'
import type { SearchParams, Lead } from '@/types/lead'

// Cache TTL for the shared leads_cache pool — mirrors the interactive search route
// (src/app/api/leads/search/route.ts). Every cache MISS hits the paid provider
// (~$0.10/search), so routing v1 through the same cache protects gross margin and
// keeps API results consistent with the app. Previously v1 called the provider on
// every request with no cache read/write at all (finding H4).
const CACHE_TTL_MS = 12 * 60 * 60 * 1000 // 12 hours

function buildCacheKey(params: SearchParams): string {
  // Same key scheme as the interactive route: cache by the raw POOL (zip|cat|radius),
  // except a "Custom Keyword" search fetches a different pool per keyword, so the
  // keyword MUST be part of the key there. Normal category keys stay keyword-free so
  // v1 and the app share the same cache entries.
  const zip = params.zipCode.trim()
  const cat = (params.category || '').trim()
  const radius = params.radiusMiles ?? 25
  if (cat === 'Custom Keyword') {
    return `${zip}|${cat}|${radius}|${(params.keyword || '').trim().toLowerCase()}`
  }
  return `${zip}|${cat}|${radius}`
}

// Reproduce the provider's own post-filters on a cached pool so a cache HIT is
// narrowed exactly like a fresh fetch would be for the params v1 accepts
// (minRating / hasWebsite / hasPhone / keyword). Custom Keyword is excluded from
// the keyword filter — there the keyword is the query and lives in the cache key.
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

  const validated = await validateApiKey(raw)
  if (!validated) {
    return NextResponse.json({ error: 'Invalid or revoked API key' }, { status: 401 })
  }

  // Rate limit by plan
  const limiter = validated.plan === 'agency' ? apiKeyLimiterAgency
    : validated.plan === 'pro' ? apiKeyLimiterPro
    : apiKeyLimiterFree
  const { success, retryAfter } = await checkRateLimit(limiter, validated.userId)
  if (!success) {
    return NextResponse.json(
      { error: 'Daily API limit reached', retryAfter, plan: validated.plan },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
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
        return NextResponse.json({
          leads,
          total: leads.length,
          meta: {
            zipCode: params.zipCode,
            radiusMiles: params.radiusMiles,
            category: params.category,
            plan: validated.plan,
            fromCache: true,
          },
        })
      }
    } catch (err) {
      console.warn('[v1/search] cache read failed — falling through to live fetch', err)
    }
  }

  try {
    const results = await searchLeads(params)

    // Cache write — skip EMPTY pools (never pin "0 results" for the TTL). Store the
    // raw provider pool so later requests (app or API) reuse it.
    if (admin && results.leads.length > 0) {
      try {
        await admin.from('leads_cache').upsert({
          cache_key: cacheKey,
          leads: results.leads,
          total: results.total,
          source: results.source ?? 'osm',
          expires_at: new Date(Date.now() + CACHE_TTL_MS).toISOString(),
        })
      } catch (err) {
        console.warn('[v1/search] cache write failed', err)
      }
    }

    return NextResponse.json({
      leads: results.leads,
      total: results.total,
      meta: {
        zipCode: params.zipCode,
        radiusMiles: params.radiusMiles,
        category: params.category,
        plan: validated.plan,
      },
    })
  } catch (err) {
    console.error('[v1/search]', err)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
