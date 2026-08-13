import { NextRequest, NextResponse } from 'next/server'
import { searchLeads } from '@/lib/providers/leadDataProvider'
import {
  isUsZip,
  resolveSearchLocation,
  LocationNotFoundError,
  effectiveRadiusMiles,
} from '@/lib/geocode'
import type { SearchParams, Lead } from '@/types/lead'
import { buildCacheKey, CACHE_TTL_MS } from '@/lib/leadsCache'
import {
  searchLimiterFree,
  searchLimiterPaid,
  anonSearchLimiter,
  anonSearchBurstLimiter,
  checkRateLimit,
} from '@/lib/ratelimit'

import { getClientIp } from '@/lib/clientIp'
import { requireActiveUser, type RequireActiveUserResult } from '@/lib/requireActiveUser'

// Cache key + TTL now live in src/lib/leadsCache.ts so every reader and writer of
// leads_cache (this route, /api/v1/search, market-gaps, and both crons) agrees on
// the key format and on how long a row lives. The ZIP key format is unchanged.

// Refinement filters applied to the cached POOL on BOTH cache hit and miss, so the
// pool stays filter-agnostic and refining never triggers a new billable fetch.
//
// EVERY narrowing filter the caller asked for must be applied HERE and nowhere
// else. Providers can also pre-filter minRating/hasWebsite/hasPhone at fetch time,
// but this route deliberately withholds those params from the provider call (see
// providerParams below) so the pool it caches is genuinely raw. Passing them
// through poisoned the shared pool: a "4.0+ stars" search wrote a 4.0+-only pool
// under the filter-agnostic key, and the next person to search that same
// zip/category/radius — say with the "No Website" preset — got a cache HIT over
// only the highest-rated businesses, the exact inverse of what they asked for.
function applyPoolFilters(leads: Lead[], params: SearchParams): Lead[] {
  let out = leads
  if (params.noWebsite === true) {
    out = out.filter((l) => !l.website)
  }
  if (params.hasWebsite === true) {
    out = out.filter((l) => !!l.website)
  }
  if (params.hasPhone === true) {
    out = out.filter((l) => !!l.phone)
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
    // NEVER trust a client-supplied resolved location: the cache key comes from
    // the location text, so spoofed coordinates could poison the shared pool.
    body.resolved = undefined

    // ── Location mode detection ───────────────────────────────────────────────
    // One location box, two modes: a 5-digit input with country US (or none) is
    // the existing US ZIP fast path; anything else is a worldwide free-text
    // search ("Berlin, Germany", "Dubai", a UK postcode, ...). A 5-digit input
    // with a non-US country selected (e.g. "10117" + Germany) is free text.
    const rawZip = (body.zipCode ?? '').trim()
    const rawLocation = (body.location ?? '').trim()
    const countryCode = (body.countryCode ?? '').trim().toUpperCase()
    const usIntent = countryCode === '' || countryCode === 'US'
    const zipInput = isUsZip(rawZip) ? rawZip : isUsZip(rawLocation) ? rawLocation : ''

    if (usIntent && zipInput) {
      // ZIP fast path — normalize so cache keys and history match legacy rows
      body.zipCode = zipInput
      body.location = undefined
      body.radiusKm = undefined
    } else {
      const locationText = rawLocation || rawZip
      if (!locationText) {
        return NextResponse.json(
          { error: 'Enter a ZIP code or a city, like "London, UK"' },
          { status: 400 }
        )
      }
      if (usIntent && /^\d+$/.test(locationText)) {
        return NextResponse.json(
          { error: 'Enter a valid 5-digit US ZIP code, or a city like "London, UK"' },
          { status: 400 }
        )
      }
      body.location = locationText
      body.zipCode = ''
      // Clamp the international radius to the provider bias cap (50 km)
      if (typeof body.radiusKm === 'number' && Number.isFinite(body.radiusKm)) {
        body.radiusKm = Math.min(Math.max(body.radiusKm, 1), 50)
      } else {
        body.radiusKm = undefined
      }
    }
    if (typeof body.radiusMiles !== 'number' || !Number.isFinite(body.radiusMiles)) {
      body.radiusMiles =
        body.radiusKm != null ? Math.round(body.radiusKm * 0.621371 * 100) / 100 : 25
    }

    const isSupabaseConfigured =
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder.supabase.co'

    // ── Cache check ───────────────────────────────────────────────────────────
    // Guarded by its own anonymous throttle. A cache HIT costs nothing at the
    // provider, but the cached pool IS the product: names, addresses, phones,
    // ratings. Cache keys are trivially enumerable (zip|category|radius) and the
    // leads_cache policy allows anon SELECT, so an unguarded hit path let a
    // logged-out client walk every warm key and drain the corpus without an
    // account, never reaching the limits further down. Cheap, so it runs first.
    if (isSupabaseConfigured) {
      try {
        const { createClient } = await import('@/lib/supabase/server')
        const supabase = await createClient()

        // A cache HIT returns leads and never reaches the gate further down, so
        // the deactivated check has to happen HERE too. Without it a deactivated
        // account could still pull the product out of every warm cache key.
        const cacheAuth = await requireActiveUser(supabase)
        if (!cacheAuth.ok && cacheAuth.reason === 'deactivated') {
          return cacheAuth.response
        }

        if (!cacheAuth.ok) {
          const ip = getClientIp(request)
          try {
            const burst = await checkRateLimit(anonSearchBurstLimiter, ip)
            if (!burst.success) {
              return NextResponse.json(
                { error: 'Too many requests', retryAfter: burst.retryAfter },
                { status: 429, headers: { 'Retry-After': String(burst.retryAfter) } }
              )
            }
          } catch (err) {
            // Fail closed: an unmetered cache path is a scraping hole.
            console.warn('[search] anon cache-read limiter error, failing closed', err)
            return NextResponse.json(
              { error: 'Too many requests', retryAfter: 60 },
              { status: 429, headers: { 'Retry-After': '60' } }
            )
          }
        }

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
          // baked into the shared cached pool. Reuses the session resolved above
          // rather than asking the auth server a second time.
          try {
            if (cacheAuth.ok) {
              const { user } = cacheAuth
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
          // Derive fetchedAt from expires_at - TTL. leads_cache has no fetched_at
          // column, so this is only correct while EVERY writer uses the shared
          // CACHE_TTL_MS — which they now do (the prefetch cron used to write 24h
          // here, making cron-warmed rows look 12 hours fresher than they were).
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
            // Cache rows don't store a normalized label; echo the searched text
            // so the results header can still say "42 leads in Berlin, Germany".
            locationLabel: body.location || undefined,
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
      let auth: RequireActiveUserResult | null = null
      try {
        supabase = await createClient()
        // One round trip covers the deactivated check AND the plan/role this
        // route already needed for its caps.
        auth = await requireActiveUser(supabase, { columns: ['plan', 'role'] })
      } catch {
        // Couldn't establish a session — treat as anonymous (strictest gate).
        supabase = null
        auth = null
      }

      // A deactivated account must NOT fall through to the anonymous branch:
      // that would hand it the logged-out daily allowance of billable searches.
      // It is a hard 403. Genuinely logged-out callers are unaffected.
      if (auth && !auth.ok && auth.reason === 'deactivated') {
        return auth.response
      }

      if (!auth?.ok || !supabase) {
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
        const { user } = auth
        // Defaults are the STRICTEST tier (free) so a profile-read outage can't
        // silently unlock paid-tier behavior. Caps below still apply.
        const plan = (auth.profile?.plan as string | undefined) ?? 'free'
        const role = (auth.profile?.role as string | undefined) ?? 'user'
        let searchCount = 0
        try {
          const { data: usage } = await supabase
            .from('usage_limits')
            .select('searches_this_month')
            .eq('user_id', user.id)
            .maybeSingle()
          searchCount = usage?.searches_this_month ?? 0
        } catch {
          // Usage read failed — treat as 0 used; the rate limiter above and the
          // daily fair-use cap below still bound the damage.
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
        // API cost. Cache hits return before this point and never bill, so they
        // don't count. Admins exempt.
        //
        // The count comes from usage_limits.searches_today, NOT from
        // search_history. Those were the same table, and DELETE /api/history
        // lets a user clear their own history with the service role, so the cap
        // could be reset at will by clearing history between batches. The
        // counter is service-role/RPC written and user-readable only.
        // Falls back to the old history count until the daily-counter migration
        // has been applied.
        if (role !== 'admin' && plan !== 'free') {
          try {
            const startOfDay = new Date()
            startOfDay.setUTCHours(0, 0, 0, 0)
            const today = startOfDay.toISOString().slice(0, 10)

            let todayCount: number | null = null
            const { data: usageRow } = await supabase
              .from('usage_limits')
              .select('searches_today, searches_today_date')
              .eq('user_id', user.id)
              .maybeSingle()

            if (usageRow && 'searches_today' in usageRow) {
              // A stale date means the counter belongs to a previous day.
              todayCount =
                usageRow.searches_today_date === today
                  ? (usageRow.searches_today as number) ?? 0
                  : 0
            } else {
              const { count } = await supabase
                .from('search_history')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', user.id)
                .gte('created_at', startOfDay.toISOString())
              todayCount = count ?? 0
            }

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

    // ── Geocode the location ONCE, server-side ────────────────────────────────
    // Validates the input with a friendly error BEFORE any billable provider
    // call, and hands the resolved coordinates to every provider so fallback
    // chains don't re-geocode. Geocoder outages fall through: providers resolve
    // on their own (preserving the old behavior for transient failures).
    try {
      body.resolved = await resolveSearchLocation(body)
    } catch (err) {
      if (err instanceof LocationNotFoundError || (err as Error)?.name === 'LocationNotFoundError') {
        const searched = body.location || body.zipCode
        return NextResponse.json(
          {
            error: `We couldn't find "${searched}". Try a format like "London, UK" or "Berlin, Germany", or check the country selector.`,
          },
          { status: 422 }
        )
      }
      console.warn('[search] geocode resolution failed — providers will retry', err)
      body.resolved = undefined
    }

    // ── Live fetch (the billable provider call) ───────────────────────────────
    // Send the provider the POOL-defining params only. minRating / hasWebsite /
    // hasPhone are pure post-filters in every provider (they do not change the
    // upstream query or its cost), so withholding them costs nothing and keeps the
    // pool we are about to cache raw and reusable. They are applied to the response
    // by applyPoolFilters below, exactly as they already are on a cache HIT — so
    // the caller sees the same leads either way.
    const providerParams: SearchParams = {
      ...body,
      minRating: undefined,
      hasWebsite: undefined,
      hasPhone: undefined,
    }
    const results = await searchLeads(providerParams)

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
            // ZIP searches store the ZIP as always; international searches store
            // the location display text in the same (text) column, so history
            // and its Rerun links keep working without a schema change.
            zip_code: body.location || body.zipCode,
            // Integer column, always miles (10 km ≈ 6 mi) — the search page
            // converts back to the nearest km option on rerun.
            radius: Math.max(1, Math.round(effectiveRadiusMiles(body))),
            category: body.category || '',
            keyword: body.keyword || '',
            result_count: results.total,
          })

          // increment_daily_searches bumps BOTH the monthly total and the
          // tamper-proof daily counter the fair-use cap reads, rolling the day
          // over itself. It is SECURITY DEFINER, so the session client is fine.
          // Older databases only have increment_searches, so fall back to it
          // until the daily-counter migration has been applied; the cap falls
          // back to counting history in exactly that case.
          let { error: rpcError } = await supabase.rpc('increment_daily_searches', {
            uid: user.id,
          })
          if (rpcError) {
            ;({ error: rpcError } = await supabase.rpc('increment_searches', { uid: user.id }))
          }
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

    return NextResponse.json({
      ...results,
      source: results.source,
      fetchedAt: new Date().toISOString(),
      locationLabel: results.locationLabel ?? body.resolved?.displayName ?? body.location ?? undefined,
    })
  } catch (error) {
    console.error('Lead search error:', error)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
