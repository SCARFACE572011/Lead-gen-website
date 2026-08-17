import Stripe from 'stripe'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import {
  mapPaidPlanFromPriceId,
  type PaidStripePlan,
} from '@/lib/stripe/pricePolicy'
import {
  persistedSubscriptionStatus,
  shouldApplySubscriptionState,
  subscriptionOrderingVersion,
} from '@/lib/stripe/subscriptionStatePolicy'

export type { PaidStripePlan } from '@/lib/stripe/pricePolicy'

// Shared subscription-activation logic used by BOTH the Stripe webhook
// (src/app/api/stripe/webhook/route.ts) and the checkout-return confirmation
// (confirmCheckoutSession, called from the dashboard when a buyer lands back on
// /dashboard?payment=success&session_id=...). Keeping one source of truth means
// the two activation paths can never drift.

export const STRIPE_API_VERSION = '2026-04-22.dahlia' as const

/**
 * Price IDs, not mutable Checkout/subscription metadata, are authoritative for
 * paid access. Returning null fails closed when an env value is missing,
 * duplicated, or a Stripe subscription contains an unknown Price.
 */
export function paidPlanFromStripePriceId(priceId: string): PaidStripePlan | null {
  return mapPaidPlanFromPriceId(priceId, {
    proMonthly: process.env.STRIPE_PRICE_PRO_MONTHLY,
    proAnnual: process.env.STRIPE_PRICE_PRO_ANNUAL,
    agencyMonthly: process.env.STRIPE_PRICE_AGENCY_MONTHLY,
    agencyAnnual: process.env.STRIPE_PRICE_AGENCY_ANNUAL,
  })
}

export function paidPlanFromSubscription(
  subscription: Stripe.Subscription
): PaidStripePlan | null {
  const plans = new Set<PaidStripePlan>()
  for (const item of subscription.items.data) {
    const plan = paidPlanFromStripePriceId(item.price.id)
    if (plan) plans.add(plan)
    else return null
  }
  return plans.size === 1 ? [...plans][0] : null
}

// In API 2026-04-22.dahlia, period fields moved to subscription.items.data[0]
export function subscriptionPeriods(subscription: Stripe.Subscription) {
  const firstItem = subscription.items.data[0]
  const periodStart = firstItem?.current_period_start
    ? new Date(firstItem.current_period_start * 1000).toISOString()
    : new Date().toISOString()
  const periodEnd = firstItem?.current_period_end
    ? new Date(firstItem.current_period_end * 1000).toISOString()
    : new Date().toISOString()
  return { periodStart, periodEnd }
}

// Resolve the app user behind a Stripe event: explicit metadata / client_reference_id
// first, then fall back to an existing subscriptions row for the customer.
export async function resolveUserId(
  supabase: SupabaseClient,
  explicitUserId: string | null | undefined,
  customerId: string | null
): Promise<{ userId: string | null; dbError: string | null }> {
  if (explicitUserId) {
    return { userId: explicitUserId, dbError: null }
  }
  if (!customerId) {
    return { userId: null, dbError: null }
  }
  // Tolerate duplicate rows for the same customer: order newest-first and take
  // one, so a legacy double-insert never makes this throw "multiple rows".
  const { data, error } = await supabase
    .from('subscriptions')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) {
    return { userId: null, dbError: error.message }
  }
  return { userId: (data?.user_id as string | undefined) ?? null, dbError: null }
}

interface PostgrestLikeError {
  code?: string | null
  message?: string | null
}

/**
 * subscriptions.stripe_state_version and .stripe_subscription_created only
 * exist once supabase/migrations/20260815_product_allowances.sql has run. Until
 * then PostgREST rejects every read and write that names them, which would turn
 * each subscription webhook into a 500 and leave a paying customer un-upgraded
 * until Stripe disabled the endpoint. Detect exactly that failure so the sync
 * can fall back to the pre-migration behaviour instead.
 *
 * 42703 is Postgres undefined_column (raised on the select); PGRST204 is
 * PostgREST's "column not found in the schema cache" (raised on the write).
 */
function isMissingStateVersionColumn(error: PostgrestLikeError | null | undefined): boolean {
  if (!error) return false
  if (error.code !== '42703' && error.code !== 'PGRST204') return false
  const message = (error.message ?? '').toLowerCase()
  if (!message) return true
  return (
    message.includes('stripe_state_version') ||
    message.includes('stripe_subscription_created')
  )
}

