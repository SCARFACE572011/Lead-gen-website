import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { requireActiveUser } from '@/lib/requireActiveUser'
import { checkRateLimit, savedSearchesLimiter } from '@/lib/ratelimit'
import {
  configuredEmailCreditPacks,
  emailCreditPacksEnabled,
  isMissingEmailCreditSchema,
  prepareAndReadEmailCreditBalance,
} from '@/lib/emailCredits'

export const runtime = 'nodejs'

const NO_STORE_HEADERS = { 'Cache-Control': 'private, no-store' }

/**
 * Per-user budget for balance reads.
 *
 * This is a dashboard read that costs nothing upstream, so it shares the
 * dashboard-read limiter under its own identifier namespace (the limiter key is
 * prefix + identifier, so this never consumes a saved-search allowance). That
 * limiter degrades to an in-process window instead of throwing on a Redis
 * outage; the try/catch is here so a future policy change to 'deny' cannot turn
 * a Redis blip into a 500.
 */
async function overLimit(userId: string) {
  try {
    const { success, retryAfter } = await checkRateLimit(
      savedSearchesLimiter,
      `credits-email:${userId}`
    )
    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again in a moment.', retryAfter },
        {
          status: 429,
          headers: { ...NO_STORE_HEADERS, 'Retry-After': String(retryAfter) },
        }
      )
    }
  } catch (error) {
    console.warn('[credits/email] rate limiter unavailable', error)
  }
  return null
}

export async function GET() {
  const supabase = await createServerClient()
  const auth = await requireActiveUser(supabase)
  if (!auth.ok) return auth.response

  const limited = await overLimit(auth.user.id)
  if (limited) return limited

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[credits/email] Supabase service credentials are not configured')
    return NextResponse.json(
      { error: 'Email credits are temporarily unavailable.' },
      { status: 503, headers: NO_STORE_HEADERS }
    )
  }

  const db = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  try {
    const balance = await prepareAndReadEmailCreditBalance(db, auth.user.id)
    const packsEnabled = emailCreditPacksEnabled()
    const packs = packsEnabled
      ? configuredEmailCreditPacks()
          .filter((pack) => pack.configured)
          .map(({ slug, credits, amountCents }) => ({ slug, credits, amountCents }))
      : []

    return NextResponse.json(
      {
        ...balance,
        packsEnabled,
        // Agency teammates share the pool but cannot initiate a charge against
        // the billing owner's Stripe customer.
        canPurchasePacks: packsEnabled && !balance.shared && packs.length > 0,
        packs,
      },
      { headers: NO_STORE_HEADERS }
    )
  } catch (error) {
    // The credit tables and RPCs ship in a migration that may not be applied
    // yet. That is a deployment state, not an incident: report the feature as
    // unavailable (clients hide the panel) and keep the log quiet enough to
    // read.
    if (isMissingEmailCreditSchema(error)) {
      console.warn('[credits/email] email-credit migration is not applied yet')
      return NextResponse.json(
        { error: 'Email credits are not available yet.', available: false },
        { status: 503, headers: NO_STORE_HEADERS }
      )
    }
    console.error('[credits/email] failed to read balance', error)
    return NextResponse.json(
      { error: 'Email credits are temporarily unavailable.' },
      { status: 503, headers: NO_STORE_HEADERS }
    )
  }
}
