import { NextRequest, NextResponse } from 'next/server'
import { searchLeads } from '@/lib/providers/leadDataProvider'
import type { SearchParams } from '@/types/lead'
import { searchLimiterFree, searchLimiterPaid, checkRateLimit } from '@/lib/ratelimit'

const CACHE_TTL_MS = 2 * 60 * 60 * 1000 // 2 hours

function buildCacheKey(params: SearchParams): string {
  // Cache by the raw search pool — keyword/filters are applied after retrieval
  const zip = params.zipCode.trim()
  const cat = (params.category || '').trim()
  const radius = params.radiusMiles ?? 25
  return `${zip}|${cat}|${radius}`
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

        if (cached) {
          const firstWithCoords = (cached.leads as { latitude?: number; longitude?: number }[])
            .find((l) => l.latitude != null && l.longitude != null)
          // Approximate fetchedAt from expires_at - TTL
          const fetchedAt = cached.expires_at
            ? new Date(new Date(cached.expires_at as string).getTime() - CACHE_TTL_MS).toISOString()
            : new Date().toISOString()
          return NextResponse.json({
            leads: cached.leads,
            total: cached.total,
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

          // Rate limit: 15 req/min (free) or 60 req/min (paid/admin)
          const limiter = (role === 'admin' || plan !== 'free') ? searchLimiterPaid : searchLimiterFree
          const { success: rlOk, retryAfter } = await checkRateLimit(limiter, user.id)
          if (!rlOk) {
            return NextResponse.json(
              { error: 'Too many requests', retryAfter },
              { status: 429, headers: { 'Retry-After': String(retryAfter) } }
            )
          }

          // Admins and paid users have unlimited searches
          if (role !== 'admin' && plan === 'free' && searchCount >= FREE_LIMIT) {
            return NextResponse.json(
              { error: 'Monthly search limit reached. Upgrade to Pro for unlimited searches.', limitReached: true },
              { status: 429 }
            )
          }
        }
      } catch {
        // Non-fatal — don't block search if limit check fails
      }
    }

    // ── Live fetch ────────────────────────────────────────────────────────────
    const results = await searchLeads(body)

    // Apply new post-filters not handled by providers
    if (body.noWebsite === true) {
      results.leads = results.leads.filter((l) => !l.website)
      results.total = results.leads.length
    }
    if (body.minReviews != null && body.minReviews > 0) {
      results.leads = results.leads.filter((l) => (l.reviewCount ?? 0) >= body.minReviews!)
      results.total = results.leads.length
    }

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
        if (serviceRoleKey && process.env.NEXT_PUBLIC_SUPABASE_URL) {
          const { createClient: createAdminClient } = await import('@supabase/supabase-js')
          const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL, serviceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false },
          })
          await admin.from('leads_cache').upsert({
            cache_key: cacheKey,
            leads: results.leads,
            total: results.total,
            source: results.source ?? 'osm',
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