interface ExistingSubscriptionRow {
  id: string
  subscriptionId: string | null
  status: string | null
  /** 0 before the migration: the column that stores it does not exist yet. */
  orderingVersion: number
  subscriptionCreated: number
}

function toExistingSubscriptionRow(row: {
  id: string
  stripe_subscription_id?: string | null
  status?: string | null
  stripe_state_version?: number | string | null
  stripe_subscription_created?: number | string | null
}): ExistingSubscriptionRow {
  return {
    id: row.id,
    subscriptionId: typeof row.stripe_subscription_id === 'string' ? row.stripe_subscription_id : null,
    status: typeof row.status === 'string' ? row.status : null,
    orderingVersion: Number(row.stripe_state_version ?? 0),
    subscriptionCreated: Number(row.stripe_subscription_created ?? 0),
  }
}

// Order newest-first + limit(1) so a duplicate row (no unique constraint yet)
// never makes .maybeSingle() throw "multiple rows"; we just update the latest.
async function readExistingSubscription(
  supabase: SupabaseClient,
  versioned: boolean,
  filterColumn: 'stripe_customer_id' | 'user_id',
  filterValue: string
): Promise<{ row: ExistingSubscriptionRow | null; error: PostgrestLikeError | null }> {
  // The two selects are spelled out rather than built from a variable so the
  // PostgREST column list stays a literal the client can type-check.
  if (versioned) {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('id, stripe_subscription_id, status, stripe_state_version, stripe_subscription_created')
      .eq(filterColumn, filterValue)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) return { row: null, error }
    return { row: data?.id ? toExistingSubscriptionRow(data) : null, error: null }
  }

  const { data, error } = await supabase
    .from('subscriptions')
    .select('id, stripe_subscription_id, status')
    .eq(filterColumn, filterValue)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) return { row: null, error }
  return { row: data?.id ? toExistingSubscriptionRow(data) : null, error: null }
}

