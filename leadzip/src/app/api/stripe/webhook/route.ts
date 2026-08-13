import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import nodemailer from 'nodemailer'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import {
  STRIPE_API_VERSION,
  subscriptionPeriods,
  resolveUserId,
  syncSubscriptionRow,
  syncProfilePlan,
} from '@/lib/stripe/subscriptionSync'
import { SITE_URL } from '@/lib/siteUrl'

export const runtime = 'nodejs'

const siteUrl = SITE_URL

/* ------------------------------------------------------------------ *
 * Google Ads Offline Conversion Import feed
 *
 * A paid LeadZipp subscription happens on Stripe's servers, days after the ad
 * click, so the browser is long gone and no client-side tag can report it. The
 * bridge is the Google click id: captured from ?gclid=... into a first-party
 * cookie (src/lib/analytics.ts), written onto users_profile.gclid at signup,
 * and read back here when money actually moves.
 *
 * This emits the structured line. It does NOT upload anything. The upload
 * integration is deliberately out of scope, but every field Google needs
 * (gclid, conversion time, value, currency) is in the log from today, so the
 * data exists before the integration does.
 *
 * Two triggers emit a line, both prefixed [offline-conversion]:
 *   kind=invoice_paid        the revenue event. Upload these.
 *   kind=subscription_active the same conversion seen from the subscription
 *                            side. It exists so the signal survives if invoice
 *                            events are ever disabled on the endpoint. Treat it
 *                            as a fallback, not as extra revenue.
 * Deduplicate on dedupe_key within a kind, and on (gclid, day) across kinds.
 * ------------------------------------------------------------------ */

/**
 * Read the stored Google click id for a user.
 *
 * Feature detects users_profile.gclid. That column arrives with
 * supabase/migrations/20260812_gclid.sql, and a database that has not run the
 * migration yet must not break the webhook. A missing column comes back as a
 * PostgREST error rather than a throw, so every failure mode resolves to null.
 */
async function readProfileGclid(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('users_profile')
      .select('gclid')
      .eq('id', userId)
      .maybeSingle()

    if (error) return null
    const gclid = (data as { gclid?: string | null } | null)?.gclid
    return typeof gclid === 'string' && gclid.length > 0 ? gclid : null
  } catch {
    return null
  }
}

/**
 * Emit one offline-conversion line. Amounts are in major currency units
 * (dollars, not cents) because that is what Google Ads expects as a conversion
 * value. Contains no email and no name: only an internal user id and the click
 * id, both of which are required to attribute the conversion.
 */
function logOfflineConversion(fields: {
  kind: 'invoice_paid' | 'subscription_active'
  dedupeKey: string
  userId: string
  gclid: string | null
  amount: number | null
  currency: string | null
  /**
   * Stripe's billing_reason where available. Lets the uploader tell a $0
   * trial-start invoice (subscription_create) apart from real revenue
   * (subscription_cycle, subscription_update) without guessing from the amount.
   */
  reason?: string | null
}): void {
  console.log(
    `[offline-conversion] ${JSON.stringify({
      kind: fields.kind,
      dedupe_key: fields.dedupeKey,
      user_id: fields.userId,
      gclid: fields.gclid,
      amount: fields.amount,
      currency: fields.currency ? fields.currency.toUpperCase() : null,
      reason: fields.reason ?? null,
      timestamp: new Date().toISOString(),
    })}`
  )
}

