import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { enrichEmailLimiter, checkRateLimit } from '@/lib/ratelimit'
import { requireActiveUser } from '@/lib/requireActiveUser'

const HOSTNAME_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/

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

/** Copy shown to a free user who taps Find Email. Also the string the lead
 *  components match on, so keep the `upgradeRequired` flag alongside it. */
const UPGRADE_MESSAGE =
  'The email finder is part of Pro. Upgrade to look up decision-maker emails.'

export async function POST(request: Request) {
  // 1. Auth + plan check — signed in, still active, and on a paid plan. ONE
  //    users_profile round trip covers all three.
  const supabase = await createClient()
  const auth = await requireActiveUser(supabase, { columns: ['plan', 'role'] })
  if (!auth.ok) return auth.response
  const { user } = auth

  // 1b. Plan fence. Every lookup below spends a Hunter.io credit from a small
  //     monthly pool, and the email finder is sold as a Pro feature on the
  //     pricing page, the landing page, the SEO pages and in the chat answers.
  //     Free accounts were reaching it anyway, which both leaked credits and
  //     contradicted our own advertising.
  if (!auth.profile) {
    // No profile row, or the read failed. Refuse rather than guess: guessing
    // "paid" spends credits, guessing "free" shows a paying customer an upgrade
    // wall. Neither is acceptable, so answer honestly and let them retry.
    console.warn('[enrich/email] users_profile unavailable, refusing rather than spending a credit')
    return NextResponse.json(
      { error: 'Email lookup is temporarily unavailable. Please retry in a moment.' },
      { status: 503, headers: { 'Retry-After': '30' } }
    )
  }

  const plan = (auth.profile.plan as string | undefined) ?? 'free'
  const role = (auth.profile.role as string | undefined) ?? 'user'
  if (plan === 'free' && role !== 'admin') {
    return NextResponse.json(
      { error: UPGRADE_MESSAGE, upgradeRequired: true },
      { status: 403 }
    )
  }

  // 2. Rate limit
  try {
    const { success, retryAfter } = await checkRateLimit(enrichEmailLimiter, user.id)
    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests', retryAfter },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      )
    }
  } catch (err) {
    // Limiter outage: fail CLOSED. Every call here spends Hunter.io credits.
    console.warn('[enrich/email] rate limiter error, failing closed', err)
    return NextResponse.json(
      { error: 'Email lookup is temporarily unavailable. Please retry in a moment.', retryAfter: 30 },
      { status: 503, headers: { 'Retry-After': '30' } }
    )
  }

  // 3. Parse request body
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const body = raw as { domain?: string }
  if (!body.domain || !body.domain.trim()) {
    return NextResponse.json({ error: 'domain is required' }, { status: 400 })
  }

  const domain = parseDomain(body.domain)
  if (!domain) {
    return NextResponse.json(
      { error: 'domain could not be parsed into a valid hostname' },
      { status: 422 }
    )
  }

  // 4. Hunter.io lookup (when API key is configured)
  const hunterKey = process.env.HUNTER_API_KEY
  if (hunterKey) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)
    try {
      const url = `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&api_key=${hunterKey}&limit=1`
      const res = await fetch(url, { signal: controller.signal })
      if (res.ok) {
        const json = (await res.json()) as {
          data?: { emails?: { value: string; score?: number }[] }
        }
        const emails = json.data?.emails ?? []
        if (emails.length > 0) {
          const top = emails[0]
          return NextResponse.json({
            email: top.value,
            confidence: (top.score ?? 0) >= 90 ? 'verified' : 'likely',
          })
        }
      } else {
        console.warn(`enrich/email: Hunter.io responded ${res.status} for domain lookup`)
      }
    } catch (err) {
      // Fall through to pattern generation
      console.warn('enrich/email: Hunter.io request failed', err)
    } finally {
      clearTimeout(timeoutId)
    }
  }

  // 5. Pattern generation fallback
  return NextResponse.json({ email: `info@${domain}`, confidence: 'guessed' })
}
