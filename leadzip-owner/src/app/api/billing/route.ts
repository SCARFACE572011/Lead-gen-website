import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { stripe } from '@/lib/stripe'
import { PLAN_PRICES } from '@/lib/pricing'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const statusFilter = searchParams.get('status') ?? ''

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  let subsQuery = db
    .from('subscriptions')
    .select('id, user_id, stripe_customer_id, stripe_subscription_id, plan, status, current_period_start, current_period_end, created_at, updated_at')
    .order('created_at', { ascending: false })

  if (statusFilter) subsQuery = subsQuery.eq('status', statusFilter)

  const [subsRes, usersCountRes] = await Promise.all([
    subsQuery,
    db.from('users_profile').select('id', { count: 'exact' }),
  ])

  const subs = (subsRes.data ?? []) as Record<string, unknown>[]
  const totalUsers = usersCountRes.count ?? 0

  // Fetch user profiles separately (no foreign keys)
  const userIds = subs.map(s => s.user_id as string).filter(Boolean)
  let profileMap: Record<string, { email: string; full_name: string | null }> = {}
  if (userIds.length > 0) {
    const { data: profiles } = await db
      .from('users_profile')
      .select('id, email, full_name')
      .in('id', userIds)
    profileMap = Object.fromEntries((profiles ?? []).map((p: Record<string, unknown>) => [p.id as string, { email: p.email as string, full_name: p.full_name as string | null }]))
  }

  // Live MRR from Stripe
  let liveMrr = 0
  try {
    const stripeSubs = await stripe.subscriptions.list({ status: 'active', limit: 100 })
    liveMrr = stripeSubs.data.reduce((sum, s) => {
      const amt = s.items.data[0]?.price?.unit_amount ?? 0
      return sum + amt / 100
    }, 0)
  } catch {
    const proCount = subs.filter(s => s.plan === 'pro' && s.status === 'active').length
    const agencyCount = subs.filter(s => s.plan === 'agency' && s.status === 'active').length
    liveMrr = proCount * PLAN_PRICES.pro + agencyCount * PLAN_PRICES.agency
  }

  const arr = liveMrr * 12
  const activePaid = subs.filter(s => ['active', 'trialing'].includes(s.status as string) && s.plan !== 'free')
  const totalSubscribers = activePaid.length
  const proCount = subs.filter(s => s.plan === 'pro' && s.status === 'active').length
  const agencyCount = subs.filter(s => s.plan === 'agency' && s.status === 'active').length
  const newThisMonth = subs.filter(s => (s.created_at as string) >= monthStart && s.plan !== 'free').length
  const churnedThisMonth = subs.filter(s => s.status === 'cancelled' && s.updated_at && (s.updated_at as string) >= monthStart).length
  const churnedMrr = churnedThisMonth * PLAN_PRICES.pro
  const arpu = totalSubscribers > 0 ? Math.round((liveMrr / totalSubscribers) * 100) / 100 : 0
  const conversionRate = totalUsers > 0 ? Math.round((totalSubscribers / totalUsers) * 1000) / 10 : 0

  const subscriptions = subs.map(s => {
    const profile = profileMap[s.user_id as string]
    return {
      id: s.id,
      userId: s.user_id,
      email: profile?.email ?? '',
      fullName: profile?.full_name ?? null,
      stripeCustomerId: s.stripe_customer_id,
      stripeSubscriptionId: s.stripe_subscription_id,
      plan: s.plan,
      status: s.status,
      currentPeriodStart: s.current_period_start,
      currentPeriodEnd: s.current_period_end,
      createdAt: s.created_at,
    }
  })

  return NextResponse.json({
    subscriptions,
    summary: { mrr: liveMrr, arr, totalSubscribers, proCount, agencyCount, newThisMonth, churnedThisMonth, churnedMrr, arpu, conversionRate },
  })
}
