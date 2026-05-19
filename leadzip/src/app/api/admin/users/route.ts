import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { UserRow } from '@/app/(dashboard)/admin/types'

function serviceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function GET(request: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users_profile')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const db = serviceClient()
  const params = request.nextUrl.searchParams

  const page = Math.max(1, parseInt(params.get('page') ?? '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(params.get('limit') ?? '25', 10)))
  const search = params.get('search')?.trim() ?? ''
  const planFilter = params.get('plan')?.trim() ?? ''
  const statusFilter = params.get('status')?.trim() ?? ''
  const sort = params.get('sort') ?? 'created_at'
  const order = params.get('order') ?? 'desc'

  const validSortCols = ['created_at', 'email', 'plan', 'full_name']
  const sortCol = validSortCols.includes(sort) ? sort : 'created_at'

  let query = db
    .from('users_profile')
    .select(
      `id, email, full_name, company_name, role, plan, status, created_at, updated_at,
       usage_limits(searches_this_month, saved_leads_count, exports_count, last_reset_at),
       subscriptions(stripe_customer_id, stripe_subscription_id, plan, status, current_period_start, current_period_end)`,
      { count: 'exact' }
    )

  if (search) {
    query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`)
  }
  if (planFilter && ['free', 'pro', 'agency'].includes(planFilter)) {
    query = query.eq('plan', planFilter)
  }
  if (statusFilter && ['active', 'deactivated'].includes(statusFilter)) {
    query = query.eq('status', statusFilter)
  }

  query = query
    .order(sortCol, { ascending: order === 'asc' })
    .range((page - 1) * limit, page * limit - 1)

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const users: UserRow[] = (data ?? []).map((u) => {
    const usage = Array.isArray(u.usage_limits) ? u.usage_limits[0] : u.usage_limits
    const sub = Array.isArray(u.subscriptions) ? u.subscriptions[0] : u.subscriptions
    return {
      id: u.id,
      email: u.email,
      full_name: u.full_name ?? null,
      company_name: u.company_name ?? null,
      role: u.role,
      plan: u.plan,
      status: u.status ?? 'active',
      created_at: u.created_at,
      updated_at: u.updated_at,
      usage: usage ?? null,
      subscription: sub ?? null,
    }
  })

  const total = count ?? 0
  return NextResponse.json({
    users,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  })
}
