import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { PLAN_PRICES } from '@/lib/pricing'

export async function GET() {
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const twelveMonthsAgo = new Date()
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)

  const { data: subs } = await db
    .from('subscriptions')
    .select('plan, status, created_at, updated_at, current_period_end')
    .gte('created_at', twelveMonthsAgo.toISOString())

  // Build month buckets
  const history: { month: string; mrr: number }[] = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() - i)
    const monthKey = d.toISOString().slice(0, 7)
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString()
    const monthStart = d.toISOString()

    const activeThatMonth = (subs ?? []).filter(s => {
      const created = s.created_at <= monthEnd
      const notCancelled = s.status !== 'cancelled' || (s.updated_at && s.updated_at > monthEnd)
      return created && notCancelled && s.plan !== 'free' && s.created_at >= twelveMonthsAgo.toISOString()
    })

    const mrr = activeThatMonth.reduce((sum, s) => {
      return sum + (s.plan === 'agency' ? PLAN_PRICES.agency : PLAN_PRICES.pro)
    }, 0)

    history.push({ month: monthKey, mrr })
  }

  return NextResponse.json({ history })
}
