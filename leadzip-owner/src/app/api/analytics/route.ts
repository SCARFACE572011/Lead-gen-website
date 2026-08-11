import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const twelveMonthsAgo = new Date()
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)

  const [signupsRes, searchesRes, plansRes, zipRes, catRes, powerRes, mrrSubsRes] = await Promise.all([
    db.from('users_profile').select('created_at').gte('created_at', thirtyDaysAgo),
    db.from('search_history').select('created_at').gte('created_at', thirtyDaysAgo),
    db.from('users_profile').select('plan'),
    db.from('search_history').select('zip_code').gte('created_at', thirtyDaysAgo),
    db.from('search_history').select('category').gte('created_at', thirtyDaysAgo),
    db.from('search_history').select('user_id').order('user_id'),
    db.from('subscriptions').select('plan, status, created_at, updated_at').gte('created_at', twelveMonthsAgo.toISOString()),
  ])

  // 30-day signup trend
  const signupDays: Record<string, number> = {}
  const searchDays: Record<string, number> = {}
  for (let i = 0; i < 30; i++) {
    const d = new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    signupDays[d] = 0
    searchDays[d] = 0
  }
  for (const u of signupsRes.data ?? []) {
    const d = u.created_at.slice(0, 10)
    if (d in signupDays) signupDays[d]++
  }
  for (const s of searchesRes.data ?? []) {
    const d = s.created_at.slice(0, 10)
    if (d in searchDays) searchDays[d]++
  }

  // Plan distribution
  const planCounts: Record<string, number> = { free: 0, pro: 0, agency: 0 }
  for (const u of plansRes.data ?? []) {
    planCounts[u.plan as string] = (planCounts[u.plan as string] ?? 0) + 1
  }
  const planDistribution = Object.entries(planCounts).map(([name, value]) => ({ name, value }))

  // Top ZIPs
  const zipCounts: Record<string, number> = {}
  for (const s of zipRes.data ?? []) {
    if (s.zip_code) zipCounts[s.zip_code] = (zipCounts[s.zip_code] ?? 0) + 1
  }
  const topZips = Object.entries(zipCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([zip, count]) => ({ zip, count }))

  // Top categories
  const catCounts: Record<string, number> = {}
  for (const s of catRes.data ?? []) {
    if (s.category) catCounts[s.category] = (catCounts[s.category] ?? 0) + 1
  }
  const topCategories = Object.entries(catCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([category, count]) => ({ category, count }))

  // Power users (top 10 by search count)
  const userSearchCounts: Record<string, number> = {}
  for (const s of powerRes.data ?? []) {
    if (s.user_id) userSearchCounts[s.user_id] = (userSearchCounts[s.user_id] ?? 0) + 1
  }
  const topUserIds = Object.entries(userSearchCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([id]) => id)

  let powerUsers: unknown[] = []
  if (topUserIds.length > 0) {
    const [puRes, puUsageRes] = await Promise.all([
      db.from('users_profile').select('id, email, full_name, plan, created_at').in('id', topUserIds),
      db.from('usage_limits').select('user_id, searches_this_month').in('user_id', topUserIds),
    ])
    const puUsageMap = Object.fromEntries((puUsageRes.data ?? []).map((u: Record<string, unknown>) => [u.user_id as string, u]))
    powerUsers = (puRes.data ?? []).map((u: Record<string, unknown>) => {
      const usage = puUsageMap[u.id as string]
      return {
        id: u.id,
        email: u.email,
        full_name: u.full_name,
        plan: u.plan,
        created_at: u.created_at,
        total_searches: userSearchCounts[u.id as string] ?? 0,
        searches_this_month: (usage?.searches_this_month as number) ?? 0,
      }
    }).sort((a: Record<string, unknown>, b: Record<string, unknown>) => (b.total_searches as number) - (a.total_searches as number))
  }

  // MRR history (12 months)
  const mrrHistory: { month: string; mrr: number }[] = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() - i)
    const monthKey = d.toISOString().slice(0, 7)
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString()
    const activeThatMonth = (mrrSubsRes.data ?? []).filter((s: Record<string, unknown>) => {
      const created = (s.created_at as string) <= monthEnd
      const notCancelled = s.status !== 'cancelled' || ((s.updated_at as string) > monthEnd)
      return created && notCancelled && s.plan !== 'free'
    })
    const mrr = activeThatMonth.reduce((sum: number, s: Record<string, unknown>) => sum + (s.plan === 'agency' ? 50 : 25), 0)
    mrrHistory.push({ month: monthKey, mrr })
  }

  return NextResponse.json({
    signupTrend: Object.entries(signupDays).map(([date, count]) => ({ date, count })),
    searchTrend: Object.entries(searchDays).map(([date, count]) => ({ date, count })),
    planDistribution,
    topZips,
    topCategories,
    powerUsers,
    mrrHistory,
  })
}
