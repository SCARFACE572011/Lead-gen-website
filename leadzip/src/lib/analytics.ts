'use client'

import { useEffect } from 'react'

/**
 * Conversion tracking for LeadZipp.
 *
 * Everything funnels through `track()`, which pushes a flat object onto
 * `window.dataLayer` for Google Tag Manager (bootstrapped in src/app/layout.tsx
 * behind NEXT_PUBLIC_GTM_ID). If GTM is not configured the pushes still land in
 * the array harmlessly, so call sites never need to check.
 *
 * Hard rules for this file:
 *   - Never throws. Analytics failing must never break the product.
 *   - No-ops during SSR (no window).
 *   - Never carries PII. No email addresses, no names, no raw search queries.
 *     Only plan names, billing periods, booleans and coarse count buckets.
 */

/* ------------------------------------------------------------------ *
 * Event catalog
 * ------------------------------------------------------------------ */

/**
 * The only event names that may be pushed. Adding a name here is the one place
 * a new event gets defined, so a typo at a call site is a compile error.
 */
export type AnalyticsEvent =
  | 'signup_completed'
  | 'trial_started'
  | 'search_run'
  | 'checkout_started'

export type PlanName = 'pro' | 'agency'

/** 'unknown' is used when the billing period cannot be resolved server side. */
export type BillingPeriod = 'monthly' | 'annual' | 'unknown'

/** Coarse buckets so result counts are usable in reports without being noisy. */
export type ResultBucket = '0' | '1-10' | '11-25' | '26-50' | '51-100' | '100+'

/**
 * Props allowed per event. `track` is generic over the event name, so passing
 * the wrong shape for an event is a compile error.
 */
export interface AnalyticsEventProps {
  /** Fired once a signup succeeds, before any redirect to Stripe. */
  signup_completed: {
    /** True when the visitor arrived from a trial CTA and a plan was preselected. */
    trial_selected: boolean
    plan?: PlanName | null
    billing?: BillingPeriod
  }
  /**
   * PRIMARY CONVERSION. Fired once per Stripe Checkout session, when the buyer
   * lands back on /dashboard?payment=success. Deduped on session_id, so a
   * refresh or a revisit with the query string still present does not re-fire.
   */
  trial_started: {
    plan: string
    billing: BillingPeriod
  }
  /** Fired on a successful lead search. Never carries the raw query. */
  search_run: {
    /**
     * Whether the API served the shared cached pool. Null when the response
     * does not expose it (bulk searches merge several responses).
     */
    from_cache: boolean | null
    result_bucket: ResultBucket
  }
  /**
   * Owned by the pricing page. Fired when the visitor clicks a plan CTA and we
   * are about to hand off to Stripe Checkout, BEFORE the redirect.
   *
   * Call signature for the pricing page:
   *
   *   import { track } from '@/lib/analytics'
   *   track('checkout_started', {
   *     plan: 'pro',            // 'pro' | 'agency'
   *     billing: 'monthly',     // 'monthly' | 'annual'
   *     promo: false,           // optional, true when the 15% welcome coupon applies
   *   })
   *
   * Fire it before `window.location.href = payload.url` so the push lands while
   * the page is still alive. Do not pass an email, a name or a customer id.
   */
  checkout_started: {
    plan: PlanName
    billing: BillingPeriod
    promo?: boolean
  }
}

/* ------------------------------------------------------------------ *
 * dataLayer plumbing
 * ------------------------------------------------------------------ */

type DataLayerRecord = Record<string, unknown>

// Declared locally rather than as a `declare global` so this file cannot
// collide with a dataLayer typing added elsewhere in the app.
type WindowWithDataLayer = Window & { dataLayer?: DataLayerRecord[] }

function getDataLayer(): DataLayerRecord[] | null {
  if (typeof window === 'undefined') return null
  try {
    const w = window as WindowWithDataLayer
    if (!Array.isArray(w.dataLayer)) w.dataLayer = []
    return w.dataLayer
  } catch {
    return null
  }
}

/**
 * Push a typed event onto the dataLayer.
 *
 * No-ops during SSR and never throws. Props are optional so a bare
 * `track('some_event')` stays legal, but every event above defines the shape it
 * expects and TypeScript enforces it when props are supplied.
 */
export function track<E extends AnalyticsEvent>(
  event: E,
  props?: AnalyticsEventProps[E],
): void {
  try {
    const dataLayer = getDataLayer()
    if (!dataLayer) return
    // Safety net: an ad click can land on a page that soft-navigates before the
    // startup hook runs, so re-check the URL on every event. No-op when the URL
    // carries no gclid.
    captureGclid()
    dataLayer.push({ event, ...(props ?? {}) })
  } catch {
    // Swallowed on purpose. A broken tag manager must never break a signup.
  }
}

/** Map a raw result count onto a reporting bucket. */
export function bucketResultCount(count: number): ResultBucket {
  if (!Number.isFinite(count) || count <= 0) return '0'
  if (count <= 10) return '1-10'
  if (count <= 25) return '11-25'
  if (count <= 50) return '26-50'
  if (count <= 100) return '51-100'
  return '100+'
}

/* ------------------------------------------------------------------ *
 * GCLID capture (Google Ads offline conversion import)
 * ------------------------------------------------------------------ */

