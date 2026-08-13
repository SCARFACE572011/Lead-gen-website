import { NextRequest, NextResponse } from 'next/server'
// Read-only import of the provider entrypoint. COUPLING NOTE: this route depends
// only on the minimal stable surface `searchLeads(params: SearchParams): Promise<SearchResult>`
// from leadDataProvider — the same call the /api/leads/search route makes. If the
// provider layer is refactored, keeping that one export stable keeps this route working.
import { searchLeads } from '@/lib/providers/leadDataProvider'
import type { Lead, SearchParams } from '@/types/lead'
import { buildCacheKey as buildLeadsCacheKey, CACHE_TTL_MS } from '@/lib/leadsCache'
import { marketGapsLimiter, checkRateLimit } from '@/lib/ratelimit'
import { requireActiveUser } from '@/lib/requireActiveUser'

const isSupabaseConfigured =
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder.supabase.co'

// TTL comes from src/lib/leadsCache.ts, shared with /api/leads/search and both
// crons, so every feature agrees on how long a cached pool lives.
const RADIUS_MILES = 25

// Preset high-value categories. Names MUST match LEAD_CATEGORIES entries exactly:
// they are part of the shared cache key and of the /search deep links.
const GAP_CATEGORIES = [
  'Plumbers',
  'Dentists',
  'Hair & Beauty Salons',
  'Restaurants',
  'Contractors',
  'Auto Shops',
] as const

function buildCacheKey(zip: string, category: string): string {
  // Delegates to the shared builder so Market Gaps can never drift from
  // /api/leads/search: a Market Gaps run warms the cache for regular searches and
  // vice versa. GAP_CATEGORIES are never "Custom Keyword", so this always lands on
  // the legacy `{zip}|{category}|{radiusMiles}` shape.
  return buildLeadsCacheKey({ zipCode: zip, category, radiusMiles: RADIUS_MILES })
}

export interface CategoryGap {
  category: string
  total: number
  noWebsitePct: number
  weakRatingPct: number
  avgReviews: number
  avgRating: number | null
  opportunityIndex: number
  fromCache: boolean
  error?: string
}

