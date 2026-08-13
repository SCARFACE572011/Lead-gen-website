import type { DigitalHealthDetails } from '@/types/lead'

/**
 * DIGITAL HEALTH SCORE — 0-100, deterministic, fully explainable.
 *
 * Three pillars mirror what a local business actually needs online:
 *   1. Google Maps Profile ... 30 pts  (profile completeness + reputation)
 *   2. Website Quality ....... 35 pts  (has a real site, secure, live)
 *   3. Conversion Signals .... 35 pts  (can a customer actually convert)
 *
 * Every point is attributed to a named pass/fail check, so the score can be
 * shown to a prospect line by line — no black box. The same function powers
 * the instant lead-card badge (profile data only) and the shareable audit
 * report (profile data + live website probe). Checks that would need a live
 * site fetch are scored from conservative profile heuristics when no probe
 * data is available and are flagged `estimated: true` so the UI can say so.
 */

export interface HealthCheck {
  id: string
  label: string
  passed: boolean
  points: number
  /** True when the result is inferred from profile data, not a live site check. */
  estimated?: boolean
}

export interface HealthPillar {
  name: string
  score: number
  max: number
  checks: HealthCheck[]
}

export interface HealthScoreResult {
  total: number
  max: 100
  pillars: HealthPillar[]
  /** True when live website signals were used (audit flow), false for the instant estimate. */
  verified: boolean
}

/** Minimal slice of a lead needed to score it — matches provider fields. */
export interface HealthScoreInput {
  businessName?: string
  phone?: string | null
  website?: string | null
  rating?: number | null
  reviewCount?: number | null
  businessHours?: string[] | null
}

/** Live signals from a server-side website probe (or the enrich/health flow). */
export interface WebsiteSignals {
  reachable: boolean
  https?: boolean
  mobileResponsive?: boolean
  hasAnalytics?: boolean
  hasContactForm?: boolean
  fastLoad?: boolean
}

// Hosts that mean "free page builder / marketplace profile", not a real website.
const FREE_HOST_PATTERNS = [
  'facebook.com',
  'instagram.com',
  'linktr.ee',
  'business.site',
  'sites.google.com',
  'wixsite.com',
  'weebly.com',
  'wordpress.com',
  'blogspot.com',
  'godaddysites.com',
  'squarespace.com',
  'myshopify.com',
  'yelp.com',
  'doordash.com',
  'ubereats.com',
  'grubhub.com',
]

