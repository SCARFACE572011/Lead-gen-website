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
  // Check Stripe is configured. The response never names the missing env var:
  // config state is operator information, so it goes to the server log only.
  if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.startsWith('sk_placeholder')) {
    console.error('stripe/checkout: STRIPE_SECRET_KEY is missing or still a placeholder')
    return NextResponse.json(
      { error: 'Billing is temporarily unavailable. Please try again later.' },
      { status: 503 }
    )
  }

  // Checkout must belong to a logged-in user so the webhook can link the payment
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Deactivated accounts keep a valid session until it expires, so every
  // route re-checks status rather than trusting middleware alone.
  const { data: profile } = await supabase
    .from('users_profile')
    .select('status')
    .eq('id', user.id)
    .maybeSingle()
  if (profile?.status === 'deactivated') {
    return NextResponse.json({ error: 'Account deactivated' }, { status: 403 })
  }

  // `promo` says the visitor came through the 15%-off popup. It can only ever
  // NARROW eligibility: the server decides who qualifies, and this flag decides
  // whether an otherwise-eligible visitor actually claimed the offer. Setting it
  // by hand grants nothing.
  let body: { plan?: string; billing?: string; promo?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { plan = 'pro', billing = 'monthly', promo: claimedPromo } = body ?? {}

  if (!VALID_PLANS.includes(plan)) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
  }
  if (!VALID_BILLING.includes(billing)) {
    return NextResponse.json({ error: 'Invalid billing interval' }, { status: 400 })
  }

  const priceId = billing === 'annual' ? PLAN_PRICE_IDS[plan].annual : PLAN_PRICE_IDS[plan].monthly
  if (!priceId || priceId.includes('placeholder')) {
    // The exact env var name stays in the server log, never in the response.
    console.error(
      `stripe/checkout: missing price id for plan=${plan} billing=${billing} ` +
        `(STRIPE_PRICE_${plan.toUpperCase()}_${billing.toUpperCase()})`
    )
    return NextResponse.json(
      { error: 'That plan is not available for checkout right now. Please try again later.' },
      { status: 503 }
    )
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-04-22.dahlia' })

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

  // New-signup promo: the 15%-off welcome offer is for genuinely new customers
  // who actually claimed it through the popup. Two conditions, and the client
  // controls only the weaker one:
  //   * trialEligible  - server-derived (our subscriptions row plus a live
  //     Stripe lookup). This is the gate. It used to be absent, so any returning
  //     subscriber could POST {"promo":true} and discount themselves.
  //   * claimedPromo   - the popup flag. It can only narrow, never grant, so
  //     visitors who never saw the offer still get the promo-code box instead of
  //     a silent discount.
  // Stripe forbids combining an auto-applied discount with
  // allow_promotion_codes, so it is one or the other. With a trial, Stripe
  // applies the coupon to the first PAID invoice (the one generated when the
  // trial ends), so promo + trial compose correctly.
  const promoCoupon = process.env.STRIPE_PROMO_COUPON
  const applyPromo = trialEligible && claimedPromo === true && !!promoCoupon
  const discountConfig = applyPromo
    ? { discounts: [{ coupon: promoCoupon! }] }
    : { allow_promotion_codes: true }

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
      // billing is carried through so the trial_started conversion records the
      // real period instead of inferring it from the subscription length.
      success_url: `${SITE_URL}/dashboard?payment=success&plan=${plan}&billing=${billing}&session_id={CHECKOUT_SESSION_ID}`,
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
    // Stripe error text names price ids, customer ids, coupon ids and account
    // state, so it stays server-side.
    console.error('stripe/checkout: failed to create checkout session', err)
    return NextResponse.json(
      { error: 'Could not start checkout. Please try again.' },
      { status: 500 }
    )
  }
}