// Reminder sent on customer.subscription.trial_will_end (fires ~3 days before
// the trial ends). Same nodemailer + Gmail SMTP pattern as send-reset-email.
// Failures are logged, never thrown: a bounced email must not 500 the webhook
// (Stripe would retry and double-send to everyone else).
async function sendTrialEndingEmail(
  supabase: SupabaseClient,
  userId: string,
  subscription: Stripe.Subscription
): Promise<void> {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.error('stripe/webhook: GMAIL_USER/GMAIL_APP_PASSWORD not configured, skipping trial reminder')
    return
  }

  const { data: profile } = await supabase
    .from('users_profile')
    .select('email, full_name')
    .eq('id', userId)
    .maybeSingle()

  let email: string | null = profile?.email ?? null
  if (!email) {
    const { data: authUser } = await supabase.auth.admin.getUserById(userId)
    email = authUser?.user?.email ?? null
  }
  if (!email) {
    console.error(`stripe/webhook: no email found for user ${userId}, skipping trial reminder`)
    return
  }

  const firstName = (profile?.full_name || '').trim().split(/\s+/)[0] || 'there'
  const planKey = subscription.metadata?.plan || 'pro'
  const planName = planKey.charAt(0).toUpperCase() + planKey.slice(1)

  const item = subscription.items.data[0]
  const unitAmount = item?.price?.unit_amount ?? null
  const interval = item?.price?.recurring?.interval === 'year' ? 'year' : 'month'
  const amountText =
    unitAmount != null
      ? `$${(unitAmount % 100 === 0 ? unitAmount / 100 : (unitAmount / 100).toFixed(2))}`
      : 'your plan price'

  const trialEndDate = subscription.trial_end
    ? new Date(subscription.trial_end * 1000).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : 'in 3 days'

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  })

  await transporter.sendMail({
    from: `"LeadZipp" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: `Your LeadZipp trial ends in 3 days`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FBFAF6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FBFAF6;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;border:1px solid #E7E1D4;overflow:hidden;">

        <!-- Header -->
        <tr>
          <td style="background:#FF4D23;padding:28px 32px;text-align:center;">
            <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
              <tr>
                <td style="background:rgba(255,255,255,0.15);border-radius:10px;padding:8px 12px;">
                  <span style="color:#ffffff;font-size:20px;font-weight:800;letter-spacing:-0.5px;">📍 LeadZipp</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 32px 28px;">
            <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#17130E;">Your free trial ends in 3 days</h1>
            <p style="margin:0 0 16px;font-size:15px;color:#423B32;line-height:1.6;">
              Hi ${firstName}, your 7-day free trial of the LeadZipp <strong style="color:#17130E;">${planName}</strong> plan ends on <strong style="color:#17130E;">${trialEndDate}</strong>.
            </p>
            <p style="margin:0 0 16px;font-size:15px;color:#423B32;line-height:1.6;">
              After that, the card on file will be charged <strong style="color:#17130E;">${amountText} per ${interval}</strong> for the ${planName} plan. If a discount is attached to your subscription, it is applied automatically to that first invoice. No action is needed to keep your access.
            </p>
            <p style="margin:0 0 28px;font-size:15px;color:#423B32;line-height:1.6;">
              Want to cancel instead? Open Settings, go to Plan &amp; Usage, and click Manage Billing before your trial ends. You will not be charged.
            </p>

            <!-- CTA Button -->
            <table cellpadding="0" cellspacing="0" style="margin:0 auto 8px;">
              <tr>
                <td style="background:#FF4D23;border-radius:10px;">
                  <a href="${siteUrl}/settings" style="display:block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:-0.2px;">
                    Manage my subscription
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Divider -->
        <tr><td style="padding:0 32px;"><div style="height:1px;background:#E7E1D4;"></div></td></tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px 28px;">
            <p style="margin:0;font-size:12px;color:#79705F;line-height:1.6;">
              You are receiving this email because you started a LeadZipp free trial with this address.
            </p>
            <p style="margin:8px 0 0;font-size:12px;color:#79705F;">
              © ${new Date().getFullYear()} LeadZipp · <a href="${siteUrl}" style="color:#E23A12;">leadzipp.com</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
  })
}

// IMPORTANT: Stripe webhooks require raw body — disable body parsing
export async function POST(request: NextRequest) {
  // Reachable before the signature check, so the body must not describe our
  // config. Status stays 503 so Stripe keeps retrying once the env is fixed.
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('stripe/webhook: STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET is not configured')
    return NextResponse.json({ error: 'Webhook unavailable' }, { status: 503 })
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: STRIPE_API_VERSION })
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')!

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err: unknown) {
    // Anyone can POST here, and Stripe's verification error text describes the
    // expected signature and timestamp tolerance, so it is logged, not returned.
    // Status stays 400: a signature failure is permanent, so Stripe should not
    // retry it.
    console.error('stripe/webhook: signature verification failed', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
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

    // 'created' and 'updated' share one handler: a subscription born in
    // 'trialing' (7-day free trial) must grant the same plan access as
    // 'active' from the moment it exists, not only on its first update.
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription
      // Only 'active'/'trialing' grant paid access. Any other status
      // (past_due, unpaid, canceled, incomplete, incomplete_expired, paused)
      // must drop the user to 'free' so a lapsed sub can't keep full access.
      const paidPlan = subscription.metadata?.plan || 'pro'
      const isActive =
        subscription.status === 'active' || subscription.status === 'trialing'
      const plan = isActive ? paidPlan : 'free'
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

      // Subscription becoming active: either a trial converting to paid, or a
      // brand-new subscription that skipped the trial. Gated on the transition
      // so a routine 'updated' event on an already-active subscription (a card
      // change, a metadata edit) does not re-emit the conversion.
      const previousStatus = (
        event.data as { previous_attributes?: { status?: Stripe.Subscription.Status } }
      ).previous_attributes?.status
      const becameActive =
        subscription.status === 'active' &&
        (event.type === 'customer.subscription.created' ||
          (previousStatus !== undefined && previousStatus !== 'active'))

      if (becameActive) {
        const unitAmount = subscription.items.data[0]?.price?.unit_amount ?? null
        logOfflineConversion({
          kind: 'subscription_active',
          dedupeKey: `sub_${subscription.id}_${periodStart}`,
          userId,
          gclid: await readProfileGclid(supabase, userId),
          // List price, so it ignores any coupon. Another reason the
          // invoice_paid line is the authoritative one for revenue.
          amount: unitAmount != null ? unitAmount / 100 : null,
          currency: subscription.items.data[0]?.price?.currency ?? null,
          reason: `status_${previousStatus ?? 'new'}_to_active`,
        })
      }
      break
    }

    // The money event. Fires when a trial converts to paid and on every
    // renewal, and it is the only event carrying a settled amount and currency.
    case 'invoice.paid': {
      const invoice = event.data.object as Stripe.Invoice
      const customerId =
        typeof invoice.customer === 'string'
          ? invoice.customer
          : invoice.customer?.id ?? null

      // Stripe moved the subscription link under parent.subscription_details in
      // the API version this app pins (2026-04-22.dahlia).
      const details = invoice.parent?.subscription_details ?? null
      if (!details) break // Not a subscription invoice, so not a conversion.

      const { userId, dbError } = await resolveUserId(
        supabase,
        details.metadata?.user_id,
        customerId
      )
      if (dbError) {
        return NextResponse.json({ error: `Failed to resolve user: ${dbError}` }, { status: 500 })
      }
      if (!userId) {
        console.error(`stripe/webhook: no user_id resolvable for invoice ${invoice.id}`)
        break
      }

      logOfflineConversion({
        kind: 'invoice_paid',
        dedupeKey: `invoice_${invoice.id}`,
        userId,
        gclid: await readProfileGclid(supabase, userId),
        amount: invoice.amount_paid / 100,
        currency: invoice.currency,
        reason: invoice.billing_reason,
      })
      break
    }

    case 'customer.subscription.trial_will_end': {
      // Fires ~3 days before the trial ends. Send the "you will be charged"
      // reminder email. Email failure is logged but never fails the webhook.
      const subscription = event.data.object as Stripe.Subscription
      const customerId = subscription.customer as string

      const { userId, dbError } = await resolveUserId(
        supabase,
        subscription.metadata?.user_id,
        customerId
      )
      if (dbError) {
        return NextResponse.json({ error: `Failed to resolve user: ${dbError}` }, { status: 500 })
      }
      if (!userId) {
        console.error(`stripe/webhook: no user_id resolvable for trial_will_end on ${subscription.id}`)
        break
      }

      try {
        await sendTrialEndingEmail(supabase, userId, subscription)
      } catch (err) {
        console.error('stripe/webhook: failed to send trial reminder email', err)
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
