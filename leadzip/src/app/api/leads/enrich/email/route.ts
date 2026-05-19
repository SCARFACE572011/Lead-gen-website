import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { enrichEmailLimiter, checkRateLimit } from '@/lib/ratelimit'

function parseDomain(raw: string): string {
  return raw
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
    .trim()
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
  const domain = parseDomain(body.domain ?? '')

  if (!domain) {
    return NextResponse.json({ error: 'domain is required' }, { status: 400 })
  }

  // 3. Hunter.io lookup (when API key is configured)
  const hunterKey = process.env.HUNTER_API_KEY
  if (hunterKey) {
    try {
      const url = `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&api_key=${hunterKey}&limit=1`
      const res = await fetch(url)
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
      }
    } catch {
      // Fall through to pattern generation
    }
  }

  // 4. Pattern generation fallback
  return NextResponse.json({ email: `info@${domain}`, confidence: 'guessed' })
}
