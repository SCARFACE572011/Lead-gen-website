import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { requirePlatformAdmin } from '@/lib/admin-auth'
import type { BillingSubscription } from '@/app/(dashboard)/admin/types'

function serviceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function GET() {
  const supabase = await createServerClient()
  const admin = await requirePlatformAdmin(supabase)
  if (!admin.ok) return admin.response

  const db = serviceClient()
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const [subsRes, totalUsersRes] = await Promise.all([
    db
      .from('subscriptions')
      .select(`
        id, user_id, stripe_customer_id, stripe_subscription_id, plan, status,
        current_period_start, current_period_end, created_at, updated_at,
        users_profile!inner(email, full_name, company_name)
      `)
      .order('created_at', { ascending: false }),
    db.from('users_profile').select('*', { count: 'exact', head: true }),
  ])

  const rawSubs = subsRes.data ?? []
  const totalUsers = totalUsersRes.count ?? 0

  const subscriptions: BillingSubscription[] = rawSubs.map((s) => {
    const up = Array.isArray(s.users_profile) ? s.users_profile[0] : s.users_profile
    return {
      id: s.id,
      userId: s.user_id,
      email: (up as { email: string } | null)?.email ?? '',
      fullName: (up as { full_name: string | null } | null)?.full_name ?? null,
      companyName: (up as { company_name: string | null } | null)?.company_name ?? null,
      stripeCustomerId: s.stripe_customer_id ?? null,
      stripeSubscriptionId: s.stripe_subscription_id ?? null,
      plan: s.plan,
      status: s.status,
      currentPeriodStart: s.current_period_start ?? null,
      currentPeriodEnd: s.current_period_end ?? null,
      createdAt: s.created_at,
    }
  })

  const proCount = subscriptions.filter(s => s.plan === 'pro' && s.status === 'active').length
  const agencyCount = subscriptions.filter(s => s.plan === 'agency' && s.status === 'active').length
  const mrr = proCount * 25 + agencyCount * 50
  const totalSubscribers = proCount + agencyCount

  const newThisMonth = subscriptions.filter(
    s => s.plan !== 'free' && new Date(s.createdAt) >= monthStart
  ).length

  const churnedThisMonth = rawSubs.filter(
    s => s.status === 'cancelled' && new Date(s.updated_at) >= monthStart
  ).length

  const conversionRate = totalUsers > 0
    ? Math.round((totalSubscribers / totalUsers) * 100 * 10) / 10
    : 0

  return NextResponse.json({
    subscriptions,
    summary: {
      mrr,
      totalSubscribers,
      proCount,
      agencyCount,
      newThisMonth,
      churnedThisMonth,
      conversionRate,
    },
  })
}
