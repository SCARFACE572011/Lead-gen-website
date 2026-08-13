import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
import { SITE_URL } from '@/lib/siteUrl'

const PLAN_PRICE_IDS: Record<string, { monthly: string | undefined; annual: string | undefined }> = {
  pro: {
    monthly: process.env.STRIPE_PRICE_PRO_MONTHLY,
    annual: process.env.STRIPE_PRICE_PRO_ANNUAL,
  },
  agency: {
    monthly: process.env.STRIPE_PRICE_AGENCY_MONTHLY,
    annual: process.env.STRIPE_PRICE_AGENCY_ANNUAL,
  },
}

const VALID_PLANS = ['pro', 'agency']
const VALID_BILLING = ['monthly', 'annual']

export async function POST(request: NextRequest) {
  // Check Stripe is configured
  if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.startsWith('sk_placeholder')) {
    return NextResponse.json(
      { error: 'Stripe not configured. Add STRIPE_SECRET_KEY to environment variables.' },
      { status: 503 }
    )
  }

  // Checkout must belong to a logged-in user so the webhook can link the payment
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { plan?: string; billing?: string; promo?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { plan = 'pro', billing = 'monthly', promo = false } = body ?? {}

  if (!VALID_PLANS.includes(plan)) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
  }
  if (!VALID_BILLING.includes(billing)) {
    return NextResponse.json({ error: 'Invalid billing interval' }, { status: 400 })
  }

  const priceId = billing === 'annual' ? PLAN_PRICE_IDS[plan].annual : PLAN_PRICE_IDS[plan].monthly
  if (!priceId || priceId.includes('placeholder')) {
    return NextResponse.json(
      {
        error: `Checkout for the ${plan} ${billing} plan is not configured. Set the STRIPE_PRICE_${plan.toUpperCase()}_${billing.toUpperCase()} environment variable to a real Stripe price ID.`,
      },
      { status: 503 }
    )
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-04-22.dahlia' })

  // New-signup promo: when the visitor came through the 15%-off popup we
  // auto-apply the coupon (15% off the first charge). Stripe forbids combining
  // an auto-applied discount with allow_promotion_codes, so it's one or the other.
  // With a trial, Stripe applies the coupon to the first PAID invoice (the one
  // generated when the trial ends), so promo + trial compose correctly.
  const promoCoupon = process.env.STRIPE_PROMO_COUPON
  const applyPromo = promo === true && !!promoCoupon
  const discountConfig = applyPromo
    ? { discounts: [{ coupon: promoCoupon! }] }
    : { allow_promotion_codes: true }

  // ── Trial-abuse guard ─────────────────────────────────────────────────────
  // The 7-day free trial is only for users who have NEVER had a Stripe
  // subscription (any status). Two signals, both checked:
  //   1. Our own subscriptions table: a row with a stripe_subscription_id
  //      means this user has subscribed before.
  //   2. Stripe itself: if we know their customer id, list subscriptions with
  //      status 'all' (read-only) — catches subs our DB missed.
  // RLS allows a user to read their own subscriptions row, so the session
  // client is fine here.
  let existingCustomerId: string | null = null
  let hadSubscription = false
  {
    const { data: subRow } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id, stripe_subscription_id')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (subRow?.stripe_subscription_id) hadSubscription = true
    if (subRow?.stripe_customer_id) existingCustomerId = subRow.stripe_customer_id
  }

  if (existingCustomerId) {
    try {
      const customer = await stripe.customers.retrieve(existingCustomerId)
      if (customer.deleted) {
        existingCustomerId = null
      } else if (!hadSubscription) {
        const subs = await stripe.subscriptions.list({
          customer: existingCustomerId,
          status: 'all',
          limit: 1,
        })
        if (subs.data.length > 0) hadSubscription = true
      }
    } catch {
      // Stale or mode-mismatched customer id — ignore it and let Checkout
      // create a fresh customer from the email instead of failing checkout.
      existingCustomerId = null
    }
  }

  const trialEligible = !hadSubscription

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      // Card is always collected up front, even though the trial invoice is $0.
      payment_method_collection: 'always',
      line_items: [{ price: priceId, quantity: 1 }],
      // Reuse the known Stripe customer for returning buyers (keeps their
      // billing history in one place); Stripe forbids passing customer AND
      // customer_email together, so email is the new-customer path only.
      ...(existingCustomerId
        ? { customer: existingCustomerId }
        : { customer_email: user.email || undefined }),
      client_reference_id: user.id,
      success_url: `${SITE_URL}/dashboard?payment=success&plan=${plan}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}/pricing?payment=cancelled`,
      metadata: { plan, billing, user_id: user.id },
      ...discountConfig,
      subscription_data: {
        // First-time subscribers get a 7-day trial and are auto-charged when
        // it ends. If the card somehow goes missing the sub cancels instead
        // of silently converting. Returning subscribers pay immediately.
        ...(trialEligible
          ? {
              trial_period_days: 7,
              trial_settings: {
                end_behavior: { missing_payment_method: 'cancel' as const },
              },
            }
          : {}),
        metadata: { plan, billing, user_id: user.id },
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Checkout failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
