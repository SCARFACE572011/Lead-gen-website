import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'
import { searchLeadsCombined } from '@/lib/providers/combinedProvider'
import { buildCacheKey, CACHE_TTL_MS } from '@/lib/leadsCache'
import { isUsZip } from '@/lib/geocode'
import type { SearchParams, SearchResult, Lead } from '@/types/lead'
import { SITE_URL } from '@/lib/siteUrl'

const siteUrl = SITE_URL

// Cache key + TTL come from src/lib/leadsCache.ts. Every cache MISS bills the paid
// Google Places API, so alert diffs must reuse the same leads_cache pool the search
// route warms instead of re-billing on every run.

/**
 * Rebuild the SearchParams an interactive search would have used for a saved row,
 * so this cron lands on the SAME cache key.
 *
 * saved_searches stores the location in one text `zip` column: a US ZIP for the ZIP
 * fast path, or free text ("Berlin, Germany") for a worldwide search. Treating that
 * free text as a ZIP built the key "Berlin, Germany|Plumbers|6", which no
 * interactive search can ever produce, so every nightly run re-billed the provider
 * and shared nothing back. Mirroring the search route's own mode detection puts
 * international rows on the "intl:" key instead.
 *
 * country_code and radius_km are FEATURE-DETECTED: saved_searches may or may not
 * have those columns yet (20260812_saved_search_country.sql is applied by hand),
 * and the row comes from a `select('*')`, so a missing column is simply absent.
 * When they are absent this behaves exactly as it did before they existed.
 */
