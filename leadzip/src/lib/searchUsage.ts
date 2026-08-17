import type { SupabaseClient } from '@supabase/supabase-js'

export interface LiveSearchReservation {
  allowed: boolean
  reason: 'monthly' | 'daily' | 'inactive' | 'unauthorized' | null
  plan?: 'free' | 'pro' | 'agency'
  subjectUserId?: string
  monthlyUsed?: number
  monthlyLimit?: number | null
  dailyUsed?: number
  dailyLimit?: number | null
}

export type ReserveLiveSearchResult =
  | { status: 'reserved'; reservation: LiveSearchReservation }
  | { status: 'migration_missing' }
  | { status: 'error'; message: string }

function isMissingFunction(error: { code?: string; message?: string }): boolean {
  if (error.code === '42883' || error.code === 'PGRST202') return true
  const message = (error.message ?? '').toLowerCase()
  return message.includes('reserve_live_search') && (
    message.includes('does not exist') || message.includes('schema cache')
  )
}

/**
 * A relation or column the deployed code expects but the database does not have
 * yet. Deploys can land ahead of a hand-applied migration, so every read of a
 * newer column has to be able to tell "not migrated yet" apart from a real
 * failure and drop back to the older shape instead of erroring at a customer.
 */
function isMissingRelationOrColumn(error: { code?: string; message?: string }): boolean {
  const code = error.code ?? ''
  return (
    code === '42703' || // undefined_column
    code === '42P01' || // undefined_table
    code === 'PGRST204' || // column missing from the schema cache
    code === 'PGRST205' // table missing from the schema cache
  )
}

/**
 * Reserve one provider-backed search atomically. A missing migration is
 * reported distinctly so the interactive route can retain its older bounded
 * fallback during deployment; other database failures must not silently open
 * an unmetered paid-provider path.
 */
export async function reserveLiveSearch(
  supabase: SupabaseClient,
  userId: string
): Promise<ReserveLiveSearchResult> {
  const { data, error } = await supabase.rpc('reserve_live_search', { uid: userId })

  if (error) {
    if (isMissingFunction(error)) return { status: 'migration_missing' }
    return { status: 'error', message: error.message }
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { status: 'error', message: 'Invalid search reservation response' }
  }

  const value = data as Record<string, unknown>
  return {
    status: 'reserved',
    reservation: {
      allowed: value.allowed === true,
      reason:
        value.reason === 'monthly' ||
        value.reason === 'daily' ||
        value.reason === 'inactive' ||
        value.reason === 'unauthorized'
          ? value.reason
          : null,
      plan:
        value.plan === 'pro' || value.plan === 'agency' || value.plan === 'free'
          ? value.plan
          : undefined,
      subjectUserId: typeof value.subjectUserId === 'string' ? value.subjectUserId : undefined,
      monthlyUsed: typeof value.monthlyUsed === 'number' ? value.monthlyUsed : undefined,
      monthlyLimit:
        typeof value.monthlyLimit === 'number' || value.monthlyLimit === null
          ? value.monthlyLimit
          : undefined,
      dailyUsed: typeof value.dailyUsed === 'number' ? value.dailyUsed : undefined,
      dailyLimit:
        typeof value.dailyLimit === 'number' || value.dailyLimit === null
          ? value.dailyLimit
          : undefined,
    },
  }
}

// ── Legacy bounded allowance (used only until 20260815 is applied) ───────────
// These are the caps the interactive search route enforced before
// reserve_live_search existed, kept byte-for-byte so a deploy that lands ahead
// of the migration behaves exactly like the code currently in production
// instead of failing every signed-in cache-miss search.
const LEGACY_FREE_MONTHLY_LIMIT = 25
const LEGACY_PAID_DAILY_FAIR_USE = 150

export interface LegacySearchAllowance {
  allowed: boolean
  reason: 'monthly' | 'daily' | null
  limit: number | null
}

function startOfUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

function monthIndex(date: Date): number {
  return date.getUTCFullYear() * 12 + date.getUTCMonth()
}

/**
 * Bump the legacy counters. increment_daily_searches ships with the daily
 * counter migration and increment_searches predates it, so both are tried
 * before a direct write. Called with a service-role client, so auth.uid() is
 * null inside the function and the passed subject id is the one that counts.
 */
