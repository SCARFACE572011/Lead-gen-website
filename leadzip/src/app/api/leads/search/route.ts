import { NextRequest, NextResponse } from 'next/server'
import { searchLeads } from '@/lib/providers/leadDataProvider'
import type { SearchParams, Lead } from '@/types/lead'
import {
  searchLimiterFree,
  searchLimiterPaid,
  anonSearchLimiter,
  anonSearchBurstLimiter,
  checkRateLimit,
} from '@/lib/ratelimit'

// Best-effort client IP for keying the anonymous rate limiter. Prefer the first
// value of x-forwarded-for (the original client), fall back to x-real-ip, then a
// shared 'anon' bucket so a missing IP still fails safe (shared cap) rather than open.
function getClientIp(request: NextRequest): string {
  const xff = request.headers.get('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }
  const realIp = request.headers.get('x-real-ip')?.trim()
  if (realIp) return realIp
  return 'anon'
}

// Cache TTL for the leads_cache pool. Bumped 2h → 12h: every cache MISS hits the
// paid Google Places API (~$0.10/search), so a longer TTL directly protects gross
// margin. 12h keeps repeat prospecting / saved-search workflows on cached data for
// a full work day while staying fresh enough that listings don't go stale.
const CACHE_TTL_MS = 12 * 60 * 60 * 1000 // 12 hours

function buildCacheKey(params: SearchParams): string {
  // Cache by the raw search POOL. Refinement filters (noWebsite / minReviews /
  // minRating) are NOT part of the key — they're applied to the cached pool per
  // request (see applyPoolFilters), so refining stays a cache HIT.
  //
  // EXCEPTION: for a "Custom Keyword" search the keyword IS the query — providers
  // fetch a completely different pool per keyword — so it MUST be part of the key,
  // or e.g. a "sushi" pool would be served for a later "plumbers" search on the
  // same zip. Normal category keys are left unchanged so existing cache still hits.
  const zip = params.zipCode.trim()
  const cat = (params.category || '').trim()
  const radius = params.radiusMiles ?? 25
  if (cat === 'Custom Keyword') {
    return `${zip}|${cat}|${radius}|${(params.keyword || '').trim().toLowerCase()}`
  }
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
  // Keyword narrowing for NORMAL categories. Providers apply this same
  // name/address/category "contains keyword" filter at fetch time, but the cache
  // key excludes the keyword for normal categories — so on a cache HIT the pool is
  // un-narrowed and we must reproduce the provider's keyword filter here, or a
  // keyword would be silently ignored on cached results. (Custom Keyword is
  // excluded: there the keyword is the query itself and lives in the cache key.)
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

    // ── Usage limit check (guards the billable path only) ─────────────────────
    // Cache HITs already returned above and never bill, so everything below only
    // gates the paid provider call. Limiter/DB errors here are NOT blanket-swallowed
    // (that was the old M1/M2 bug: a Redis outage disabled every cap and kept
    // billing). Instead we fail CLOSED where a miss would cost money and only fail
    // OPEN for paying customers over a pure infra blip.
    if (isSupabaseConfigured) {
      const { createClient } = await import('@/lib/supabase/server')
      let supabase: Awaited<ReturnType<typeof createClient>> | null = null
      let user: { id: string } | null = null
      try {
        supabase = await createClient()
        const { data } = await supabase.auth.getUser()
        user = data.user
      } catch {
        // Couldn't establish a session — treat as anonymous (strictest gate).
        supabase = null
        user = null
      }

      if (!user || !supabase) {
        // ── Anonymous caller: value-first signup gate + cost/abuse protection ──
        // Without this a logged-out client could hit the paid provider with NO
        // limit at all. FAIL CLOSED: if the limiter itself errors (e.g. an Upstash
        // outage) we DENY rather than fall through to the billable path — reopening
        // that hole is exactly what this fix prevents.
        const ip = getClientIp(request)
        try {
          // Burst guard first — blocks rapid-fire scraping within the daily allowance.
          const burst = await checkRateLimit(anonSearchBurstLimiter, ip)
          if (!burst.success) {
            return NextResponse.json(
              { error: 'Too many requests', retryAfter: burst.retryAfter },
              { status: 429, headers: { 'Retry-After': String(burst.retryAfter) } }
            )
          }
          // Daily allowance — once spent, prompt account creation (conversion win).
          const daily = await checkRateLimit(anonSearchLimiter, ip)
          if (!daily.success) {
            return NextResponse.json(
              { error: 'Create a free account to keep searching', signupRequired: true },
              { status: 401 }
            )
          }
        } catch (err) {
          console.warn('[search] anon rate limiter error — failing closed', err)
          return NextResponse.json(
            { error: 'Too many requests', retryAfter: 60 },
            { status: 429, headers: { 'Retry-After': '60' } }
          )
        }
      } else {
        // ── Logged-in caller: per-plan caps ───────────────────────────────────
        let plan = 'free'
        let role = 'user'
        let searchCount = 0
        try {
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
          plan = profile?.plan ?? 'free'
          role = profile?.role ?? 'user'
          searchCount = usage?.searches_this_month ?? 0
        } catch {
          // Profile/usage read failed — default to the STRICTEST tier (free) so an
          // outage can't silently unlock paid-tier behavior. Caps below still apply.
        }

        const FREE_LIMIT = 25
        // Generous per-DAY soft cap for PAID plans. Paid/unlimited plans have no
        // monthly ceiling, so a scraper or runaway script could rack up unbounded
        // negative-margin Google API cost. 150/day never touches normal daily
        // prospecting but stops runaway abuse. Admins (owner) are exempt.
        const PAID_DAILY_FAIR_USE = 150
        const isPaidOrAdmin = role === 'admin' || plan !== 'free'

        // Rate limit: 15 req/min (free) or 60 req/min (paid/admin). On a limiter
        // OUTAGE fail CLOSED for free users (protect margin) but fail OPEN for
        // paid/admin (never block a paying customer over an infra blip) — just warn.
        const limiter = isPaidOrAdmin ? searchLimiterPaid : searchLimiterFree
        try {
          const { success: rlOk, retryAfter } = await checkRateLimit(limiter, user.id)
          if (!rlOk) {
            return NextResponse.json(
              { error: 'Too many requests', retryAfter },
              { status: 429, headers: { 'Retry-After': String(retryAfter) } }
            )
          }
        } catch (err) {
          if (!isPaidOrAdmin) {
            console.warn('[search] rate limiter error — failing closed for free user', err)
            return NextResponse.json(
              { error: 'Search is temporarily unavailable — please try again in a moment.', retryAfter: 30 },
              { status: 429, headers: { 'Retry-After': '30' } }
            )
          }
          console.warn('[search] rate limiter error — failing open for paid/admin', err)
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
          try {
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
          } catch (err) {
            // Soft-cap read failed for a PAID user — fail open (don't block a paying
            // customer on a transient DB error), but warn so it stays visible.
            console.warn('[search] fair-use count read failed — allowing', err)
          }
        }
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

        // Service-role admin client for ALL counter/cache WRITES. leads_cache,
        // search_history and usage_limits are locked to service-role-write under
        // RLS, so a session-client write is silently denied — the cache would never
        // warm and usage counts would never move. Read paths (auth.getUser, the
        // caller's own-row selects) still use the session client.
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
        let admin: import('@supabase/supabase-js').SupabaseClient | null = null
        if (serviceRoleKey && process.env.NEXT_PUBLIC_SUPABASE_URL) {
          const { createClient: createAdminClient } = await import('@supabase/supabase-js')
          admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL, serviceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false },
          })
        }

        // Never cache an EMPTY pool: a transient provider failure would otherwise
        // serve "0 results" for the whole TTL to everyone on this key.
        if (admin && poolLeads.length > 0) {
          await admin.from('leads_cache').upsert({
            cache_key: cacheKey,
            // Cache the RAW pool (pre-filter, pre-mark) so refining stays a cache hit
            leads: poolLeads,
            total: poolLeads.length,
            source: poolSource,
            expires_at: new Date(Date.now() + CACHE_TTL_MS).toISOString(),
          })
        }

        // Log search history + increment usage. These are counter tables locked to
        // service-role writes, so the WRITES go through the admin client (a session
        // write is silently denied post-lockdown, which would break counting).
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (user && admin) {
          await admin.from('search_history').insert({
            user_id: user.id,
            zip_code: body.zipCode,
            radius: body.radiusMiles,
            category: body.category || '',
            keyword: body.keyword || '',
            result_count: results.total,
          })

          // increment_searches is SECURITY DEFINER, so it runs with elevated
          // privileges regardless of caller — fine to invoke via the session client.
          // Its fallback (direct usage_limits read + update) MUST use the admin
          // client, since a direct usage_limits write is service-role-only post-lockdown.
          const { error: rpcError } = await supabase.rpc('increment_searches', { uid: user.id })
          if (rpcError) {
            const { data } = await admin
              .from('usage_limits')
              .select('searches_this_month')
              .eq('user_id', user.id)
              .single()
            if (data) {
              await admin
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
