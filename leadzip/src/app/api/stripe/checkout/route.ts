import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const PLAN_PRICE_IDS: Record<string, { monthly: string; annual: string }> = {
  pro: {
    monthly: process.env.STRIPE_PRICE_PRO_MONTHLY || 'price_placeholder_pro_monthly',
    annual: process.env.STRIPE_PRICE_PRO_ANNUAL || 'price_placeholder_pro_annual',
  },
  agency: {
    monthly: process.env.STRIPE_PRICE_AGENCY_MONTHLY || 'price_placeholder_agency_monthly',
    annual: process.env.STRIPE_PRICE_AGENCY_ANNUAL || 'price_placeholder_agency_annual',
  },
}

export async function POST(request: NextRequest) {
  // Check Stripe is configured
  if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.startsWith('sk_placeholder')) {
    return NextResponse.json(
      { error: 'Stripe not configured. Add STRIPE_SECRET_KEY to environment variables.' },
      { status: 503 }
    )
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-04-22.dahlia' })

  const { plan = 'pro', billing = 'monthly', userEmail = '' } = await request.json()

  const planConfig = PLAN_PRICE_IDS[plan]
  if (!planConfig) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
  }

  const priceId = billing === 'annual' ? planConfig.annual : planConfig.monthly

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: userEmail || undefined,
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://leadzip.vercel.app'}/dashboard?payment=success&plan=${plan}`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://leadzip.vercel.app'}/pricing?payment=cancelled`,
      metadata: { plan, billing },
      allow_promotion_codes: true,
      subscription_data: {
        trial_period_days: 14,
        metadata: { plan, billing },
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Checkout failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