function normalizeUrl(website: string): string {
  const trimmed = website.trim()
  if (!trimmed) return ''
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

function isOwnDomain(website: string): boolean {
  try {
    const host = new URL(normalizeUrl(website)).hostname.toLowerCase()
    return !FREE_HOST_PATTERNS.some((p) => host === p || host.endsWith(`.${p}`))
  } catch {
    return false
  }
}

export function computeHealthScore(
  lead: HealthScoreInput,
  signals?: WebsiteSignals
): HealthScoreResult {
  const hasPhone = Boolean(lead.phone && lead.phone.trim().length > 6)
  const website = (lead.website ?? '').trim()
  const hasWebsite = website.length > 0
  const hasHours = Boolean(lead.businessHours && lead.businessHours.length > 0)
  const rating = lead.rating ?? null
  const reviews = lead.reviewCount ?? 0
  const hasReviews = rating != null && reviews > 0

  // Static HTTPS read from the listed URL; a probe overrides it with the truth
  // after redirects. Scheme-less URLs count as https (that is how we link them).
  const staticHttps = hasWebsite && !/^http:\/\//i.test(website)
  const https = signals?.https ?? staticHttps

  const verified = signals != null
  const siteUp = verified ? signals.reachable : hasWebsite

  // ---- Pillar 1: Google Maps Profile (30) — all from data we already hold ----
  const profileChecks: HealthCheck[] = [
    { id: 'phone_listed', label: 'Phone number on profile', passed: hasPhone, points: 5 },
    { id: 'website_linked', label: 'Website linked on profile', passed: hasWebsite, points: 5 },
    { id: 'hours_listed', label: 'Business hours listed', passed: hasHours, points: 4 },
    { id: 'has_reviews', label: 'Has customer reviews', passed: hasReviews, points: 4 },
    { id: 'reviews_10', label: '10 or more reviews', passed: reviews >= 10, points: 4 },
    { id: 'reviews_50', label: '50 or more reviews', passed: reviews >= 50, points: 3 },
    { id: 'rating_4', label: 'Rating of 4.0 or higher', passed: rating != null && rating >= 4.0, points: 5 },
  ]

  // ---- Pillar 2: Website Quality (35) ----
  const websiteChecks: HealthCheck[] = [
    { id: 'has_website', label: 'Business has a website', passed: hasWebsite, points: 12 },
    { id: 'https', label: 'Secure connection (HTTPS)', passed: hasWebsite && https, points: 8, estimated: !verified },
    { id: 'own_domain', label: 'Own domain (not a free page builder)', passed: hasWebsite && isOwnDomain(website), points: 6 },
    { id: 'site_live', label: 'Website is live and loads', passed: hasWebsite && siteUp, points: 9, estimated: !verified },
  ]

  // ---- Pillar 3: Conversion Signals (35) ----
  // With live signals these are real site checks; without them we fall back to
  // conservative profile heuristics (never assuming marketing tooling exists).
  const mobileFriendly = verified
    ? siteUp && Boolean(signals.mobileResponsive)
    : hasWebsite && staticHttps
  const fastLoad = verified
    ? siteUp && Boolean(signals.fastLoad)
    : hasWebsite && staticHttps
  const contactPath = verified
    ? hasPhone || (siteUp && Boolean(signals.hasContactForm))
    : hasPhone || hasWebsite
  const analytics = verified ? siteUp && Boolean(signals.hasAnalytics) : false

  const conversionChecks: HealthCheck[] = [
    { id: 'phone_reachable', label: 'Reachable by phone', passed: hasPhone, points: 6 },
    { id: 'contact_path', label: 'Clear way for customers to get in touch', passed: contactPath, points: 8, estimated: !verified },
    { id: 'mobile_friendly', label: 'Mobile-friendly website', passed: mobileFriendly, points: 7, estimated: !verified },
    { id: 'fast_load', label: 'Fast server response', passed: fastLoad, points: 7, estimated: !verified },
    { id: 'analytics', label: 'Marketing analytics installed', passed: analytics, points: 7, estimated: !verified },
  ]

  const pillars: HealthPillar[] = [
    buildPillar('Google Maps Profile', 30, profileChecks),
    buildPillar('Website Quality', 35, websiteChecks),
    buildPillar('Conversion Signals', 35, conversionChecks),
  ]

  const total = pillars.reduce((sum, p) => sum + p.score, 0)
  return { total: Math.min(100, total), max: 100, pillars, verified }
}

function buildPillar(name: string, max: number, checks: HealthCheck[]): HealthPillar {
  const score = checks.reduce((sum, c) => sum + (c.passed ? c.points : 0), 0)
  return { name, score: Math.min(max, score), max, checks }
}

export interface HealthGrade {
  label: string
  /** Tailwind text color class for the score number. */
  color: string
  /** Tailwind bg class for bars / badges. */
  bar: string
}

export function getHealthGrade(total: number): HealthGrade {
  if (total >= 80) return { label: 'Strong', color: 'text-green-700', bar: 'bg-green-500' }
  if (total >= 60) return { label: 'Solid', color: 'text-lime-700', bar: 'bg-lime-500' }
  if (total >= 40) return { label: 'Needs work', color: 'text-amber-700', bar: 'bg-amber-400' }
  return { label: 'At risk', color: 'text-red-700', bar: 'bg-red-500' }
}

/** Adapt the existing enrich/health details shape into probe signals. */
export function signalsFromDetails(details: DigitalHealthDetails): WebsiteSignals {
  return {
    reachable: true, // enrich/health only returns details after a successful fetch
    https: details.hasHttps,
    mobileResponsive: details.mobileResponsive,
    hasAnalytics: details.hasAnalytics || details.hasGoogleAds || details.hasFacebookAds,
    hasContactForm: details.hasContactForm,
    fastLoad: details.fastLoad,
  }
}

// ---------------------------------------------------------------------------
// Server-side website probe. NEVER call from the client — it exists so the
// audit flow can verify a site resolves, has SSL, and shows basic conversion
// signals with one short, size-capped fetch.
//
// The SSRF guard lives in src/lib/safeFetch.ts and is shared with
// /api/leads/enrich/health so the two can never drift apart again. It resolves
// DNS, rejects every non-public address, and pins the socket to the address it
// validated (a hostname string check alone is bypassable with a public wildcard
// resolver such as 169.254.169.254.nip.io).
//
// safeFetch is loaded lazily: this module is also imported by client components
// for pure scoring, and the probe path must never be pulled into their bundle.
// ---------------------------------------------------------------------------

const PROBE_MAX_BYTES = 256 * 1024
const PROBE_MAX_REDIRECTS = 3

/**
 * Fetch a lead's website server-side (short timeout, capped body, every
 * redirect hop re-validated) and derive live health signals. Returns
 * { reachable: false } on any failure or refusal so callers can score
 * unreachable sites without special-casing errors.
 */
export async function probeWebsite(
  website: string,
  timeoutMs = 5000
): Promise<WebsiteSignals> {
  const startUrl = normalizeUrl(website)
  if (!startUrl) return { reachable: false }

  try {
    const { safeProbe } = await import('./safeFetch')
    const res = await safeProbe(startUrl, {
      timeoutMs,
      maxBytes: PROBE_MAX_BYTES,
      maxRedirects: PROBE_MAX_REDIRECTS,
      userAgent: 'Mozilla/5.0 (compatible; LeadZipp/1.0)',
    })
    if (!res.ok) return { reachable: false }

    const html = res.body
    return {
      reachable: true,
      https: res.finalUrl.startsWith('https://'),
      mobileResponsive:
        html.includes('<meta name="viewport"') || html.includes("<meta name='viewport'"),
      hasAnalytics:
        html.includes('gtag.js') ||
        html.includes('analytics.js') ||
        html.includes('googletagmanager.com') ||
        html.includes('connect.facebook.net') ||
        html.includes('"G-') ||
        html.includes("'G-"),
      hasContactForm:
        html.includes('<form') ||
        /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(html),
      fastLoad: res.elapsedMs < 3000,
    }
  } catch {
    return { reachable: false }
  }
}
