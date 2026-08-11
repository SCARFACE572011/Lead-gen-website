import { NextRequest, NextResponse } from 'next/server'
import { searchLeadsCombined } from '@/lib/providers/combinedProvider'
import type { SearchParams } from '@/types/lead'

// Vercel Cron: runs nightly at 3am UTC (see vercel.json)
// Reads the 20 most-searched ZIP+category combos from search_history and pre-warms the cache.
// Secure this route with CRON_SECRET env var.

const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24h for pre-fetched results

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

  // Count frequency and dedupe
  const freqMap = new Map<string, { zipCode: string; category: string; count: number }>()
  for (const row of topSearches) {
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

  for (const { zipCode, category } of top20) {
    try {
      const params: SearchParams = {
        zipCode,
        category,
        radiusMiles: 25,
      }

      const result = await searchLeadsCombined(params)

      const cacheKey = `${zipCode}|${category}|25`
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

  return NextResponse.json({ prefetched, errors, total: top20.length })
}