function analyzePool(category: string, pool: Lead[], fromCache: boolean): CategoryGap {
  const total = pool.length
  if (total === 0) {
    return {
      category,
      total: 0,
      noWebsitePct: 0,
      weakRatingPct: 0,
      avgReviews: 0,
      avgRating: null,
      opportunityIndex: 0,
      fromCache,
    }
  }

  const noWebsite = pool.filter((l) => !l.website).length
  const weak = pool.filter(
    (l) => (l.rating != null && l.rating < 4.0) || (l.reviewCount ?? 0) < 10
  ).length
  const reviewSum = pool.reduce((s, l) => s + (l.reviewCount ?? 0), 0)
  const rated = pool.filter((l) => l.rating != null)
  const ratingSum = rated.reduce((s, l) => s + (l.rating ?? 0), 0)

  const noWebsitePct = Math.round((100 * noWebsite) / total)
  const weakRatingPct = Math.round((100 * weak) / total)
  // Volume matters: a 70% gap across 40 businesses beats 70% across 3.
  const volumeScore = Math.min(total, 40) / 40 * 100

  return {
    category,
    total,
    noWebsitePct,
    weakRatingPct,
    avgReviews: Math.round(reviewSum / total),
    avgRating: rated.length > 0 ? Math.round((ratingSum / rated.length) * 10) / 10 : null,
    opportunityIndex: Math.round(0.5 * noWebsitePct + 0.3 * weakRatingPct + 0.2 * volumeScore),
    fromCache,
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { zipCode?: string }
    const zipCode = (body.zipCode ?? '').trim()

    if (!zipCode || zipCode.length < 5) {
      return NextResponse.json({ error: 'A valid ZIP code is required' }, { status: 400 })
    }

    // ── Auth + per-user rate limit (this route can trigger up to 6 paid provider
    //    calls, so it is signed-in only, blocks deactivated accounts, and fails
    //    CLOSED on limiter errors) ───────────────────────────────────────────────
    let supabase: Awaited<
      ReturnType<(typeof import('@/lib/supabase/server'))['createClient']>
    > | null = null

    if (isSupabaseConfigured) {
      const { createClient } = await import('@/lib/supabase/server')
      supabase = await createClient()

      const auth = await requireActiveUser(supabase)
      if (!auth.ok) {
        // Keep the signed-out copy this route already showed; a deactivated
        // account gets the shared 403 instead.
        return auth.reason === 'unauthenticated'
          ? NextResponse.json({ error: 'Sign in to analyze market gaps' }, { status: 401 })
          : auth.response
      }
      const { user } = auth

      try {
        const { success, retryAfter } = await checkRateLimit(marketGapsLimiter, user.id)
        if (!success) {
          return NextResponse.json(
            {
              error:
                'Market gap analysis is limited to a few runs per hour. Try again shortly, or search categories individually.',
              retryAfter,
            },
            { status: 429, headers: { 'Retry-After': String(retryAfter) } }
          )
        }
      } catch (err) {
        console.warn('[market-gaps] rate limiter error, failing closed', err)
        return NextResponse.json(
          { error: 'Analysis is temporarily unavailable. Please try again in a moment.' },
          { status: 429, headers: { 'Retry-After': '60' } }
        )
      }
    }

    // Service-role client for cache WRITES (leads_cache is service-role-write under RLS)
    let admin: import('@supabase/supabase-js').SupabaseClient | null = null
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (isSupabaseConfigured && serviceRoleKey && process.env.NEXT_PUBLIC_SUPABASE_URL) {
      const { createClient: createAdminClient } = await import('@supabase/supabase-js')
      admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    }

    // ── Sequential per-category analysis (never parallel: caps provider burst) ──
    const results: CategoryGap[] = []
    for (const category of GAP_CATEGORIES) {
      try {
        let pool: Lead[] | null = null
        let fromCache = false

        // 1) Shared cache first — repeat categories are free
        if (supabase) {
          try {
            const { data: cached } = await supabase
              .from('leads_cache')
              .select('leads, expires_at')
              .eq('cache_key', buildCacheKey(zipCode, category))
              .gt('expires_at', new Date().toISOString())
              .maybeSingle()
            const cachedLeads = (cached?.leads as Lead[] | undefined) ?? []
            if (cachedLeads.length > 0) {
              pool = cachedLeads
              fromCache = true
            }
          } catch {
            // Cache read failure is non-fatal — fall through to live fetch
          }
        }

        // 2) Live provider fetch on miss (the billable path)
        if (!pool) {
          const params: SearchParams = {
            zipCode,
            radiusMiles: RADIUS_MILES,
            category,
          }
          const searchResult = await searchLeads(params)
          pool = searchResult.leads

          // Warm the shared cache (never cache an empty pool)
          if (admin && pool.length > 0) {
            try {
              await admin.from('leads_cache').upsert({
                cache_key: buildCacheKey(zipCode, category),
                leads: pool,
                total: pool.length,
                source: searchResult.source ?? 'osm',
                expires_at: new Date(Date.now() + CACHE_TTL_MS).toISOString(),
              })
            } catch {
              // Non-fatal
            }
          }
        }

        results.push(analyzePool(category, pool, fromCache))
      } catch (err) {
        console.warn(`[market-gaps] category "${category}" failed:`, err)
        results.push({
          category,
          total: 0,
          noWebsitePct: 0,
          weakRatingPct: 0,
          avgReviews: 0,
          avgRating: null,
          opportunityIndex: 0,
          fromCache: false,
          error: 'Lookup failed for this category',
        })
      }
    }

    results.sort((a, b) => b.opportunityIndex - a.opportunityIndex)

    return NextResponse.json({
      zipCode,
      radiusMiles: RADIUS_MILES,
      categories: results,
      analyzedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Market gap analysis error:', error)
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 })
  }
}