function paramsForSavedSearch(row: Record<string, unknown>): SearchParams {
  const locationText = ((row.zip as string | null) ?? '').trim()
  const countryCode = ((row.country_code as string | null | undefined) ?? '').trim().toUpperCase()
  const usIntent = countryCode === '' || countryCode === 'US'
  const radiusMiles = (row.radius as number | null) ?? 25
  // radius_km is the canonical radius for a worldwide row, because the legacy
  // `radius` column is integer MILES and km -> miles -> km is LOSSY for two of the
  // five radius options the UI offers: 1 km saves as 1 mi and re-keys as 2km,
  // 25 km saves as 16 mi and re-keys as 26km (5/10/50 km land back on themselves).
  // Those two therefore keyed off the interactive cache pool entirely and re-billed
  // the provider every night. Rows saved before the migration have no radius_km, so
  // they keep the old converted-miles behavior rather than changing key mid-life.
  const rawKm = row.radius_km as number | null | undefined
  const radiusKm = typeof rawKm === 'number' && rawKm > 0 ? Math.round(rawKm) : undefined
  const keyword = (row.keyword as string | null) ?? undefined
  const category = (row.category as string | null) ?? ''

  // US ZIP fast path — byte-for-byte the legacy params (no radiusKm, no country),
  // so the legacy cache key `{zip}|{category}|{miles}` is reproduced exactly.
  if (usIntent && isUsZip(locationText)) {
    return { zipCode: locationText, radiusMiles, category, keyword }
  }
  return {
    zipCode: '',
    location: locationText,
    countryCode: countryCode || undefined,
    radiusMiles,
    radiusKm,
    category,
    keyword,
  }
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.error('alert-digest: GMAIL credentials not configured')
    return NextResponse.json({ error: 'Email not configured' }, { status: 503 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('alert-digest: Supabase URL/service role key not configured')
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  })

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: savedSearches, error: fetchError } = await supabase
    .from('saved_searches')
    .select('*')
    .eq('alert_enabled', true)

  if (fetchError) {
    console.error('alert-digest: failed to fetch saved searches', fetchError)
    return NextResponse.json({ error: 'Failed to fetch saved searches' }, { status: 500 })
  }

  if (!savedSearches || savedSearches.length === 0) {
    return NextResponse.json({ processed: 0, emailed: 0 })
  }

  const userIds = [...new Set(savedSearches.map((s) => s.user_id as string))]
  const { data: profiles, error: profilesError } = await supabase
    .from('users_profile')
    .select('id, email, full_name')
    .in('id', userIds)

  if (profilesError) {
    console.error('alert-digest: failed to fetch profiles', profilesError)
  }

  const profileMap = new Map<string, { email: string; full_name?: string }>(
    (profiles ?? []).map((p) => [p.id as string, { email: p.email as string, full_name: p.full_name as string | undefined }])
  )

  let processed = 0
  let emailed = 0

  for (const row of savedSearches) {
    try {
      const params = paramsForSavedSearch(row as Record<string, unknown>)

      // Route through leads_cache first (same key / service-role pattern as the
      // search route). Only fetch live on a MISS, then write the pool back so the
      // next alert run — and interactive searches — reuse it instead of re-billing.
      const cacheKey = buildCacheKey(params)
      let result: SearchResult
      const { data: cached } = await supabase
        .from('leads_cache')
        .select('leads, total, source')
        .eq('cache_key', cacheKey)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle()

      // Empty cached pools are treated as a MISS (transient provider failures
      // must not pin "0 results" for the TTL) — same rule as the search route.
      if (cached && ((cached.leads as Lead[])?.length ?? 0) > 0) {
        const cachedLeads = (cached.leads as Lead[]) ?? []
        result = {
          leads: cachedLeads,
          total: (cached.total as number | null) ?? cachedLeads.length,
          source: (cached.source as string | null) ?? undefined,
        }
      } else {
        result = await searchLeadsCombined(params)
        // Write-through to the cache (service-role client bypasses RLS).
        // Never cache an empty pool — see the empty-MISS rule above.
        if (result.leads.length > 0) {
          await supabase.from('leads_cache').upsert({
            cache_key: cacheKey,
            leads: result.leads,
            total: result.total,
            source: result.source ?? 'osm',
            expires_at: new Date(Date.now() + CACHE_TTL_MS).toISOString(),
          })
        }
      }

      const newIds = result.leads.map((l) => l.id)
      const lastIds: string[] = (row.last_place_ids as string[]) ?? []
      const newLeads = result.leads.filter((l) => !lastIds.includes(l.id))

      if (newLeads.length > 0) {
        const profile = profileMap.get(row.user_id as string)
        if (!profile || !profile.email) {
          // Skip snapshot update — retry next run when profile is available
          console.error(`alert-digest: no profile/email found for user ${row.user_id}, skipping`)
          continue
        }

        const firstName = profile.full_name?.split(' ')[0] ?? 'there'
        const n = newLeads.length
        // The /search page accepts an international location string in ?zip plus
        // ?country and ?radiusKm hints, so pass both through when the row carries
        // them — otherwise the rerun link resolves to a different place (or a
        // different radius, and so a different cache pool) than the alert itself.
        const searchUrl = [
          `${siteUrl}/search`,
          `?zip=${encodeURIComponent(row.zip as string)}`,
          `&radius=${row.radius}`,
          `&category=${encodeURIComponent(row.category as string)}`,
          params.countryCode ? `&country=${encodeURIComponent(params.countryCode)}` : '',
          params.radiusKm != null ? `&radiusKm=${params.radiusKm}` : '',
          row.keyword ? `&keyword=${encodeURIComponent(row.keyword as string)}` : '',
        ].join('')

        const subject = `${n} new lead${n === 1 ? '' : 's'} — "${row.name}"`
        const businessList = newLeads.map((l) => l.businessName).join('\n')
        const text = [
          `Hey ${firstName},`,
          '',
          `Your saved search "${row.name}" found ${n} new business${n === 1 ? '' : 'es'} since yesterday.`,
          '',
          `→ View in LeadZipp: ${searchUrl}`,
          '',
          '────',
          businessList,
          '',
          `Manage your saved searches:\n${siteUrl}/saved-searches`,
          '',
          '— LeadZipp',
        ].join('\n')

        await transporter.sendMail({
          from: `"LeadZipp" <${process.env.GMAIL_USER}>`,
          to: profile.email,
          subject,
          text,
        })

        emailed++
      }

      // Update snapshot after successful email (or when no new leads)
      await supabase
        .from('saved_searches')
        .update({
          last_place_ids: newIds,
          last_run_at: new Date().toISOString(),
        })
        .eq('id', row.id as string)

      processed++
    } catch (err) {
      console.error(`alert-digest: failed for saved search ${row.id}`, err)
    }
  }

  return NextResponse.json({ processed, emailed })
}
