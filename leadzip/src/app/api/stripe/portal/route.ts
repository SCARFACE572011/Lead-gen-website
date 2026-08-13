import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
import { SITE_URL } from '@/lib/siteUrl'

export async function POST() {
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('stripe/portal: STRIPE_SECRET_KEY is not configured')
    return NextResponse.json(
      { error: 'Billing is temporarily unavailable. Please try again later.' },
      { status: 503 }
    )
  }

  // Only the authenticated caller's own billing portal — never trust a
  // client-supplied customer id.
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: subscription, error: subError } = await supabase
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (subError) {
    console.error('stripe/portal: subscription lookup failed', subError)
    return NextResponse.json({ error: 'Failed to look up subscription' }, { status: 500 })
  }
  if (!subscription?.stripe_customer_id) {
    return NextResponse.json({ error: 'No billing account found' }, { status: 404 })
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-04-22.dahlia' })

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${SITE_URL}/settings`,
    })
    return NextResponse.json({ url: session.url })
  } catch (err: unknown) {
    // Stripe error text names customer ids and account state, so it stays
    // server-side.
    console.error('stripe/portal: failed to create billing portal session', err)
    return NextResponse.json(
      { error: 'Could not open the billing portal. Please try again.' },
      { status: 500 }
    )
  }
}
