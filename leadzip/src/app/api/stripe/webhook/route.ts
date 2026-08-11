import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

// In API 2026-04-22.dahlia, period fields moved to subscription.items.data[0]
function subscriptionPeriods(subscription: Stripe.Subscription) {
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
async function resolveUserId(
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
  const { data, error } = await supabase
    .from('subscriptions')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
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
async function syncSubscriptionRow(
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

  const { data: byCustomer, error: customerSelectError } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('stripe_customer_id', sync.customerId)
    .maybeSingle()
  if (customerSelectError) return customerSelectError.message

  let existingId = byCustomer?.id as string | undefined
  if (!existingId) {
    // user_id is unique — reuse the user's row if one exists under another customer id
    const { data: byUser, error: userSelectError } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('user_id', sync.userId)
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
async function syncProfilePlan(
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

// IMPORTANT: Stripe webhooks require raw body — disable body parsing
export async function POST(request: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 })
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-04-22.dahlia' })
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')!

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Webhook signature verification failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  // Use service role key to bypass RLS for webhook updates
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      if (session.mode === 'subscription') {
        const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
        const plan = session.metadata?.plan || 'pro'
        const customerId = session.customer as string
        const { periodStart, periodEnd } = subscriptionPeriods(subscription)

        const { userId, dbError } = await resolveUserId(
          supabase,
          session.metadata?.user_id || session.client_reference_id,
          customerId
        )
        if (dbError) {
          return NextResponse.json({ error: `Failed to resolve user: ${dbError}` }, { status: 500 })
        }
        if (!userId) {
          // Nothing to link the payment to — retrying will not help, so acknowledge
          console.error(`stripe/webhook: no user_id resolvable for checkout session ${session.id}`)
          break
        }

        const syncError = await syncSubscriptionRow(supabase, {
          userId,
          customerId,
          subscriptionId: subscription.id,
          plan,
          status: subscription.status,
          periodStart,
          periodEnd,
        })
        if (syncError) {
          return NextResponse.json({ error: `Failed to sync subscription: ${syncError}` }, { status: 500 })
        }

        const profileError = await syncProfilePlan(supabase, userId, plan)
        if (profileError) {
          return NextResponse.json({ error: `Failed to sync profile plan: ${profileError}` }, { status: 500 })
        }
      }
      break
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription
      const plan = subscription.metadata?.plan || 'pro'
      const customerId = subscription.customer as string
      const { periodStart, periodEnd } = subscriptionPeriods(subscription)

      const { userId, dbError } = await resolveUserId(
        supabase,
        subscription.metadata?.user_id,
        customerId
      )
      if (dbError) {
        return NextResponse.json({ error: `Failed to resolve user: ${dbError}` }, { status: 500 })
      }
      if (!userId) {
        console.error(`stripe/webhook: no user_id resolvable for subscription ${subscription.id}`)
        break
      }

      const syncError = await syncSubscriptionRow(supabase, {
        userId,
        customerId,
        subscriptionId: subscription.id,
        plan,
        status: subscription.status,
        periodStart,
        periodEnd,
      })
      if (syncError) {
        return NextResponse.json({ error: `Failed to sync subscription: ${syncError}` }, { status: 500 })
      }

      const profileError = await syncProfilePlan(supabase, userId, plan)
      if (profileError) {
        return NextResponse.json({ error: `Failed to sync profile plan: ${profileError}` }, { status: 500 })
      }
      break
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      const now = new Date().toISOString()
      const customerId = subscription.customer as string

      const { error: cancelError } = await supabase
        .from('subscriptions')
        .update({ status: 'cancelled', plan: 'free', updated_at: now })
        .eq('stripe_subscription_id', subscription.id)
      if (cancelError) {
        return NextResponse.json({ error: `Failed to cancel subscription: ${cancelError.message}` }, { status: 500 })
      }

      const { userId, dbError } = await resolveUserId(
        supabase,
        subscription.metadata?.user_id,
        customerId
      )
      if (dbError) {
        return NextResponse.json({ error: `Failed to resolve user: ${dbError}` }, { status: 500 })
      }
      if (userId) {
        const profileError = await syncProfilePlan(supabase, userId, 'free')
        if (profileError) {
          return NextResponse.json({ error: `Failed to sync profile plan: ${profileError}` }, { status: 500 })
        }
        // NOTE: previously called supabase.auth.admin.signOut(userId, 'global') here —
        // invalid, admin.signOut takes a session JWT, not a user id. supabase-js has no
        // revoke-all-sessions-by-user-id API, so the call was dropped.
      }
      break
    }
  }

  return NextResponse.json({ received: true })
}
