import Stripe from 'stripe'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Shared subscription-activation logic used by BOTH the Stripe webhook
// (src/app/api/stripe/webhook/route.ts) and the checkout-return confirmation
// (confirmCheckoutSession, called from the dashboard when a buyer lands back on
// /dashboard?payment=success&session_id=...). Keeping one source of truth means
// the two activation paths can never drift.

export const STRIPE_API_VERSION = '2026-04-22.dahlia' as const

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

// subscriptions has NO unique constraint on stripe_customer_id, so
// upsert({ onConflict: 'stripe_customer_id' }) always fails with 42P10.
// Do an explicit select-then-update-or-insert instead (user_id is NOT NULL).
// Returns an error message on DB failure, null on success.
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
  }
): Promise<string | null> {
  const values = {
    user_id: sync.userId,
    stripe_customer_id: sync.customerId,
    stripe_subscription_id: sync.subscriptionId,
    plan: sync.plan,
    status: sync.status,
    current_period_start: sync.periodStart,
    current_period_end: sync.periodEnd,
    updated_at: new Date().toISOString(),
  }

  // Order newest-first + limit(1) so a duplicate row (no unique constraint yet)
  // never makes .maybeSingle() throw "multiple rows"; we just update the latest.
  const { data: byCustomer, error: customerSelectError } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('stripe_customer_id', sync.customerId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (customerSelectError) return customerSelectError.message

  let existingId = byCustomer?.id as string | undefined
  if (!existingId) {
    // user_id is unique — reuse the user's row if one exists under another customer id
    const { data: byUser, error: userSelectError } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('user_id', sync.userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (userSelectError) return userSelectError.message
    existingId = byUser?.id as string | undefined
  }

  if (existingId) {
    const { error } = await supabase
      .from('subscriptions')
      .update(values)
      .eq('id', existingId)
    return error ? error.message : null
  }

  const { error } = await supabase.from('subscriptions').insert(values)
  return error ? error.message : null
}

// Returns an error message on DB failure, null on success.
export async function syncProfilePlan(
  supabase: SupabaseClient,
  userId: string,
  plan: string
): Promise<string | null> {
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
  if (sessionUserId && sessionUserId !== expectedUserId) {
    return { activated: false, reason: 'session_user_mismatch' }
  }
  if (session.mode !== 'subscription') return { activated: false, reason: 'not_subscription' }
  // Gate on session completion, NOT payment_status: checkout uses a 14-day
  // trial, so a legitimately-completed session is 'no_payment_required'
  // (trialing), not 'paid'. session.status === 'complete' covers both trial and
  // immediate-charge sign-ups, mirroring how the webhook activates.
  if (session.status !== 'complete') return { activated: false, reason: 'incomplete' }
  if (!session.subscription) return { activated: false, reason: 'no_subscription' }

  const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
  const plan = session.metadata?.plan || 'pro'
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

  const syncError = await syncSubscriptionRow(supabase, {
    userId,
    customerId,
    subscriptionId: subscription.id,
    plan,
    status: subscription.status,
    periodStart,
    periodEnd,
  })
  if (syncError) return { activated: false, reason: syncError }

  const profileError = await syncProfilePlan(supabase, userId, plan)
  if (profileError) return { activated: false, reason: profileError }

  return { activated: true, plan }
}