// subscriptions has NO unique constraint on stripe_customer_id, so
// upsert({ onConflict: 'stripe_customer_id' }) always fails with 42P10.
// Do an explicit select-then-update-or-insert instead (user_id is NOT NULL).
// Returns whether this monotonic state won the compare-and-swap update.
export async function syncSubscriptionRow(
  supabase: SupabaseClient,
  sync: {
    userId: string
    customerId: string
    subscriptionId: string
    plan: string
    status: string
    periodStart: string
    periodEnd: string
    /** Stripe event.created; zero for checkout-return confirmation. */
    stateVersion: number
    /** Stripe Subscription.created; distinguishes a legitimate replacement. */
    subscriptionCreated: number
  },
  attempt = 0,
  /**
   * False once the 20260815 migration has been detected as missing: the row is
   * then written without the version columns, exactly as the pre-migration code
   * did. Callers never pass this; the fallback sets it on its own retry.
   */
  versioned = true
): Promise<{ error: string | null; applied: boolean }> {
  const orderingVersion = subscriptionOrderingVersion(sync.stateVersion, sync.status)
  const values: Record<string, unknown> = {
    user_id: sync.userId,
    stripe_customer_id: sync.customerId,
    stripe_subscription_id: sync.subscriptionId,
    plan: sync.plan,
    status: persistedSubscriptionStatus(sync.status),
    current_period_start: sync.periodStart,
    current_period_end: sync.periodEnd,
    updated_at: new Date().toISOString(),
  }
  if (versioned) {
    values.stripe_state_version = orderingVersion
    values.stripe_subscription_created = sync.subscriptionCreated
  }

  // Nothing has been written when a version column turns out to be missing, so
  // the whole sync can safely restart against the pre-migration schema.
  const retryUnversioned = (error: PostgrestLikeError) => {
    console.error(
      'stripe: subscriptions state-version columns are missing, falling back to unversioned subscription sync',
      error.message
    )
    return syncSubscriptionRow(supabase, sync, attempt, false)
  }

  const { row: byCustomer, error: customerSelectError } = await readExistingSubscription(
    supabase,
    versioned,
    'stripe_customer_id',
    sync.customerId
  )
  if (customerSelectError) {
    if (versioned && isMissingStateVersionColumn(customerSelectError)) {
      return retryUnversioned(customerSelectError)
    }
    return { error: customerSelectError.message ?? 'subscription lookup failed', applied: false }
  }

  let existing = byCustomer
  if (!existing) {
    // user_id is unique — reuse the user's row if one exists under another customer id
    const { row: byUser, error: userSelectError } = await readExistingSubscription(
      supabase,
      versioned,
      'user_id',
      sync.userId
    )
    if (userSelectError) {
      if (versioned && isMissingStateVersionColumn(userSelectError)) {
        return retryUnversioned(userSelectError)
      }
      return { error: userSelectError.message ?? 'subscription lookup failed', applied: false }
    }
    existing = byUser
  }

  if (existing) {
    const existingSubscriptionId = existing.subscriptionId
    const sameSubscription = existingSubscriptionId === sync.subscriptionId
    const existingVersion = existing.orderingVersion
    const existingSubscriptionCreated = existing.subscriptionCreated
    const existingIsActive = existing.status === 'active' || existing.status === 'trialing'

    // A later-created replacement subscription supersedes an older one. For
    // the same subscription, event.created is monotonic; equal-version inactive
    // state wins so a same-second cancellation cannot be re-granted by a race.
    // Before the migration both stored numbers read as 0, which reduces this to
    // the pre-migration behaviour of accepting every signed Stripe event.
    const stale = !shouldApplySubscriptionState(
      {
        subscriptionId: existingSubscriptionId,
        status: existing.status,
        orderingVersion: existingVersion,
        subscriptionCreated: existingSubscriptionCreated,
      },
      {
        subscriptionId: sync.subscriptionId,
        status: sync.status,
        eventCreated: sync.stateVersion,
        subscriptionCreated: sync.subscriptionCreated,
      }
    )

    if (stale) return { error: null, applied: false }

    let update = supabase
      .from('subscriptions')
      .update(values)
      .eq('id', existing.id)

    update = existingSubscriptionId
      ? update.eq('stripe_subscription_id', existingSubscriptionId)
      : update.is('stripe_subscription_id', null)

    // Checkout-return confirmation has no signed Stripe event version. It may
    // create/fill an empty row, but cannot overwrite state already recorded by
    // a webhook while it was waiting on the network.
    if (sync.stateVersion === 0 && sameSubscription) {
      // The compare-and-set fence needs the version column; without it the
      // status guard below is the only protection available.
      if (versioned) update = update.eq('stripe_state_version', existingVersion)
      if (!existingIsActive) {
        return { error: null, applied: false }
      }
    } else if (sameSubscription && versioned) {
      update = update.lte('stripe_state_version', orderingVersion)
    }

    const { data, error } = await update.select('id').maybeSingle()
    if (versioned && error && isMissingStateVersionColumn(error)) {
      return retryUnversioned(error)
    }
    if (!error && !data && attempt < 2) {
      // Another handler won the compare-and-swap after our read. Re-evaluate
      // against its committed state instead of acknowledging the wrong winner.
      return syncSubscriptionRow(supabase, sync, attempt + 1, versioned)
    }
    return { error: error?.message ?? null, applied: !error && !!data }
  }

  const { error } = await supabase.from('subscriptions').insert(values)
  if (versioned && error && isMissingStateVersionColumn(error)) {
    return retryUnversioned(error)
  }
  if (error?.code === '23505' && attempt < 2) {
    // A concurrent active/cancel handler inserted the one-per-user row first.
    // Re-resolve once against that committed row so the monotonic/CAS policy,
    // not arrival timing, chooses the final state.
    return syncSubscriptionRow(supabase, sync, attempt + 1, versioned)
  }
  return { error: error?.message ?? null, applied: !error }
}

// Returns an error message on DB failure, null on success.
export async function syncProfilePlan(
  supabase: SupabaseClient,
  userId: string,
  plan: string
): Promise<string | null> {
  // Platform-owner access is controlled by role + the private allowlist, not
  // Stripe. A subscription cancellation must not overwrite the owner's
  // denormalized Agency plan and accidentally downgrade owner-facing UI.
  const { data: profile, error: profileReadError } = await supabase
    .from('users_profile')
    .select('role, status, email')
    .eq('id', userId)
    .maybeSingle()
  if (profileReadError) return profileReadError.message

  const email = typeof profile?.email === 'string' ? profile.email.trim().toLowerCase() : ''
  if (profile?.role === 'admin' && profile.status !== 'deactivated' && email) {
    const { data: allowlist, error: allowlistError } = await supabase
      .from('admin_allowlist')
      .select('email')
      .eq('email', email)
      .maybeSingle()
    if (allowlistError) return allowlistError.message
    if (allowlist?.email === email) return null
  }

  const { error } = await supabase
    .from('users_profile')
    .update({ plan, updated_at: new Date().toISOString() })
    .eq('id', userId)
  return error ? error.message : null
}

