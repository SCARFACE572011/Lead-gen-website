import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { pgrestIlikePattern } from '@/lib/utils'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '25')))
  const search = searchParams.get('search') ?? ''
  const planFilter = searchParams.get('plan') ?? ''
  const statusFilter = searchParams.get('status') ?? ''
  const sort = searchParams.get('sort') ?? 'created_at'
  const order = searchParams.get('order') === 'asc'

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const validSorts = ['created_at', 'email', 'plan', 'status']
  const sortCol = validSorts.includes(sort) ? sort : 'created_at'

  let query = db
    .from('users_profile')
    .select('id, email, full_name, company_name, role, plan, status, admin_notes, created_at', { count: 'exact' })
    .order(sortCol, { ascending: order })
    .range((page - 1) * limit, page * limit - 1)

  if (search) {
    const pattern = pgrestIlikePattern(search)
    query = query.or(`email.ilike.${pattern},full_name.ilike.${pattern}`)
  }
  if (planFilter) query = query.eq('plan', planFilter)
  if (statusFilter) query = query.eq('status', statusFilter)

  const { data, count, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const userIds = (data ?? []).map((u: Record<string, unknown>) => u.id as string)

  const [usageRes, subRes] = await Promise.all([
    userIds.length > 0
      ? db.from('usage_limits').select('user_id, searches_this_month, saved_leads_count, exports_count, last_reset_at').in('user_id', userIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    userIds.length > 0
      ? db.from('subscriptions').select('user_id, stripe_customer_id, stripe_subscription_id, plan, status, current_period_start, current_period_end').in('user_id', userIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
  ])

  const usageMap = Object.fromEntries((usageRes.data ?? []).map((u: Record<string, unknown>) => [u.user_id as string, u]))
  const subMap = Object.fromEntries((subRes.data ?? []).map((s: Record<string, unknown>) => [s.user_id as string, s]))

  const users = (data ?? []).map((u: Record<string, unknown>) => ({
    ...u,
    usage: usageMap[u.id as string] ?? null,
    subscription: subMap[u.id as string] ?? null,
  }))

  return NextResponse.json({
    users,
    total: count ?? 0,
    page,
    limit,
    totalPages: Math.ceil((count ?? 0) / limit),
  })
}
