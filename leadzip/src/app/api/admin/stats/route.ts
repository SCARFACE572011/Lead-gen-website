import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { requirePlatformAdmin } from '@/lib/admin-auth'

function serviceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function GET() {
  // Auth check — must be a real admin owner (role + email allowlist)
  const supabase = await createServerClient()
  const admin = await requirePlatformAdmin(supabase)
  if (!admin.ok) return admin.response

  const db = serviceClient()

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29)
  thirtyDaysAgo.setHours(0, 0, 0, 0)

  const [
    usersRes,
    planRes,
    searchCountRes,
    savedCountRes,
    zipRawRes,
    categoryRawRes,
    recentUsersRes,
    signupRawRes,
    searchTrendRawRes,
  ] = await Promise.all([
    db.from('users_profile').select('*', { count: 'exact', head: true }),
    db.from('users_profile').select('plan'),
    db.from('search_history').select('*', { count: 'exact', head: true }),
    db.from('leads').select('*', { count: 'exact', head: true }),
    db.from('search_history').select('zip_code').not('zip_code', 'is', null).neq('zip_code', ''),
    db.from('search_history').select('category').not('category', 'is', null).neq('category', ''),
    db
      .from('users_profile')
      .select('id, email, plan, created_at')
      .order('created_at', { ascending: false })
      .limit(20),
    db.from('users_profile').select('created_at').gte('created_at', thirtyDaysAgo.toISOString()),
    db.from('search_history').select('created_at').gte('created_at', thirtyDaysAgo.toISOString()),
  ])

  // Plan breakdown
  const planCounts: Record<string, number> = { free: 0, pro: 0, agency: 0 }
  for (const row of (planRes.data ?? [])) {
    const p = (row.plan ?? 'free').toLowerCase()
    planCounts[p] = (planCounts[p] ?? 0) + 1
  }
  const totalUsers = usersRes.count ?? 0
  const activeSubs = (planCounts.pro ?? 0) + (planCounts.agency ?? 0)
  const mrr = (planCounts.pro ?? 0) * 25 + (planCounts.agency ?? 0) * 50

  // ZIP chart
  const zipCounts: Record<string, number> = {}
  for (const r of (zipRawRes.data ?? [])) zipCounts[r.zip_code] = (zipCounts[r.zip_code] ?? 0) + 1
  const zipData = Object.entries(zipCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([zip, searches]) => ({ zip, searches }))

  // Category chart
  const catCounts: Record<string, number> = {}
  for (const r of (categoryRawRes.data ?? [])) catCounts[r.category] = (catCounts[r.category] ?? 0) + 1
  const categoryData = Object.entries(catCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, searches]) => ({ name, searches }))

  // Recent users — usage fetched separately (no fragile FK embed, which fails
  // PGRST200 without the users_profile↔usage_limits foreign key).
  const recentRows = recentUsersRes.data ?? []
  const recentUsage = new Map<string, { searches_this_month?: number; saved_leads_count?: number }>()
  if (recentRows.length) {
    const { data: ru } = await db
      .from('usage_limits')
      .select('user_id, searches_this_month, saved_leads_count')
      .in('user_id', recentRows.map((u) => u.id))
    for (const r of ru ?? []) recentUsage.set(r.user_id, r)
  }
  const recentUsers = recentRows.map((u) => {
    const usage = recentUsage.get(u.id)
    return {
      email: u.email,
      plan: u.plan ?? 'free',
      searches: usage?.searches_this_month ?? 0,
      savedLeads: usage?.saved_leads_count ?? 0,
      joined: u.created_at,
    }
  })

  // Build 30-day trend arrays
  const signupBuckets: Record<string, number> = {}
  const searchBuckets: Record<string, number> = {}
  for (let i = 29; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    signupBuckets[key] = 0
    searchBuckets[key] = 0
  }
  for (const row of (signupRawRes.data ?? [])) {
    const key = row.created_at.slice(0, 10)
    if (key in signupBuckets) signupBuckets[key]++
  }
  for (const row of (searchTrendRawRes.data ?? [])) {
    const key = row.created_at.slice(0, 10)
    if (key in searchBuckets) searchBuckets[key]++
  }
  const signupTrend = Object.entries(signupBuckets).map(([date, count]) => ({ date, count }))
  const searchTrend = Object.entries(searchBuckets).map(([date, count]) => ({ date, count }))

  return NextResponse.json({
    totalUsers,
    totalSearches: searchCountRes.count ?? 0,
    savedLeads: savedCountRes.count ?? 0,
    activeSubs,
    planCounts,
    mrr,
    zipData,
    categoryData,
    recentUsers,
    signupTrend,
    searchTrend,
  })
}
