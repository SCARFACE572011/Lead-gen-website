import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { DigitalHealthDetails } from '@/types/lead'
import { enrichHealthLimiter, checkRateLimit } from '@/lib/ratelimit'
import { safeProbe } from '@/lib/safeFetch'

const SIGNAL_POINTS: Record<keyof DigitalHealthDetails, number> = {
  hasWebsite: 10,
  hasHttps: 5,
  mobileResponsive: 10,
  hasAnalytics: 10,
  hasGoogleAds: 15,
  hasFacebookAds: 15,
  hasGBP: 15,
  hasContactForm: 10,
  fastLoad: 10,
}

function computeScore(details: DigitalHealthDetails): number {
  return (Object.keys(details) as (keyof DigitalHealthDetails)[]).reduce(
    (sum, key) => sum + (details[key] ? SIGNAL_POINTS[key] : 0),
    0
  )
}

// SSRF protection is NOT implemented here. It lives in src/lib/safeFetch.ts,
// shared with the audit probe in src/lib/healthScore.ts, because this route
// previously carried a byte-for-byte copy of a hostname-string guard and the
// two copies could drift. That guard was bypassable with a public wildcard
// resolver (169.254.169.254.nip.io and friends); safeProbe resolves DNS,
// rejects every non-public address, pins the socket to the validated address,
// and repeats the whole check on each redirect hop.
const MAX_BYTES = 512 * 1024
const MAX_REDIRECTS = 3

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { success, retryAfter } = await checkRateLimit(enrichHealthLimiter, user.id)
    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests', retryAfter },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      )
    }
  } catch (err) {
    // Limiter outage: fail CLOSED. This route makes an outbound request to a
    // user-supplied host, so it must never run unmetered.
    console.warn('[enrich/health] rate limiter unavailable — failing closed', err)
    return NextResponse.json(
      { error: 'Health checks are temporarily unavailable. Please try again in a moment.', retryAfter: 30 },
      { status: 503, headers: { 'Retry-After': '30' } }
    )
  }

  let body: { website?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const website = (body.website ?? '').trim()
  if (!website) {
    return NextResponse.json({ error: 'website is required' }, { status: 400 })
  }

  const url = /^https?:\/\//i.test(website) ? website : `https://${website}`

  let html = ''
  let fetchMs = 0
  try {
    const res = await safeProbe(url, {
      timeoutMs: 5000,
      maxBytes: MAX_BYTES,
      maxRedirects: MAX_REDIRECTS,
      userAgent: 'Mozilla/5.0 (compatible; LeadZipp/1.0)',
    })
    if (!res.ok) {
      return NextResponse.json({ error: 'unreachable' })
    }
    html = res.body
    fetchMs = res.elapsedMs
  } catch {
    // Refused by the SSRF guard, DNS failure, timeout or transport error. The
    // caller gets the same opaque answer either way so this cannot be used to
    // probe what does or does not exist on the internal network.
    return NextResponse.json({ error: 'unreachable' })
  }

  const details: DigitalHealthDetails = {
    hasWebsite: true,
    hasHttps: url.startsWith('https://'),
    mobileResponsive:
      html.includes('<meta name="viewport"') ||
      html.includes("<meta name='viewport'"),
    hasAnalytics:
      html.includes('gtag.js') ||
      html.includes('analytics.js') ||
      html.includes("'G-") ||
      html.includes('"G-') ||
      html.includes("'UA-") ||
      html.includes('"UA-') ||
      html.includes('_ga'),
    hasGoogleAds:
      html.includes('googleadservices.com') ||
      html.includes("'AW-") ||
      html.includes('"AW-'),
    hasFacebookAds: html.includes('connect.facebook.net/en_US/fbevents.js'),
    hasGBP:
      html.includes('maps.google.com') ||
      html.includes('google.com/maps'),
    hasContactForm:
      html.includes('<form') ||
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(html),
    fastLoad: fetchMs < 3000,
  }

  return NextResponse.json({ score: computeScore(details), details })
}
