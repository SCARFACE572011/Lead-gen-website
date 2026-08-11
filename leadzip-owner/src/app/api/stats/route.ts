import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { PLAN_PRICES } from '@/lib/pricing'

export async function GET() {
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const [usersRes, subsRes, signupsRes, cancelledRes] = await Promise.all([
    db.from('users_profile').select('id, plan, status, created_at'),
    db.from('subscriptions').select('user_id, plan, status, current_period_end, created_at, updated_at'),
    db.from('users_profile').select('created_at').gte('created_at', thirtyDaysAgo),
    db.from('subscriptions').select('user_id').eq('status', 'cancelled').gte('updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
  ])

  const users = usersRes.data ?? []
  const subs = subsRes.data ?? []

  const totalUsers = users.length
  const activeUsers = users.filter(u => u.status === 'active').length
  const proCount = subs.filter(s => s.plan === 'pro' && s.status === 'active').length
  const agencyCount = subs.filter(s => s.plan === 'agency' && s.status === 'active').length
  const activeSubscribers = proCount + agencyCount
  const mrr = proCount * PLAN_PRICES.pro + agencyCount * PLAN_PRICES.agency
  const arr = mrr * 12

  const monthStart30dAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()).toISOString()
  const activeLastMonth = users.filter(u => new Date(u.created_at) < new Date(monthStart)).length
  const growthPct = activeLastMonth > 0 ? Math.round(((totalUsers - activeLastMonth) / activeLastMonth) * 100) : 0

  const newSignupsToday = users.filter(u => u.created_at >= todayStart).length
  const newSignupsThisMonth = users.filter(u => u.created_at >= monthStart).length

  const subsLast30 = subs.filter(s => new Date(s.created_at) >= new Date(monthStart30dAgo))
  const cancelledLast30 = subs.filter(s => s.status === 'cancelled' && s.updated_at && new Date(s.updated_at) >= new Date(monthStart30dAgo))
  const churnRate = subsLast30.length > 0 ? Math.round((cancelledLast30.length / Math.max(subsLast30.length, 1)) * 100) : 0

  // Plan distribution
  const freeCount = users.filter(u => u.plan === 'free').length
  const planDistribution = { free: freeCount, pro: proCount, agency: agencyCount }

  // Signup trend (last 30 days)
  const signupDays: Record<string, number> = {}
  for (let i = 0; i < 30; i++) {
    const d = new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000)
    signupDays[d.toISOString().slice(0, 10)] = 0
  }
  for (const u of signupsRes.data ?? []) {
    const day = u.created_at.slice(0, 10)
    if (day in signupDays) signupDays[day]++
  }
  const signupTrend = Object.entries(signupDays).map(([date, count]) => ({ date, count }))

  // Alert feed
  const pastDueCount = subs.filter(s => s.status === 'past_due').length
  const trialsExpiring = subs.filter(s =>
    s.status === 'trialing' && s.current_period_end &&
    s.current_period_end <= sevenDaysFromNow
  ).length
  const cancelledToday = cancelledRes.data?.length ?? 0
  const newPaidToday = subs.filter(s =>
    ['pro', 'agency'].includes(s.plan) && s.created_at >= todayStart
  ).length

  return NextResponse.json({
    metrics: {
      totalUsers, activeUsers, activeSubscribers, mrr, arr,
      churnRate, newSignupsToday, newSignupsThisMonth, growthPct,
    },
    alertFeed: { pastDueCount, trialsExpiring, cancelledToday, newPaidToday },
    planDistribution,
    signupTrend,
  })
}