async function incrementLegacySearchCount(
  admin: SupabaseClient,
  subjectUserId: string
): Promise<void> {
  let { error } = await admin.rpc('increment_daily_searches', { uid: subjectUserId })
  if (error) {
    ;({ error } = await admin.rpc('increment_searches', { uid: subjectUserId }))
  }
  if (!error) return

  // Last resort read-modify-write. It can lose a concurrent increment, but the
  // caller is already rate limited per minute, and an approximate count still
  // bounds spend where no count at all would not.
  const { data, error: readError } = await admin
    .from('usage_limits')
    .select('searches_this_month')
    .eq('user_id', subjectUserId)
    .maybeSingle()
  if (readError || !data) {
    console.error('[searchUsage] legacy search count could not be recorded', readError ?? error)
    return
  }
  const { error: writeError } = await admin
    .from('usage_limits')
    .update({
      searches_this_month: ((data.searches_this_month as number | null) ?? 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', subjectUserId)
  if (writeError) {
    console.error('[searchUsage] legacy search count write failed', writeError)
  }
}

/**
 * Check and consume one live search using the pre-allowance counters.
 *
 * This is the fallback for `status: 'migration_missing'` only. It must stay
 * BOUNDED: a missing migration is never a reason to hand out unmetered
 * provider spend. Free keeps its 25 searches a month, paid plans keep the
 * 150-a-day fair-use ceiling, and platform admins stay exempt exactly as
 * before.
 *
 * Every newer column is feature detected, so this works whether or not the
 * daily-counter migration has been applied.
 *
 * @param admin service-role client (usage_limits is service-role write only)
 * @param subjectUserId the account whose shared allowance is charged
 */
export async function reserveLiveSearchLegacy(
  admin: SupabaseClient,
  subjectUserId: string,
  plan: string,
  role: string
): Promise<LegacySearchAllowance> {
  const isAdmin = role === 'admin'
  const isPaid = plan === 'pro' || plan === 'agency'
  const now = new Date()

  // Legacy accounts can predate the signup hook that creates this row, and a
  // missing row reads as "0 used" on every request, which is unmetered access.
  const { error: seedError } = await admin
    .from('usage_limits')
    .upsert({ user_id: subjectUserId }, { onConflict: 'user_id', ignoreDuplicates: true })
  if (seedError) {
    console.error('[searchUsage] usage_limits row could not be ensured', seedError)
  }

  // searches_today / searches_today_date only exist once the daily-counter
  // migration is applied; ask for them first and retry without them on 42703.
  let hasDailyColumns = true
  let row: Record<string, unknown> | null = null
  let readFailed = false

  const withDaily = await admin
    .from('usage_limits')
    .select('searches_this_month, last_reset_at, searches_today, searches_today_date')
    .eq('user_id', subjectUserId)
    .maybeSingle()

  if (withDaily.error && isMissingRelationOrColumn(withDaily.error)) {
    hasDailyColumns = false
    const withoutDaily = await admin
      .from('usage_limits')
      .select('searches_this_month, last_reset_at')
      .eq('user_id', subjectUserId)
      .maybeSingle()
    if (withoutDaily.error) {
      readFailed = true
      console.error('[searchUsage] legacy usage read failed', withoutDaily.error)
    } else {
      row = withoutDaily.data as Record<string, unknown> | null
    }
  } else if (withDaily.error) {
    readFailed = true
    console.error('[searchUsage] legacy usage read failed', withDaily.error)
  } else {
    row = withDaily.data as Record<string, unknown> | null
  }

  // Usage read failed: treat as 0 used, exactly as the previous code did. The
  // per-minute rate limiter above the caller still bounds the damage, and
  // blocking a paying customer over a transient database error is worse.
  let monthlyUsed = readFailed
    ? 0
    : typeof row?.searches_this_month === 'number'
      ? row.searches_this_month
      : 0

  // schema.sql ships reset_monthly_usage() but it needs an external scheduler.
  // Roll the calendar month over here as well, so a counter that nobody reset
  // can never permanently lock a customer out of the product they pay for.
  const lastReset = typeof row?.last_reset_at === 'string' ? new Date(row.last_reset_at) : null
  if (lastReset && !Number.isNaN(lastReset.getTime()) && monthIndex(lastReset) < monthIndex(now)) {
    const { error: resetError } = await admin
      .from('usage_limits')
      .update({
        searches_this_month: 0,
        exports_count: 0,
        last_reset_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq('user_id', subjectUserId)
    if (resetError) {
      console.error('[searchUsage] monthly usage rollover failed', resetError)
    } else {
      monthlyUsed = 0
    }
  }

  if (!isAdmin && !isPaid && monthlyUsed >= LEGACY_FREE_MONTHLY_LIMIT) {
    return { allowed: false, reason: 'monthly', limit: LEGACY_FREE_MONTHLY_LIMIT }
  }

  if (!isAdmin && isPaid) {
    const today = startOfUtcDay(now)
    const todayKey = today.toISOString().slice(0, 10)
    let todayCount: number | null = null

    if (hasDailyColumns && !readFailed) {
      const storedDate =
        typeof row?.searches_today_date === 'string' ? row.searches_today_date.slice(0, 10) : null
      // A stale date means the counter belongs to a previous day.
      todayCount =
        storedDate === todayKey
          ? typeof row?.searches_today === 'number'
            ? row.searches_today
            : 0
          : 0
    } else {
      // Pre-daily-counter databases count today's billable rows in
      // search_history. Agency seats each log their own rows, so this can
      // under-count a shared workspace; it still bounds a single account, which
      // is the behaviour this fallback is restoring.
      const { count, error } = await admin
        .from('search_history')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', subjectUserId)
        .gte('created_at', today.toISOString())
      if (error) {
        console.error('[searchUsage] legacy fair-use count read failed, allowing', error)
      } else {
        todayCount = count ?? 0
      }
    }

    if (todayCount !== null && todayCount >= LEGACY_PAID_DAILY_FAIR_USE) {
      return { allowed: false, reason: 'daily', limit: LEGACY_PAID_DAILY_FAIR_USE }
    }
  }

  await incrementLegacySearchCount(admin, subjectUserId)
  return { allowed: true, reason: null, limit: null }
}
