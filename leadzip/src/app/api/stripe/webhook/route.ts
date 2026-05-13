import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

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

        // In API 2026-04-22.dahlia, period fields moved to subscription.items.data[0]
        const firstItem = subscription.items.data[0]
        const periodStart = firstItem?.current_period_start
          ? new Date(firstItem.current_period_start * 1000).toISOString()
          : new Date().toISOString()
        const periodEnd = firstItem?.current_period_end
          ? new Date(firstItem.current_period_end * 1000).toISOString()
          : new Date().toISOString()

        // Update subscriptions table
        await supabase.from('subscriptions').upsert({
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: subscription.id,
          plan,
          status: subscription.status,
          current_period_start: periodStart,
          current_period_end: periodEnd,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'stripe_customer_id' })

        // Update users_profile plan
        await supabase
          .from('users_profile')
          .update({ plan, updated_at: new Date().toISOString() })
          .eq('email', session.customer_email as string)
      }
      break
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription
      const plan = subscription.metadata?.plan || 'pro'

      // Period fields live on subscription items in API 2026-04-22.dahlia
      const firstItem = subscription.items.data[0]
      const periodStart = firstItem?.current_period_start
        ? new Date(firstItem.current_period_start * 1000).toISOString()
        : new Date().toISOString()
      const periodEnd = firstItem?.current_period_end
        ? new Date(firstItem.current_period_end * 1000).toISOString()
        : new Date().toISOString()

      await supabase.from('subscriptions').upsert({
        stripe_customer_id: subscription.customer as string,
        stripe_subscription_id: subscription.id,
        plan,
        status: subscription.status,
        current_period_start: periodStart,
        current_period_end: periodEnd,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'stripe_customer_id' })
      break
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      await supabase.from('subscriptions')
        .update({ status: 'cancelled', plan: 'free', updated_at: new Date().toISOString() })
        .eq('stripe_subscription_id', subscription.id)
      await supabase.from('users_profile')
        .update({ plan: 'free', updated_at: new Date().toISOString() })
        .eq('id', subscription.metadata?.user_id)
      break
    }
  }

  return NextResponse.json({ received: true })
}
