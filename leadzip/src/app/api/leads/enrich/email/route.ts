import { NextResponse } from 'next/server'
import { createClient as createServiceClient, type SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { enrichEmailLimiter, checkRateLimit } from '@/lib/ratelimit'
import { requireActiveUser } from '@/lib/requireActiveUser'
import {
  emailCreditPacksEnabled,
  prepareEmailCreditAccount,
  readEmailCreditBalance,
} from '@/lib/emailCredits'

export const runtime = 'nodejs'

const HOSTNAME_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const NO_STORE_HEADERS = { 'Cache-Control': 'private, no-store' }

interface ClaimRow {
  claim_status: 'cached' | 'pending' | 'exhausted' | 'claimed'
  cached_email?: string | null
  cached_confidence?: 'verified' | 'likely' | 'guessed' | null
  cached_source?: 'hunter' | 'guess' | null
  credit_charged?: boolean | null
  remaining?: number | null
  reservation_id?: string | null
  retry_after?: number | null
}

function parseDomain(raw: string): string | null {
  const input = raw.trim().toLowerCase()
  if (!input) return null

  let parsed: URL
  try {
    parsed = new URL(input.includes('://') ? input : `https://${input}`)
  } catch {
    return null
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null

  const host = parsed.hostname.replace(/^www\./, '')
  if (!host || !HOSTNAME_RE.test(host)) return null

  return host
}

function firstClaim(data: unknown): ClaimRow | null {
  if (Array.isArray(data)) return (data[0] as ClaimRow | undefined) ?? null
  return (data as ClaimRow | null) ?? null
}

async function claimLookup(
  db: SupabaseClient,
  input: { ownerId: string; actorUserId: string; domain: string; claimToken: string }
): Promise<ClaimRow> {
  const { data, error } = await db.rpc('claim_email_lookup', {
    p_owner_id: input.ownerId,
    p_actor_user_id: input.actorUserId,
    p_domain: input.domain,
    p_claim_token: input.claimToken,
  })
  if (error) throw new Error(error.message)
  const claim = firstClaim(data)
  if (!claim) throw new Error('Email lookup claim returned no result.')
  return claim
}

async function abortLookup(
  db: SupabaseClient,
  domain: string,
  claimToken: string,
  reason: string
): Promise<number> {
  const { data, error } = await db.rpc('abort_email_lookup', {
    p_domain: domain,
    p_claim_token: claimToken,
    p_reason: reason,
  })
  if (error) throw new Error(error.message)
  return Number(data ?? 0)
}

async function completeLookup(
  db: SupabaseClient,
  input: {
    domain: string
    claimToken: string
    email: string
    confidence: 'verified' | 'likely' | 'guessed'
    source: 'hunter' | 'guess'
    keepCharge: boolean
    expiresAt: string | null
  }
): Promise<number> {
  const { data, error } = await db.rpc('complete_email_lookup', {
    p_domain: input.domain,
    p_claim_token: input.claimToken,
    p_email: input.email,
    p_confidence: input.confidence,
    p_source: input.source,
    p_keep_charge: input.keepCharge,
    p_result_expires_at: input.expiresAt,
  })
  if (error) throw new Error(error.message)
  return Number(data ?? 0)
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const auth = await requireActiveUser(supabase)
  if (!auth.ok) return auth.response
  const { user } = auth

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON' },
      { status: 400, headers: NO_STORE_HEADERS }
    )
  }

  const body = raw as { domain?: unknown }
  if (typeof body.domain !== 'string' || !body.domain.trim()) {
    return NextResponse.json(
      { error: 'domain is required' },
      { status: 400, headers: NO_STORE_HEADERS }
    )
  }

  const domain = parseDomain(body.domain)
  if (!domain) {
    return NextResponse.json(
      { error: 'domain could not be parsed into a valid hostname' },
      { status: 422, headers: NO_STORE_HEADERS }
    )
  }

  // Keep burst protection in addition to durable credits. Credits control cost;
  // this protects the provider and app from rapid scripted traffic.
  try {
    const { success, retryAfter } = await checkRateLimit(enrichEmailLimiter, user.id)
    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests', retryAfter },
        {
          status: 429,
          headers: { ...NO_STORE_HEADERS, 'Retry-After': String(retryAfter) },
        }
      )
    }
  } catch (error) {
    console.warn('[enrich/email] rate limiter error, failing closed', error)
    return NextResponse.json(
      { error: 'Email lookup is temporarily unavailable. Please retry in a moment.' },
      {
        status: 503,
        headers: { ...NO_STORE_HEADERS, 'Retry-After': '30' },
      }
    )
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[enrich/email] Supabase service credentials are not configured')
    return NextResponse.json(
      { error: 'Email lookup is temporarily unavailable. Please retry in a moment.' },
      { status: 503, headers: NO_STORE_HEADERS }
    )
  }

  const db = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  let context
  try {
    context = await prepareEmailCreditAccount(db, user.id)
  } catch (error) {
    console.error('[enrich/email] failed to prepare credit account', error)
    return NextResponse.json(
      { error: 'Email lookup is temporarily unavailable. Please retry in a moment.' },
      { status: 503, headers: NO_STORE_HEADERS }
    )
  }

  const hunterKey = process.env.HUNTER_API_KEY
  if (!hunterKey) {
    // A deterministic guess has no upstream cost. Do not debit a customer when
    // the real provider is not configured.
    const balance = await readEmailCreditBalance(db, context).catch(() => null)
    return NextResponse.json(
      {
        email: `info@${domain}`,
        confidence: 'guessed',
        source: 'guess',
        creditCharged: false,
        remaining: balance?.totalRemaining ?? 0,
      },
      { headers: NO_STORE_HEADERS }
    )
  }

  const claimToken = crypto.randomUUID()
  let claim: ClaimRow
  try {
    claim = await claimLookup(db, {
      ownerId: context.ownerId,
      actorUserId: user.id,
      domain,
      claimToken,
    })

    // Most duplicate clicks finish within a second. Briefly follow the first
    // request so the second click receives the cached answer instead of an
    // unnecessary error, while the DB lease still guarantees one provider call.
    for (const delay of [250, 500, 750, 1_000]) {
      if (claim.claim_status !== 'pending') break
      await wait(delay)
      claim = await claimLookup(db, {
        ownerId: context.ownerId,
        actorUserId: user.id,
        domain,
        claimToken,
      })
    }
  } catch (error) {
    console.error('[enrich/email] failed to claim lookup credit', error)
    return NextResponse.json(
      { error: 'Email lookup is temporarily unavailable. Please retry in a moment.' },
      { status: 503, headers: NO_STORE_HEADERS }
    )
  }

  if (claim.claim_status === 'cached' && claim.cached_email) {
    return NextResponse.json(
      {
        email: claim.cached_email,
        confidence: claim.cached_confidence || 'guessed',
        source: claim.cached_source || 'guess',
        cached: true,
        creditCharged: false,
        remaining: Number(claim.remaining ?? 0),
      },
      { headers: NO_STORE_HEADERS }
    )
  }

  if (claim.claim_status === 'pending') {
    const retryAfter = Math.max(1, Number(claim.retry_after ?? 1))
    return NextResponse.json(
      {
        error: 'That email lookup is already running. Please try again in a moment.',
        lookupPending: true,
        creditCharged: false,
        remaining: Number(claim.remaining ?? 0),
        retryAfter,
      },
      {
        status: 409,
        headers: { ...NO_STORE_HEADERS, 'Retry-After': String(retryAfter) },
      }
    )
  }

  if (claim.claim_status === 'exhausted') {
    return NextResponse.json(
      {
        error: 'You have used all of your email finder credits.',
        creditsRequired: true,
        upgradeRequired: context.plan === 'free',
        purchaseAvailable: emailCreditPacksEnabled() && !context.isShared,
        remaining: 0,
      },
      { status: 402, headers: NO_STORE_HEADERS }
    )
  }

  if (claim.claim_status !== 'claimed') {
    return NextResponse.json(
      { error: 'Email lookup is temporarily unavailable. Please retry in a moment.' },
      { status: 503, headers: NO_STORE_HEADERS }
    )
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 5_000)

  try {
    const url =
      `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}` +
      `&api_key=${encodeURIComponent(hunterKey)}&limit=1`
    const response = await fetch(url, { signal: controller.signal })

    if (!response.ok) {
      console.warn(`[enrich/email] Hunter.io responded ${response.status}`)
      const remaining = await abortLookup(
        db,
        domain,
        claimToken,
        `provider_http_${response.status}`
      )
      return NextResponse.json(
        {
          email: `info@${domain}`,
          confidence: 'guessed',
          source: 'guess',
          creditCharged: false,
          remaining,
        },
        { headers: NO_STORE_HEADERS }
      )
    }

    const json = (await response.json()) as {
      data?: { emails?: { value?: string; score?: number }[] }
    }
    const top = json.data?.emails?.find(
      (candidate) => typeof candidate.value === 'string' && EMAIL_RE.test(candidate.value)
    )

    if (top?.value) {
      const confidence = (top.score ?? 0) >= 90 ? 'verified' : 'likely'
      const remaining = await completeLookup(db, {
        domain,
        claimToken,
        email: top.value,
        confidence,
        source: 'hunter',
        keepCharge: true,
        expiresAt: new Date(Date.now() + 90 * 86_400_000).toISOString(),
      })
      return NextResponse.json(
        {
          email: top.value,
          confidence,
          source: 'hunter',
          creditCharged: true,
          remaining,
        },
        { headers: NO_STORE_HEADERS }
      )
    }

    // Hunter does not charge when no address is found. Refund our reservation
    // too and cache the deterministic fallback for 30 days.
    const remaining = await completeLookup(db, {
      domain,
      claimToken,
      email: `info@${domain}`,
      confidence: 'guessed',
      source: 'guess',
      keepCharge: false,
      expiresAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
    })
    return NextResponse.json(
      {
        email: `info@${domain}`,
        confidence: 'guessed',
        source: 'guess',
        creditCharged: false,
        remaining,
      },
      { headers: NO_STORE_HEADERS }
    )
  } catch (error) {
    console.warn('[enrich/email] Hunter.io request or completion failed', error)
    try {
      // If the completion transaction committed but its HTTP response was
      // interrupted, abort is a no-op and the durable cache contains the real
      // result. Read it back before falling back so we neither hide a charged
      // result nor tell the client that no credit was spent.
      const remaining = await abortLookup(db, domain, claimToken, 'provider_request_failed')
      const { data: recovered } = await db
        .from('email_lookup_cache')
        .select('state, email, confidence, source, completion_token, result_expires_at')
        .eq('domain', domain)
        .in('state', ['found', 'guessed'])
        .maybeSingle()

      const recoveredExpiry = recovered?.result_expires_at
        ? new Date(recovered.result_expires_at).getTime()
        : Number.POSITIVE_INFINITY
      if (
        recovered?.email &&
        (recovered.source === 'hunter' || recovered.source === 'guess') &&
        recoveredExpiry > Date.now()
      ) {
        const balance = await readEmailCreditBalance(db, context).catch(() => null)
        return NextResponse.json(
          {
            email: recovered.email,
            confidence: recovered.confidence || 'guessed',
            source: recovered.source,
            cached: true,
            creditCharged:
              recovered.source === 'hunter' && recovered.completion_token === claimToken,
            remaining: balance?.totalRemaining ?? remaining,
          },
          { headers: NO_STORE_HEADERS }
        )
      }

      return NextResponse.json(
        {
          email: `info@${domain}`,
          confidence: 'guessed',
          source: 'guess',
          creditCharged: false,
          remaining,
        },
        { headers: NO_STORE_HEADERS }
      )
    } catch (refundError) {
      console.error('[enrich/email] failed to refund aborted lookup', refundError)
      return NextResponse.json(
        { error: 'Email lookup is temporarily unavailable. Please retry in a moment.' },
        { status: 503, headers: NO_STORE_HEADERS }
      )
    }
  } finally {
    clearTimeout(timeoutId)
  }
}
