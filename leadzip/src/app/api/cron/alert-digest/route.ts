import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'
import { searchLeadsCombined } from '@/lib/providers/combinedProvider'
import type { SearchParams, SearchResult, Lead } from '@/types/lead'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://leadzipp.com'

// Cache TTL — keep in sync with src/app/api/leads/search/route.ts (12h). Every
// cache MISS bills the paid Google Places API, so alert diffs must reuse the same
// leads_cache pool the search route warms instead of re-billing on every run.
const CACHE_TTL_MS = 12 * 60 * 60 * 1000 // 12 hours

// Raw-pool cache key. MUST match buildCacheKey() in the search route so the cron
// and interactive searches share cache entries: zip | category | radius only.
function buildCacheKey(params: SearchParams): string {
  const zip = params.zipCode.trim()
  const cat = (params.category || '').trim()
  const radius = params.radiusMiles ?? 25
  return `${zip}|${cat}|${radius}`
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
      const params: SearchParams = {
        zipCode: row.zip as string,
        radiusMiles: row.radius as number,
        category: row.category as string,
        keyword: (row.keyword as string | null) ?? undefined,
      }

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
        const searchUrl = [
          `${siteUrl}/search`,
          `?zip=${encodeURIComponent(row.zip as string)}`,
          `&radius=${row.radius}`,
          `&category=${encodeURIComponent(row.category as string)}`,
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