/**
 * Webhook-free activation. Called when a buyer returns to the app after a
 * successful Stripe Checkout (success_url carries &session_id=...). Retrieves
 * the session, verifies it is paid and belongs to the logged-in user, then
 * runs the exact same subscription/profile sync the webhook does.
 *
 * Idempotent: safe to run on every dashboard load — repeat calls just re-write
 * the same plan/period values. It complements the webhook (whichever fires
 * first wins; the other is a harmless no-op), so subscriptions activate even
 * when no webhook endpoint is configured.
 */
export async function confirmCheckoutSession(
  sessionId: string,
  expectedUserId: string
): Promise<{ activated: boolean; plan?: string; reason?: string }> {
  const secret = process.env.STRIPE_SECRET_KEY
  if (!secret || secret.startsWith('sk_placeholder') || secret.includes('placeholder')) {
    return { activated: false, reason: 'stripe_not_configured' }
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { activated: false, reason: 'supabase_not_configured' }
  }

  const stripe = new Stripe(secret, { apiVersion: STRIPE_API_VERSION })

  let session: Stripe.Checkout.Session
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId)
  } catch {
    return { activated: false, reason: 'session_retrieve_failed' }
  }

  // Security: only activate a session that belongs to the requesting user.
  const sessionUserId =
    session.metadata?.user_id || (session.client_reference_id ?? undefined)
  if (!sessionUserId || sessionUserId !== expectedUserId) {
    return { activated: false, reason: 'session_user_mismatch' }
  }
  if (session.mode !== 'subscription') return { activated: false, reason: 'not_subscription' }
  // Gate on session completion, NOT payment_status: first-time checkouts use a
  // 7-day trial, so a legitimately-completed session is 'no_payment_required'
  // (trialing), not 'paid'. session.status === 'complete' covers both trial and
  // immediate-charge sign-ups, mirroring how the webhook activates.
  if (session.status !== 'complete') return { activated: false, reason: 'incomplete' }
  if (!session.subscription) return { activated: false, reason: 'no_subscription' }

  const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
  const plan = paidPlanFromSubscription(subscription)
  if (!plan) return { activated: false, reason: 'unrecognized_subscription_price' }
  const isActive = subscription.status === 'active' || subscription.status === 'trialing'
  const effectivePlan = isActive ? plan : 'free'
  const customerId = session.customer as string
  const { periodStart, periodEnd } = subscriptionPeriods(subscription)

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  // The logged-in user is authoritative; fall back to metadata/customer lookup.
  const userId =
    expectedUserId || (await resolveUserId(supabase, sessionUserId, customerId)).userId
  if (!userId) return { activated: false, reason: 'no_user' }

  const syncResult = await syncSubscriptionRow(supabase, {
    userId,
    customerId,
    subscriptionId: subscription.id,
    plan: effectivePlan,
    status: subscription.status,
    periodStart,
    periodEnd,
    stateVersion: 0,
    subscriptionCreated: subscription.created,
  })
  // The dashboard caller discards this reason, so a database failure here would
  // otherwise be invisible. Log the detail server-side and return a short code
  // rather than a raw Postgres message.
  if (syncResult.error) {
    console.error(
      `stripe: checkout confirmation could not sync subscription for user ${userId}`,
      syncResult.error
    )
    return { activated: false, reason: 'subscription_sync_failed' }
  }
  if (!syncResult.applied) {
    return { activated: false, reason: 'newer_subscription_state' }
  }

  const profileError = await syncProfilePlan(supabase, userId, effectivePlan)
  if (profileError) {
    console.error(
      `stripe: checkout confirmation could not sync profile plan for user ${userId}`,
      profileError
    )
    return { activated: false, reason: 'profile_sync_failed' }
  }

  if (!isActive) return { activated: false, plan: effectivePlan, reason: 'subscription_inactive' }
  return { activated: true, plan: effectivePlan }
}
