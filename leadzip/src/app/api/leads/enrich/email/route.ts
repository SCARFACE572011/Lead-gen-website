import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { enrichEmailLimiter, checkRateLimit } from '@/lib/ratelimit'

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

export async function POST(request: Request) {
  // 1. Auth check
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Rate limit
  const { success, retryAfter } = await checkRateLimit(enrichEmailLimiter, user.id)
  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests', retryAfter },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
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
