import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { isAdminEmail } from '@/lib/admin-auth'
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

  if (profile?.role !== 'admin' || !isAdminEmail(user.email)) {
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
    // usage_limits + subscriptions are fetched separately below and merged in
    // code — NOT via a PostgREST embed. The embed needs FK constraints between
    // users_profile and those tables; without them PostgREST returns PGRST200
    // and the whole Users tab hangs on "Loading…". Separate fetches are robust
    // regardless of FK state.
    .select(
      `id, email, full_name, company_name, role, plan, status, created_at, updated_at`,
      { count: 'exact' }
    )

  if (search) {
    // Strip characters that could break out of the PostgREST .or() filter
    // (comma separates conditions, parens group, %/* are wildcards, \ escapes).
    const safeSearch = search.replace(/[,()%*\\]/g, '')
    if (safeSearch) {
      query = query.or(`email.ilike.%${safeSearch}%,full_name.ilike.%${safeSearch}%`)
    }
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

  const rows = data ?? []
  const ids = rows.map((u) => u.id)

  // Fetch usage + subscriptions for just this page of users, then merge.
  const usageMap = new Map<string, UserRow['usage']>()
  const subMap = new Map<string, UserRow['subscription']>()
  if (ids.length) {
    const [usageRes, subRes] = await Promise.all([
      db
        .from('usage_limits')
        .select('user_id, searches_this_month, saved_leads_count, exports_count, last_reset_at')
        .in('user_id', ids),
      db
        .from('subscriptions')
        .select('user_id, stripe_customer_id, stripe_subscription_id, plan, status, current_period_start, current_period_end')
        .in('user_id', ids),
    ])
    for (const r of usageRes.data ?? []) {
      usageMap.set(r.user_id, {
        searches_this_month: r.searches_this_month ?? 0,
        saved_leads_count: r.saved_leads_count ?? 0,
        exports_count: r.exports_count ?? 0,
        last_reset_at: r.last_reset_at,
      })
    }
    for (const r of subRes.data ?? []) {
      subMap.set(r.user_id, {
        stripe_customer_id: r.stripe_customer_id ?? null,
        stripe_subscription_id: r.stripe_subscription_id ?? null,
        plan: r.plan,
        status: r.status,
        current_period_start: r.current_period_start ?? null,
        current_period_end: r.current_period_end ?? null,
      })
    }
  }

  const users: UserRow[] = rows.map((u) => ({
    id: u.id,
    email: u.email,
    full_name: u.full_name ?? null,
    company_name: u.company_name ?? null,
    role: u.role,
    plan: u.plan,
    status: u.status ?? 'active',
    created_at: u.created_at,
    updated_at: u.updated_at,
    usage: usageMap.get(u.id) ?? null,
    subscription: subMap.get(u.id) ?? null,
  }))

  const total = count ?? 0
  return NextResponse.json({
    users,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  })
}
