import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'

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

  let body: { plan?: string; billing?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { plan = 'pro', billing = 'monthly' } = body ?? {}

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

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: user.email || undefined,
      client_reference_id: user.id,
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://leadzip.vercel.app'}/dashboard?payment=success&plan=${plan}`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://leadzip.vercel.app'}/pricing?payment=cancelled`,
      metadata: { plan, billing, user_id: user.id },
      allow_promotion_codes: true,
      subscription_data: {
        trial_period_days: 14,
        metadata: { plan, billing, user_id: user.id },
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Checkout failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
