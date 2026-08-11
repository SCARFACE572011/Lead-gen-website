import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { pgrestIlikePattern } from '@/lib/utils'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search') ?? ''
  const planFilter = searchParams.get('plan') ?? ''
  const statusFilter = searchParams.get('status') ?? ''

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  let query = db
    .from('users_profile')
    .select(`id, email, full_name, company_name, plan, status, admin_notes, created_at,
      usage_limits(searches_this_month, saved_leads_count, exports_count)`)
    .order('created_at', { ascending: false })

  if (search) {
    const pattern = pgrestIlikePattern(search)
    query = query.or(`email.ilike.${pattern},full_name.ilike.${pattern}`)
  }
  if (planFilter) query = query.eq('plan', planFilter)
  if (statusFilter) query = query.eq('status', statusFilter)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = (data ?? []).map((u: Record<string, unknown>) => {
    const usage = Array.isArray(u.usage_limits) ? (u.usage_limits as Record<string, unknown>[])[0] : u.usage_limits as Record<string, unknown> | null
    return {
      Email: u.email,
      Name: u.full_name || '',
      Company: u.company_name || '',
      Plan: u.plan,
      Status: u.status,
      'Searches/mo': usage?.searches_this_month ?? 0,
      'Saved Leads': usage?.saved_leads_count ?? 0,
      Exports: usage?.exports_count ?? 0,
      Notes: (u.admin_notes as string || '').replace(/,/g, ';').replace(/\n/g, ' '),
      Joined: new Date(u.created_at as string).toLocaleDateString('en-US'),
    }
  })

  const headers = Object.keys(rows[0] ?? {})
  const csv = [
    headers.join(','),
    ...rows.map(r => headers.map(h => `"${String(r[h as keyof typeof r] ?? '').replace(/"/g, '""')}"`).join(','))
  ].join('\n')

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="leadzip-users-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