/** First-party cookie holding the Google click id. */
export const GCLID_COOKIE = 'lz_gclid'

/** 90 days, matching the default Google Ads click-through conversion window. */
const GCLID_MAX_AGE_SECONDS = 60 * 60 * 24 * 90

/**
 * Google click ids are url-safe base64-ish. Anything outside this set is
 * rejected rather than sanitized, so nothing can be smuggled into the cookie
 * header or into a log line downstream.
 */
const GCLID_PATTERN = /^[A-Za-z0-9._-]{1,512}$/

/**
 * Read the gclid query param off the current URL and persist it to a
 * first-party cookie for 90 days, SameSite=Lax.
 *
 * Returns the gclid now in storage (the freshly captured one, or the previously
 * stored one when the URL has none). Safe to call on every page and on every
 * event: it is a no-op when there is nothing new to capture.
 */
export function captureGclid(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('gclid')
    if (!fromUrl || !GCLID_PATTERN.test(fromUrl)) return readGclid()

    const secure = window.location.protocol === 'https:' ? '; Secure' : ''
    document.cookie =
      `${GCLID_COOKIE}=${encodeURIComponent(fromUrl)}` +
      `; Max-Age=${GCLID_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`
    return fromUrl
  } catch {
    return null
  }
}

/** Read the stored gclid, or null when there is none. */
export function readGclid(): string | null {
  if (typeof document === 'undefined') return null
  try {
    for (const part of document.cookie.split(';')) {
      const [rawName, ...rest] = part.split('=')
      if (rawName.trim() !== GCLID_COOKIE) continue
      const value = decodeURIComponent(rest.join('=').trim())
      return GCLID_PATTERN.test(value) ? value : null
    }
    return null
  } catch {
    return null
  }
}

/* ------------------------------------------------------------------ *
 * Once-per-token dedupe
 * ------------------------------------------------------------------ */

/** One bounded key rather than one key per token, so storage cannot grow forever. */
const DEDUPE_STORAGE_KEY = 'lz_analytics_seen'
const DEDUPE_MAX_TOKENS = 50

/** Last resort when both web storages are blocked (private mode, hardened browsers). */
const memorySeen = new Set<string>()

/**
 * localStorage first, sessionStorage second.
 *
 * localStorage matters here: the checkout success URL can be reopened in a new
 * tab, restored by session restore, or bookmarked, and sessionStorage would be
 * empty in all three cases and let the primary conversion double count.
 */
function pickStore(): Storage | null {
  if (typeof window === 'undefined') return null
  const probe = '__lz_probe__'
  for (const read of [() => window.localStorage, () => window.sessionStorage]) {
    try {
      const store = read()
      store.setItem(probe, '1')
      store.removeItem(probe)
      return store
    } catch {
      // Blocked. Fall through to the next candidate.
    }
  }
  return null
}

function markInMemory(token: string): boolean {
  if (memorySeen.has(token)) return false
  memorySeen.add(token)
  return true
}

/**
 * Returns true the FIRST time a token is seen on this device and false forever
 * after. Used to make a conversion event fire exactly once.
 */
export function markOnce(token: string): boolean {
  if (typeof window === 'undefined' || !token) return false

  const store = pickStore()
  if (!store) return markInMemory(token)

  try {
    const raw = store.getItem(DEDUPE_STORAGE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    const seen = Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === 'string')
      : []

    if (seen.includes(token)) return false

    seen.unshift(token)
    store.setItem(DEDUPE_STORAGE_KEY, JSON.stringify(seen.slice(0, DEDUPE_MAX_TOKENS)))
    return true
  } catch {
    // Corrupt JSON or a quota error. Degrade to in-memory rather than re-firing.
    return markInMemory(token)
  }
}

/* ------------------------------------------------------------------ *
 * trial_started, the primary conversion
 * ------------------------------------------------------------------ */

/**
 * Fire `trial_started` at most once per Stripe Checkout session.
 *
 * The dashboard is a normal page: it can be refreshed, back-navigated to, or
 * reopened from history with `?payment=success&session_id=...` still attached.
 * Dedupe is keyed on the Stripe session id and persisted, so only the first
 * arrival for a given checkout counts.
 *
 * Returns true when the event was actually pushed, which is what the dedupe
 * test asserts on.
 */
export function trackTrialStartedOnce(
  sessionId: string | null | undefined,
  plan: string,
  billing: BillingPeriod,
): boolean {
  if (typeof window === 'undefined') return false
  // Without a session id there is nothing stable to dedupe on, and firing would
  // risk double counting the primary conversion. Stripe's success_url always
  // includes it, so this only skips hand-crafted URLs.
  if (!sessionId) return false
  if (!markOnce(`trial_started:${sessionId}`)) return false

  track('trial_started', { plan, billing })
  return true
}

/**
 * Renders nothing. Exists so a server component (the dashboard page) can fire
 * `trial_started` on the client without becoming a client component itself.
 */
export function TrialStartedTracker({
  sessionId,
  plan,
  billing,
}: {
  sessionId: string | null
  plan: string
  billing: BillingPeriod
}): null {
  useEffect(() => {
    trackTrialStartedOnce(sessionId, plan, billing)
  }, [sessionId, plan, billing])

  return null
}
