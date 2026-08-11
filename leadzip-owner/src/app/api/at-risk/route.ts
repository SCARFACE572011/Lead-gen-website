import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const now = new Date().toISOString()
  const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const [pastDueRes, trialsRes, inactiveUsersRes] = await Promise.all([
    db.from('subscriptions')
      .select('id, user_id, stripe_customer_id, stripe_subscription_id, plan, current_period_end')
      .eq('status', 'past_due'),
    db.from('subscriptions')
      .select('id, user_id, plan, current_period_end')
      .eq('status', 'trialing')
      .lte('current_period_end', sevenDaysFromNow)
      .gte('current_period_end', now),
    db.from('users_profile')
      .select('id, email, full_name, plan, status')
      .in('plan', ['pro', 'agency'])
      .eq('status', 'active'),
  ])

  // Collect all user IDs to fetch profiles and usage in batch
  const pastDueUserIds = (pastDueRes.data ?? []).map((s: Record<string, unknown>) => s.user_id as string)
  const trialUserIds = (trialsRes.data ?? []).map((s: Record<string, unknown>) => s.user_id as string)
  const inactiveUserIds = (inactiveUsersRes.data ?? []).map((u: Record<string, unknown>) => u.id as string)

  const allSubUserIds = [...new Set([...pastDueUserIds, ...trialUserIds])]

  const [profilesRes, usageRes, inactiveSubsRes] = await Promise.all([
    allSubUserIds.length > 0
      ? db.from('users_profile').select('id, email, full_name, status').in('id', allSubUserIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    inactiveUserIds.length > 0
      ? db.from('usage_limits').select('user_id, searches_this_month, last_reset_at').in('user_id', inactiveUserIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    inactiveUserIds.length > 0
      ? db.from('subscriptions').select('user_id, stripe_customer_id').in('user_id', inactiveUserIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
  ])

  const profileMap = Object.fromEntries((profilesRes.data ?? []).map((p: Record<string, unknown>) => [p.id as string, p]))
  const usageMap = Object.fromEntries((usageRes.data ?? []).map((u: Record<string, unknown>) => [u.user_id as string, u]))
  const inactiveSubMap = Object.fromEntries((inactiveSubsRes.data ?? []).map((s: Record<string, unknown>) => [s.user_id as string, s]))

  const pastDue = (pastDueRes.data ?? []).map((s: Record<string, unknown>) => {
    const profile = profileMap[s.user_id as string]
    const daysOverdue = s.current_period_end
      ? Math.max(0, Math.round((Date.now() - new Date(s.current_period_end as string).getTime()) / (24 * 60 * 60 * 1000)))
      : 0
    return {
      id: s.user_id,
      email: profile?.email,
      full_name: profile?.full_name,
      plan: s.plan,
      stripe_customer_id: s.stripe_customer_id,
      stripe_subscription_id: s.stripe_subscription_id,
      current_period_end: s.current_period_end,
      daysOverdue,
      user_status: profile?.status,
    }
  })

  const trialsEnding = (trialsRes.data ?? []).map((s: Record<string, unknown>) => {
    const profile = profileMap[s.user_id as string]
    const daysRemaining = s.current_period_end
      ? Math.max(0, Math.round((new Date(s.current_period_end as string).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
      : 0
    return {
      id: s.user_id,
      email: profile?.email,
      full_name: profile?.full_name,
      plan: s.plan,
      current_period_end: s.current_period_end,
      daysRemaining,
    }
  })

  const inactivePaid = (inactiveUsersRes.data ?? [])
    .filter((u: Record<string, unknown>) => {
      const usage = usageMap[u.id as string]
      return ((usage?.searches_this_month as number) ?? 0) === 0
    })
    .map((u: Record<string, unknown>) => {
      const usage = usageMap[u.id as string]
      const sub = inactiveSubMap[u.id as string]
      return {
        id: u.id,
        email: u.email,
        full_name: u.full_name,
        plan: u.plan,
        stripe_customer_id: sub?.stripe_customer_id ?? null,
        searches_this_month: (usage?.searches_this_month as number) ?? 0,
        last_reset_at: (usage?.last_reset_at as string) ?? null,
      }
    })

  return NextResponse.json({ pastDue, trialsEnding, inactivePaid })
}
