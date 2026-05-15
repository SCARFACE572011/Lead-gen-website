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
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const isSupabaseConfigured =
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder.supabase.co'

  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })
  }

  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()

  // Get the top 20 most-searched ZIP+category combos
  const { data: topSearches, error } = await supabase
    .from('search_history')
    .select('zip_code, category')
    .not('zip_code', 'is', null)
    .not('category', 'is', null)
    .neq('category', '')
    .limit(200) // pull enough rows to dedupe and count

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
      await supabase.from('leads_cache').upsert({
        cache_key: cacheKey,
        leads: result.leads,
        total: result.total,
        source: process.env.GOOGLE_PLACES_API_KEY ? 'google_places' : 'osm',
        expires_at: new Date(Date.now() + CACHE_TTL_MS).toISOString(),
      })

      prefetched++
    } catch {
      errors++
    }
  }

  return NextResponse.json({ prefetched, errors, total: top20.length })
}
