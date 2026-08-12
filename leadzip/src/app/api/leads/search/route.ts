import { NextRequest, NextResponse } from 'next/server'
import { searchLeads } from '@/lib/providers/leadDataProvider'
import type { SearchParams, Lead } from '@/types/lead'
import { searchLimiterFree, searchLimiterPaid, checkRateLimit } from '@/lib/ratelimit'

// Cache TTL for the leads_cache pool. Bumped 2h → 12h: every cache MISS hits the
// paid Google Places API (~$0.10/search), so a longer TTL directly protects gross
// margin. 12h keeps repeat prospecting / saved-search workflows on cached data for
// a full work day while staying fresh enough that listings don't go stale.
const CACHE_TTL_MS = 12 * 60 * 60 * 1000 // 12 hours

function buildCacheKey(params: SearchParams): string {
  // Cache by the raw search POOL only. Refinement filters (noWebsite / minReviews
  // / minRating) and keyword are intentionally NOT part of the key — they are
  // applied to the cached pool per request (see applyPoolFilters), so refining a
  // search stays a cache HIT and never re-bills the provider.
  const zip = params.zipCode.trim()
  const cat = (params.category || '').trim()
  const radius = params.radiusMiles ?? 25
  return `${zip}|${cat}|${radius}`
}

// Refinement filters applied to the cached POOL on BOTH cache hit and miss, so the
// pool stays filter-agnostic and refining never triggers a new billable fetch.
// NOTE: providers also pre-filter minRating/hasWebsite/hasPhone at fetch time, so a
// freshly-fetched pool may already be narrowed by those params.
function applyPoolFilters(leads: Lead[], params: SearchParams): Lead[] {
  let out = leads
  if (params.noWebsite === true) {
    out = out.filter((l) => !l.website)
  }
  if (params.minReviews != null && params.minReviews > 0) {
    out = out.filter((l) => (l.reviewCount ?? 0) >= params.minReviews!)
  }
  if (params.minRating != null && params.minRating > 0) {
    out = out.filter((l) => l.rating != null && l.rating >= params.minRating!)
  }
  return out
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SearchParams

    if (!body.zipCode) {
      return NextResponse.json({ error: 'ZIP code is required' }, { status: 400 })
    }
    if (body.zipCode.length < 5) {
      return NextResponse.json({ error: 'Invalid ZIP code' }, { status: 400 })
    }

    const isSupabaseConfigured =
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder.supabase.co'

    // ── Cache check ───────────────────────────────────────────────────────────
    if (isSupabaseConfigured) {
      try {
        const { createClient } = await import('@/lib/supabase/server')
        const supabase = await createClient()
        const cacheKey = buildCacheKey(body)

        const { data: cached } = await supabase
          .from('leads_cache')
          .select('leads, total, source, expires_at')
          .eq('cache_key', cacheKey)
          .gt('expires_at', new Date().toISOString())
          .maybeSingle()

        // An empty cached pool is treated as a MISS: empty results usually mean
        // a transient provider failure, and serving them for the full TTL would
        // pin "0 results" on a working search (self-heals old empty entries too).
        if (cached && ((cached.leads as Lead[])?.length ?? 0) > 0) {
          // The cache stores the raw, filter-agnostic pool. Apply the caller's
          // refinement filters here so refining a search is a cache HIT and never
          // re-bills the paid provider.
          const pool = (cached.leads as Lead[]) ?? []
          let leads = applyPoolFilters(pool, body)

          // Mark leads the current user already saved. This is a per-user
          // annotation, so it must be re-applied on every request rather than
          // baked into the shared cached pool.
          try {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
              const { data: savedLeads } = await supabase
                .from('leads')
                .select('business_name, zip_code')
                .eq('user_id', user.id)
              if (savedLeads?.length) {
                const { markDuplicates } = await import('@/lib/deduplicateLeads')
                const savedForMark = savedLeads.map((l) => ({ businessName: l.business_name, zipCode: l.zip_code })) as Lead[]
                leads = markDuplicates(leads, savedForMark)
              }
            }
          } catch { /* non-fatal */ }

          const firstWithCoords = pool.find((l) => l.latitude != null && l.longitude != null)
          // Approximate fetchedAt from expires_at - TTL
          const fetchedAt = cached.expires_at
            ? new Date(new Date(cached.expires_at as string).getTime() - CACHE_TTL_MS).toISOString()
            : new Date().toISOString()
          return NextResponse.json({
            leads,
            total: leads.length,
            fromCache: true,
            source: cached.source,
            fetchedAt,
            center: firstWithCoords
              ? { lat: firstWithCoords.latitude, lon: firstWithCoords.longitude }
              : undefined,
          })
        }
      } catch {
        // Cache read failed — proceed to live fetch
      }
    }

    // ── Usage limit check ─────────────────────────────────────────────────────
    if (isSupabaseConfigured) {
      try {
        const { createClient } = await import('@/lib/supabase/server')
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const [{ data: usage }, { data: profile }] = await Promise.all([
            supabase
              .from('usage_limits')
              .select('searches_this_month')
              .eq('user_id', user.id)
              .maybeSingle(),
            supabase
              .from('users_profile')
              .select('plan, role')
              .eq('id', user.id)
              .maybeSingle(),
          ])
          const plan = profile?.plan ?? 'free'
          const role = profile?.role ?? 'user'
          const searchCount = usage?.searches_this_month ?? 0
          const FREE_LIMIT = 25
          // Generous per-DAY soft cap for PAID plans. Paid/unlimited plans have no
          // monthly ceiling, so a scraper or runaway script could rack up unbounded
          // negative-margin Google API cost. 150/day never touches normal daily
          // prospecting but stops runaway abuse. Admins (owner) are exempt.
          const PAID_DAILY_FAIR_USE = 150

          // Rate limit: 15 req/min (free) or 60 req/min (paid/admin)
          const limiter = (role === 'admin' || plan !== 'free') ? searchLimiterPaid : searchLimiterFree
          const { success: rlOk, retryAfter } = await checkRateLimit(limiter, user.id)
          if (!rlOk) {
            return NextResponse.json(
              { error: 'Too many requests', retryAfter },
              { status: 429, headers: { 'Retry-After': String(retryAfter) } }
            )
          }

          // Free plan: monthly cap. Admins and paid plans skip this.
          if (role !== 'admin' && plan === 'free' && searchCount >= FREE_LIMIT) {
            return NextResponse.json(
              { error: 'Monthly search limit reached. Upgrade to Pro for unlimited searches.', limitReached: true },
              { status: 429 }
            )
          }

          // Paid plan: daily fair-use soft cap — protects gross margin from runaway
          // API cost. Counts today's LIVE searches from search_history (cache hits
          // return before this point and never bill, so they don't count). Admins exempt.
          if (role !== 'admin' && plan !== 'free') {
            const startOfDay = new Date()
            startOfDay.setUTCHours(0, 0, 0, 0)
            const { count: todayCount } = await supabase
              .from('search_history')
              .select('id', { count: 'exact', head: true })
              .eq('user_id', user.id)
              .gte('created_at', startOfDay.toISOString())
            if ((todayCount ?? 0) >= PAID_DAILY_FAIR_USE) {
              return NextResponse.json(
                {
                  error: `You've hit today's fair-use limit (${PAID_DAILY_FAIR_USE} searches). It resets tomorrow — reply to support if you need a higher limit.`,
                  fairUse: true,
                },
                { status: 429 }
              )
            }
          }
        }
      } catch {
        // Non-fatal — don't block search if limit check fails
      }
    }

    // ── Live fetch (the billable provider call) ───────────────────────────────
    const results = await searchLeads(body)

    // Snapshot the raw provider pool BEFORE refinement filters or per-user marks.
    // This is what gets cached — shared and filter-agnostic — so later refines are
    // cache HITs. applyPoolFilters + markDuplicates below return NEW arrays, so this
    // reference keeps pointing at the full, unfiltered pool.
    const poolLeads = results.leads
    const poolSource = results.source ?? 'osm'

    // Apply refinement filters to THIS response (the pool itself is cached unfiltered)
    results.leads = applyPoolFilters(poolLeads, body)
    results.total = results.leads.length

    // Mark leads already saved by this user
    try {
      if (isSupabaseConfigured) {
        const { createClient } = await import('@/lib/supabase/server')
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: savedLeads } = await supabase
            .from('leads')
            .select('business_name, zip_code')
            .eq('user_id', user.id)
          if (savedLeads?.length) {
            const { markDuplicates } = await import('@/lib/deduplicateLeads')
            const savedForMark = savedLeads.map(l => ({ businessName: l.business_name, zipCode: l.zip_code })) as import('@/types/lead').Lead[]
            results.leads = markDuplicates(results.leads, savedForMark)
          }
        }
      }
    } catch { /* non-fatal */ }

    // ── Cache write + analytics (non-fatal) ───────────────────────────────────
    if (isSupabaseConfigured) {
      try {
        const { createClient } = await import('@/lib/supabase/server')
        const supabase = await createClient()
        const cacheKey = buildCacheKey(body)

        // Write to cache with the service-role client. leads_cache is
        // public-read / service-role-write under RLS, so the session client's
        // write would be silently denied and the cache would never warm.
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
        // Never cache an EMPTY pool: a transient provider failure would otherwise
        // serve "0 results" for the whole TTL to everyone on this key.
        if (poolLeads.length > 0 && serviceRoleKey && process.env.NEXT_PUBLIC_SUPABASE_URL) {
          const { createClient: createAdminClient } = await import('@supabase/supabase-js')
          const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL, serviceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false },
          })
          await admin.from('leads_cache').upsert({
            cache_key: cacheKey,
            // Cache the RAW pool (pre-filter, pre-mark) so refining stays a cache hit
            leads: poolLeads,
            total: poolLeads.length,
            source: poolSource,
            expires_at: new Date(Date.now() + CACHE_TTL_MS).toISOString(),
          })
        }

        // Log search history + usage — user-scoped rows under RLS, so these
        // must use the caller's session client, not the service role.
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (user) {
          await supabase.from('search_history').insert({
            user_id: user.id,
            zip_code: body.zipCode,
            radius: body.radiusMiles,
            category: body.category || '',
            keyword: body.keyword || '',
            result_count: results.total,
          })

          const { error: rpcError } = await supabase.rpc('increment_searches', { uid: user.id })
          if (rpcError) {
            const { data } = await supabase
              .from('usage_limits')
              .select('searches_this_month')
              .eq('user_id', user.id)
              .single()
            if (data) {
              await supabase
                .from('usage_limits')
                .update({
                  searches_this_month: (data.searches_this_month ?? 0) + 1,
                  updated_at: new Date().toISOString(),
                })
                .eq('user_id', user.id)
            }
          }
        }
      } catch {
        // Non-fatal — search result still returned
      }
    }

    return NextResponse.json({ ...results, source: results.source, fetchedAt: new Date().toISOString() })
  } catch (error) {
    console.error('Lead search error:', error)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
