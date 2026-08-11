import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import {
  STRIPE_API_VERSION,
  subscriptionPeriods,
  resolveUserId,
  syncSubscriptionRow,
  syncProfilePlan,
} from '@/lib/stripe/subscriptionSync'

export const runtime = 'nodejs'

// IMPORTANT: Stripe webhooks require raw body — disable body parsing
export async function POST(request: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 })
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: STRIPE_API_VERSION })
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
