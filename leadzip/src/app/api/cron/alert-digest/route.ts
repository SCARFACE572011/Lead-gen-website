// src/app/api/cron/alert-digest/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'
import { searchLeadsCombined } from '@/lib/providers/combinedProvider'
import type { SearchParams } from '@/types/lead'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://leadzip.vercel.app'

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
})

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Fetch all alert-enabled saved searches
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

  // Batch-fetch user profiles for all unique user IDs
  const userIds = [...new Set(savedSearches.map((s) => s.user_id as string))]
  const { data: profiles } = await supabase
    .from('users_profile')
    .select('id, email, full_name')
    .in('id', userIds)

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

      const result = await searchLeadsCombined(params)
      const newIds = result.leads.map((l) => l.id)
      const lastIds: string[] = (row.last_place_ids as string[]) ?? []
      const newLeads = result.leads.filter((l) => !lastIds.includes(l.id))

      if (newLeads.length > 0) {
        const profile = profileMap.get(row.user_id as string)
        if (profile) {
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
            `→ View in LeadZip: ${searchUrl}`,
            '',
            '────',
            businessList,
            '',
            `Manage your saved searches:\n${siteUrl}/saved-searches`,
            '',
            '— LeadZip',
          ].join('\n')

          await transporter.sendMail({
            from: `"LeadZip" <${process.env.GMAIL_USER}>`,
            to: profile.email,
            subject,
            text,
          })

          emailed++
        }
      }

      // Update snapshot — only reached if email sent successfully (or no new leads)
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
