import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { requireActiveUser } from '@/lib/requireActiveUser'
import {
  emailCreditPackBySlug,
  emailCreditPackByPriceId,
  emailCreditPacksEnabled,
  prepareEmailCreditAccount,
} from '@/lib/emailCredits'
import { SITE_URL } from '@/lib/siteUrl'
import { STRIPE_API_VERSION } from '@/lib/stripe/subscriptionSync'

export const runtime = 'nodejs'

const NO_STORE_HEADERS = { 'Cache-Control': 'private, no-store' }

export async function POST(request: NextRequest) {
  const supabase = await createServerClient()
  const auth = await requireActiveUser(supabase)
  if (!auth.ok) return auth.response

  // Pack checkout is intentionally dark until commercial data redistribution
  // permission is confirmed. Missing/false is disabled; only literal true opens it.
  if (!emailCreditPacksEnabled()) {
    return NextResponse.json(
      { error: 'Email credit packs are not available yet.' },
      { status: 503, headers: NO_STORE_HEADERS }
    )
  }

  if (
    !process.env.STRIPE_SECRET_KEY ||
    process.env.STRIPE_SECRET_KEY.includes('placeholder') ||
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    console.error('[credits/email/checkout] billing or database credentials are unavailable')
    return NextResponse.json(
      { error: 'Billing is temporarily unavailable.' },
      { status: 503, headers: NO_STORE_HEADERS }
    )
  }

  let body: { pack?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body.' },
      { status: 400, headers: NO_STORE_HEADERS }
    )
  }

  // The client sends only this allowlisted slug. Credits and price are always
  // selected on the server and then verified again in the webhook.
  const pack = emailCreditPackBySlug(body.pack)
  if (!pack) {
    return NextResponse.json(
      { error: 'Invalid email credit pack.' },
      { status: 400, headers: NO_STORE_HEADERS }
    )
  }
  if (!pack.configured || !pack.priceId) {
    console.error(`[credits/email/checkout] Stripe Price is missing for pack=${pack.slug}`)
    return NextResponse.json(
      { error: 'That email credit pack is temporarily unavailable.' },
      { status: 503, headers: NO_STORE_HEADERS }
    )
  }
  const authoritativePack = emailCreditPackByPriceId(pack.priceId)
  if (!authoritativePack || authoritativePack.slug !== pack.slug) {
    console.error(`[credits/email/checkout] duplicate or ambiguous Price for pack=${pack.slug}`)
    return NextResponse.json(
      { error: 'That email credit pack is temporarily unavailable.' },
      { status: 503, headers: NO_STORE_HEADERS }
    )
  }

  const db = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  let context
  try {
    context = await prepareEmailCreditAccount(db, auth.user.id)
  } catch (error) {
    console.error('[credits/email/checkout] failed to prepare credit account', error)
    return NextResponse.json(
      { error: 'Email credit packs are temporarily unavailable.' },
      { status: 503, headers: NO_STORE_HEADERS }
    )
  }

  // Shared credits are billed to the workspace owner. A teammate can consume
  // them but cannot initiate a purchase against someone else's billing record.
  if (context.ownerId !== auth.user.id) {
    return NextResponse.json(
      { error: 'Ask your workspace owner to purchase more email credits.' },
      { status: 403, headers: NO_STORE_HEADERS }
    )
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: STRIPE_API_VERSION,
  })

  try {
    // Catch a wrong or edited Dashboard Price before a customer sees Checkout.
    const price = await stripe.prices.retrieve(pack.priceId)
    if (
      !price.active ||
      price.type !== 'one_time' ||
      price.currency.toLowerCase() !== 'usd' ||
      price.unit_amount !== pack.amountCents
    ) {
      console.error(
        `[credits/email/checkout] Stripe Price mismatch for pack=${pack.slug} price=${pack.priceId}`
      )
      return NextResponse.json(
        { error: 'That email credit pack is temporarily unavailable.' },
        { status: 503, headers: NO_STORE_HEADERS }
      )
    }

    const { data: subscription } = await db
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', context.ownerId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    let customerId = (subscription?.stripe_customer_id as string | null | undefined) ?? null
    if (customerId) {
      try {
        const customer = await stripe.customers.retrieve(customerId)
        if (customer.deleted) customerId = null
      } catch {
        customerId = null
      }
    }

    const metadata = {
      kind: 'email_credit_pack',
      user_id: auth.user.id,
      balance_owner_id: context.ownerId,
      pack_slug: pack.slug,
    }

    // Stripe also deduplicates rapid retries/double-clicks. A new one-minute
    // bucket still lets the owner intentionally purchase the same pack again.
    const checkoutBucket = Math.floor(Date.now() / 60_000)
    const session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [{ price: pack.priceId, quantity: 1 }],
        ...(customerId
          ? { customer: customerId }
          : { customer_email: auth.user.email || undefined }),
        client_reference_id: auth.user.id,
        metadata,
        payment_intent_data: { metadata },
        success_url: `${SITE_URL}/settings?credits=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${SITE_URL}/settings?credits=cancelled`,
      },
      {
        idempotencyKey: `email-pack:${context.ownerId}:${pack.slug}:${checkoutBucket}`,
      }
    )

    if (!session.url) throw new Error('Stripe did not return a Checkout URL.')
    return NextResponse.json({ url: session.url }, { headers: NO_STORE_HEADERS })
  } catch (error) {
    console.error('[credits/email/checkout] failed to create checkout', error)
    return NextResponse.json(
      { error: 'Could not start checkout. Please try again.' },
      { status: 500, headers: NO_STORE_HEADERS }
    )
  }
}
