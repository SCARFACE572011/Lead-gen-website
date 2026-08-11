import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { DigitalHealthDetails } from '@/types/lead'
import { enrichHealthLimiter, checkRateLimit } from '@/lib/ratelimit'

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

// TLDs that only resolve on internal networks — never fetch them server-side
const BLOCKED_TLDS = new Set([
  'localhost',
  'local',
  'internal',
  'intranet',
  'corp',
  'home',
  'lan',
  'test',
])

// The WHATWG URL parser normalizes decimal/octal/hex IPv4 forms
// (e.g. http://2130706433/) to dotted-quad, so octet checks are reliable here.
function isPrivateIpv4(hostname: string): boolean {
  const octets = hostname.split('.').map(Number)
  if (octets.length !== 4 || octets.some((o) => !Number.isInteger(o) || o < 0 || o > 255)) {
    return false // not an IPv4 literal
  }
  const [a, b] = octets
  if (a === 0 || a === 10 || a === 127) return true // "this net", private, loopback
  if (a === 169 && b === 254) return true // link-local
  if (a === 172 && b >= 16 && b <= 31) return true // private
  if (a === 192 && b === 168) return true // private
  if (a === 100 && b >= 64 && b <= 127) return true // CGNAT
  return false
}

function isBlockedIpv6(bracketed: string): boolean {
  const addr = bracketed.slice(1, -1).toLowerCase() // strip [ ]
  if (addr === '::' || addr === '::1') return true // unspecified, loopback
  if (/^fe[89ab]/.test(addr)) return true // link-local fe80::/10
  if (addr.startsWith('fc') || addr.startsWith('fd')) return true // ULA fc00::/7
  if (addr.startsWith('::ffff:')) return true // IPv4-mapped
  if (addr.startsWith('64:ff9b:')) return true // NAT64
  return false
}

function isSafeUrl(url: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }

  // Only plain http/https
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false

  // No embedded credentials
  if (parsed.username || parsed.password) return false

  const hostname = parsed.hostname.toLowerCase()
  if (!hostname) return false

  // IPv6 literals come back bracketed, e.g. [::1]
  if (hostname.startsWith('[')) return !isBlockedIpv6(hostname)

  if (isPrivateIpv4(hostname)) return false

  // Block single-label hosts (only resolvable on internal DNS) and internal TLDs
  const labels = hostname.replace(/\.$/, '').split('.')
  if (labels.length < 2) return false
  if (BLOCKED_TLDS.has(labels[labels.length - 1])) return false

  return true
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { success, retryAfter } = await checkRateLimit(enrichHealthLimiter, user.id)
  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests', retryAfter },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
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

  if (!isSafeUrl(url)) {
    return NextResponse.json({ error: 'unreachable' })
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 5000)
  const fetchStart = Date.now()

  let html = ''
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LeadZip/1.0)' },
    })
    clearTimeout(timeoutId)
    if (!res.ok) {
      return NextResponse.json({ error: 'unreachable' })
    }
    const MAX_BYTES = 512 * 1024
    const reader = res.body?.getReader()
    const chunks: Uint8Array[] = []
    let total = 0
    if (reader) {
      while (true) {
        const { done, value } = await reader.read()
        if (done || !value) break
        chunks.push(value)
        total += value.byteLength
        if (total >= MAX_BYTES) break
      }
    }
    html = new TextDecoder().decode(
      chunks.reduce((acc, chunk) => {
        const merged = new Uint8Array(acc.byteLength + chunk.byteLength)
        merged.set(acc)
        merged.set(chunk, acc.byteLength)
        return merged
      }, new Uint8Array(0))
    )
  } catch {
    clearTimeout(timeoutId)
    return NextResponse.json({ error: 'unreachable' })
  }

  const fetchMs = Date.now() - fetchStart

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
