import { NextRequest, NextResponse } from 'next/server'
import { searchLeadsCombined } from '@/lib/providers/combinedProvider'
import { buildCacheKey, CACHE_TTL_MS } from '@/lib/leadsCache'
import { isUsZip } from '@/lib/geocode'
import type { SearchParams } from '@/types/lead'

// Vercel Cron: runs nightly at 3am UTC (see vercel.json)
// Reads the 20 most-searched ZIP+category combos from search_history and pre-warms the cache.
// Secure this route with CRON_SECRET env var.
//
// US ZIP ROWS ONLY — see the filter below for why international rows are skipped
// rather than warmed.
//
// TTL: this cron used to write its own 24h expiry into rows every other module
// treats as 12h. That did not just make rows outlive their intended freshness —
// the search route derives a row's fetched-at time as `expires_at - 12h` for the
// UI freshness badge (leads_cache has no fetched_at column), so a cron-warmed row
// reported itself as 12 hours newer than it actually was. It now uses the shared
// CACHE_TTL_MS, which makes that derivation correct again.

export async function GET(request: NextRequest) {
  // Verify the request is from Vercel Cron (or manual trigger with the secret)
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const isSupabaseConfigured =
    supabaseUrl &&
    supabaseUrl !== 'https://placeholder.supabase.co' &&
    serviceRoleKey

  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })
  }

  // Service-role client: search_history is RLS-protected (auth.uid() = user_id),
  // and a cron invocation has no user session, so the anon client sees 0 rows.
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Get the top 20 most-searched ZIP+category combos from recent history
  const { data: topSearches, error } = await supabase
    .from('search_history')
    .select('zip_code, category')
    .not('zip_code', 'is', null)
    .not('category', 'is', null)
    .neq('category', '')
    .order('created_at', { ascending: false })
    .limit(2000) // pull enough recent rows to dedupe and count

  if (error || !topSearches) {
    return NextResponse.json({ error: 'Failed to read search history' }, { status: 500 })
  }

  // Count frequency and dedupe.
  //
  // SKIP INTERNATIONAL ROWS. search_history stores a worldwide search's location
  // text ("Berlin, Germany") in the same `zip_code` column and carries no country
  // code, so this cron used to warm the LEGACY-shaped key "Berlin, Germany|Plumbers|25"
  // for them. No interactive international search can ever read that key: those
  // build `intl:{cc}:{location}|{category}|{km}km`. Every such row was a wasted
  // billable Google Places call (up to 20 a night) writing a row nobody reads.
  //
  // Building the intl key instead is NOT safe from this table. The key needs the
  // country code and the km radius, and search_history has neither: the country is
  // unrecoverable for text like "Cambridge", and guessing it wrong is worse than
  // not warming at all, because leads_cache is a SHARED pool — a "Cambridge"
  // geocoded with no country bias lands in Massachusetts, and warming that under a
  // UK key would serve wrong-continent leads to every later reader for the full
  // 12h TTL. The radius is equally unknown (this cron hardcodes 25 miles, which is
  // ~40 km, not one of the 1/5/10/25/50 km options the UI offers), so even a
  // correct country would produce a key no interactive search asks for.
  //
  // Skipping is therefore both the correct and the cheaper choice. Warming
  // international searches properly needs country_code + radius_km columns on
  // search_history and a writer for them in the search route; until then this cron
  // stays on the ZIP path it was written for. Skipped rows are reported as
  // skippedNonZip so the gap stays visible in the cron logs.
  //
  // A 5-digit foreign postcode (Berlin's "10117") is indistinguishable from a US
  // ZIP in this column and still takes the ZIP path, exactly as it did before —
  // it warms a legitimate US ZIP key, so nothing is corrupted, just unhelpful.
  const freqMap = new Map<string, { zipCode: string; category: string; count: number }>()
  let skippedNonZip = 0
  for (const row of topSearches) {
    if (!isUsZip(String(row.zip_code ?? ''))) {
      skippedNonZip++
      continue
    }
    const key = `${row.zip_code}|${row.category}`
    const existing = freqMap.get(key)
    if (existing) {
      existing.count++
    } else {
      freqMap.set(key, { zipCode: row.zip_code, category: row.category, count: 1 })
    }
  }

  const top20 = [...freqMap.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 20)

  let prefetched = 0
  let errors = 0
  let skipped = 0

  for (const { zipCode, category } of top20) {
    try {
      const params: SearchParams = {
        zipCode,
        category,
        radiusMiles: 25,
      }

      const result = await searchLeadsCombined(params)

      // Never cache an EMPTY pool: an empty result is usually a transient provider
      // failure, and caching it would pin "0 results" on this key for the full TTL.
      // Matches the interactive search route's never-cache-empty rule.
      if (result.leads.length === 0) {
        skipped++
        continue
      }

      // Shared builder, so a warmed row is readable by the interactive search.
      // Only US ZIPs reach here (see the filter above), so this is always the
      // legacy `{zip}|{category}|{miles}` key shape.
      const cacheKey = buildCacheKey({ zipCode, category, radiusMiles: 25 })
      const { error: upsertError } = await supabase.from('leads_cache').upsert({
        cache_key: cacheKey,
        leads: result.leads,
        total: result.total,
        source: result.source ?? 'osm',
        expires_at: new Date(Date.now() + CACHE_TTL_MS).toISOString(),
      })

      if (upsertError) {
        console.error(`prefetch-leads: leads_cache upsert failed for ${cacheKey}`, upsertError)
        errors++
        continue
      }

      prefetched++
    } catch (err) {
      console.error('prefetch-leads: search failed', err)
      errors++
    }
  }

  return NextResponse.json({ prefetched, errors, skipped, skippedNonZip, total: top20.length })
}
