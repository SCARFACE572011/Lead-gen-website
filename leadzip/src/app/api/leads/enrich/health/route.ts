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
    html = await res.text()
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
