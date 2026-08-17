import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { requireActiveUser } from '@/lib/requireActiveUser'
import { resolveProductAccess } from '@/lib/productAccess'
import { getPlanPolicy } from '@/lib/planPolicy'

export const dynamic = 'force-dynamic'

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

interface PooledUsageRow {
  searches_this_month?: number | null
  last_reset_at?: string | null
}

/**
 * Monthly usage read.
 *
 * Deliberately asks only for the two columns this response needs. Both predate
 * every pending migration, so the query works whether or not the daily-counter
 * migration (usage_limits.searches_today / searches_today_date) has been
 * applied. If today's usage is ever surfaced here, request those two columns in
 * a second, separately handled query rather than adding them to this select:
 * on an unmigrated database the whole read would fail and the caller would be
 * told nothing about their monthly usage.
 *
 * Returns `known: false` when the count could not be read. A failed read is NOT
 * reported as zero usage: a customer close to their cap must never be shown a
 * reassuring zero.
 */
async function readPooledUsage(
  db: ReturnType<typeof serviceClient>,
  subjectUserId: string
): Promise<{ row: PooledUsageRow | null; known: boolean }> {
  const { data, error } = await db
    .from('usage_limits')
    .select('searches_this_month, last_reset_at')
    .eq('user_id', subjectUserId)
    .maybeSingle()

  if (error) {
    console.error('[usage] monthly usage read failed', error)
    return { row: null, known: false }
  }

  // No row yet simply means no searches have been recorded for this account,
  // which is a real, knowable zero.
  return { row: (data as PooledUsageRow | null) ?? null, known: true }
}

export async function GET() {
  const supabase = await createServerClient()
  const auth = await requireActiveUser(supabase, {
    columns: ['plan', 'role', 'workspace_id'],
  })
  if (!auth.ok) return auth.response

  const db = serviceClient()
  const access = await resolveProductAccess(db, auth.user.id, auth.profile)
  if (!access) {
    return NextResponse.json(
      { error: 'Usage is temporarily unavailable.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    )
  }

  const [pooled, { count: savedLeads, error: savedLeadsError }, { data: subscription }, { data: quotaSubscription }] =
    await Promise.all([
      readPooledUsage(db, access.quotaSubjectUserId),
      db
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', auth.user.id),
      db
        .from('subscriptions')
        .select('status, current_period_end, stripe_customer_id')
        .eq('user_id', auth.user.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      db
        .from('subscriptions')
        .select('status, current_period_start')
        .eq('user_id', access.quotaSubjectUserId)
        .in('status', ['active', 'trialing'])
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

  const policy = getPlanPolicy(access.plan, access.role)
  const isPlatformAdmin = access.role === 'admin'
  const liveSearchLimit = isPlatformAdmin
    ? null
    : quotaSubscription?.status === 'trialing'
      ? policy.trialLiveSearches
      : policy.liveSearchesPerMonth
  const pooledUsage = pooled.row
  const lastReset = pooledUsage?.last_reset_at
    ? new Date(pooledUsage.last_reset_at)
    : null
  const now = new Date()
  const sameUtcMonth =
    !!lastReset &&
    lastReset.getUTCFullYear() === now.getUTCFullYear() &&
    lastReset.getUTCMonth() === now.getUTCMonth()
  const trialPeriodStart = quotaSubscription?.current_period_start
    ? new Date(quotaSubscription.current_period_start)
    : null
  // A counter from an earlier month or an earlier trial period has already
  // lapsed, so zero there is the true current figure, not a guess.
  const countedThisPeriod = quotaSubscription?.status === 'trialing'
    ? !!lastReset && !!trialPeriodStart && lastReset >= trialPeriodStart
    : sameUtcMonth
  const searchesUsed = pooled.known
    ? countedThisPeriod
      ? pooledUsage?.searches_this_month ?? 0
      : 0
    : null

  if (savedLeadsError) {
    console.error('[usage] saved lead count failed', savedLeadsError)
  }

  return NextResponse.json(
    {
      plan: access.plan,
      isPlatformAdmin,
      workspaceShared: access.quotaSubjectUserId !== auth.user.id,
      searches: {
        // null with known:false means "we could not read this right now".
        // Clients must show that as unavailable, never as zero used.
        used: searchesUsed,
        limit: liveSearchLimit,
        known: pooled.known,
      },
      savedLeads: {
        used: savedLeadsError ? null : savedLeads ?? 0,
        limit: isPlatformAdmin ? null : policy.savedLeads,
        known: !savedLeadsError,
      },
      subscription: subscription ?? null,
      canManageBilling: !!subscription?.stripe_customer_id,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
