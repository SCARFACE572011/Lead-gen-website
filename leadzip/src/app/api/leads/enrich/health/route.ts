import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { DigitalHealthDetails } from '@/types/lead'

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

function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    const hostname = parsed.hostname

    // Block localhost and loopback
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname === '::1'
    ) {
      return false
    }

    // Block private/link-local IPv4 ranges
    if (hostname.startsWith('10.')) return false
    if (hostname.startsWith('192.168.')) return false
    if (hostname.startsWith('169.254.')) return false
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) return false

    // Block IPv6 ULA ranges
    if (hostname.startsWith('fc00:')) return false
    if (hostname.startsWith('fd')) return false

    return true
  } catch {
    return false
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

  const url = website.startsWith('http') ? website : `https://${website}`

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
