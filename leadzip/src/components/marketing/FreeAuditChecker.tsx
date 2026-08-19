'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Loader2, Search } from 'lucide-react'
import { track } from '@/lib/analytics'
import { PillarBreakdown, ScoreGauge } from '@/components/audit/HealthReportView'
import type { HealthCheck, HealthScoreResult } from '@/lib/healthScore'

/**
 * Interactive form + result view for the public free checker on /free-audit.
 * Calls POST /api/free-audit (anonymous, rate limited, no database writes)
 * and renders the returned Digital Health Score with the same components the
 * shareable /audit/[slug] report uses.
 */

interface FreeAuditLead {
  businessName: string
  category: string
  address: string
  phone: string
  website: string
  rating: number | null
  reviewCount: number | null
}

interface FreeAuditResult {
  lead: FreeAuditLead
  health: HealthScoreResult
}

// One line per failed check: what the gap costs the business, in plain words.
// Keyed by the check ids computeHealthScore emits.
const GAP_MEANINGS: Record<string, string> = {
  phone_listed: 'Customers who want to call are not finding a number on the profile.',
  website_linked: 'The Google profile sends no traffic to a website, so ready-to-buy visitors stall.',
  hours_listed: 'Without listed hours, people assume closed and move to the next result.',
  has_reviews: 'Zero reviews reads as zero track record to someone comparing options.',
  reviews_10: 'Fewer than 10 reviews is below the trust threshold most buyers look for.',
  reviews_50: 'Under 50 reviews, better-reviewed competitors outrank this profile on the map.',
  rating_4: 'A rating below 4.0 stars filters this business out of many customers’ shortlists.',
  has_website: 'No website means no way to be found or vetted outside the Google listing.',
  https: 'Browsers flag the site as not secure, which scares off careful visitors.',
  own_domain: 'A free page builder address instead of an own domain undercuts credibility.',
  site_live: 'The listed website did not load, so every click from the profile is wasted.',
  phone_reachable: 'There is no phone number for customers who want to talk before buying.',
  contact_path: 'A visitor who wants to get in touch has no obvious way to do it.',
  mobile_friendly: 'The site is hard to use on a phone, where most local searches happen.',
  fast_load: 'Slow pages lose visitors before they ever see the offer.',
  analytics: 'No analytics installed, so nobody knows what marketing is working.',
}

function failedChecks(health: HealthScoreResult): HealthCheck[] {
  return health.pillars
    .flatMap((p) => p.checks)
    .filter((c) => !c.passed)
    .sort((a, b) => b.points - a.points)
}

export function FreeAuditChecker() {
  const [businessName, setBusinessName] = useState('')
  const [location, setLocation] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<FreeAuditResult | null>(null)
  const resultRef = useRef<HTMLDivElement>(null)

  // The result renders far below the form; moving focus onto it makes screen
  // readers announce the score instead of leaving them on the submit button.
  useEffect(() => {
    if (result) resultRef.current?.focus()
  }, [result])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return
    setLoading(true)
    setError(null)
    setResult(null)
    track('free_audit_started', { has_city: Boolean(location.trim()) })
    try {
      const res = await fetch('/api/free-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessName, location }),
      })
      const data = (await res.json().catch(() => null)) as
        | (Partial<FreeAuditResult> & { error?: string })
        | null
      if (!res.ok || !data?.health || !data?.lead) {
        track('free_audit_completed', { found: false })
        setError(
          typeof data?.error === 'string' && data.error
            ? data.error
            : 'Something went wrong. Please try again in a moment.'
        )
        return
      }
      track('free_audit_completed', { found: true })
      setResult({ lead: data.lead as FreeAuditLead, health: data.health })
    } catch {
      setError('Something went wrong. Please try again in a moment.')
    } finally {
      setLoading(false)
    }
  }

  const gaps = result ? failedChecks(result.health) : []

  return (
    <div>
      {/* Form */}
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-sand bg-card p-5 shadow-sm sm:p-6"
      >
        <div className="grid gap-4 sm:grid-cols-[1.2fr_1fr_auto]">
          <div>
            <label htmlFor="fa-business" className="block text-sm font-semibold text-ink">
              Business name
            </label>
            <input
              id="fa-business"
              type="text"
              required
              minLength={2}
              maxLength={120}
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Rossi Plumbing"
              className="mt-1.5 w-full rounded-lg border border-sand bg-paper px-3.5 py-2.5 text-sm text-ink placeholder:text-stone focus:border-signal focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="fa-location" className="block text-sm font-semibold text-ink">
              City or ZIP code
            </label>
            <input
              id="fa-location"
              type="text"
              required
              minLength={2}
              maxLength={80}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Austin, TX"
              className="mt-1.5 w-full rounded-lg border border-sand bg-paper px-3.5 py-2.5 text-sm text-ink placeholder:text-stone focus:border-signal focus:outline-none"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-signal px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-signal-600 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Checking
                </>
              ) : (
                <>
                  <Search className="h-4 w-4" /> Check score
                </>
              )}
            </button>
          </div>
        </div>
        <p className="mt-3 text-xs text-stone">
          No signup needed. We look the business up, test its website, and score it out of 100.
        </p>
      </form>

      {/* Loading */}
      {loading && (
        <div role="status" className="mt-6 rounded-2xl border border-sand bg-card p-8 text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-signal" />
          <p className="mt-3 text-sm text-ink-soft">
            Finding the business and running a live website check. This takes a few seconds.
          </p>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5" role="alert">
          <p className="text-sm leading-relaxed text-amber-900">{error}</p>
        </div>
      )}

      {/* Result */}
      {result && !loading && (
        <div
          ref={resultRef}
          tabIndex={-1}
          role="region"
          aria-label={`Digital health score for ${result.lead.businessName}`}
          className="mt-8 outline-none"
        >
          <section className="flex flex-col items-center gap-6 text-center sm:flex-row sm:justify-between sm:text-left">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-signal-600">
                Digital health score
              </p>
              <h2 className="mt-1 font-display text-2xl font-bold leading-tight sm:text-3xl">
                {result.lead.businessName}
              </h2>
              <p className="mt-2 text-sm text-stone">
                {[result.lead.category, result.lead.address].filter(Boolean).join(' · ')}
              </p>
              <p className="mt-1 text-xs text-stone">
                {result.health.verified
                  ? 'Includes a live website check'
                  : 'Estimated from public profile data'}
              </p>
            </div>
            <div className="shrink-0">
              <ScoreGauge total={result.health.total} />
            </div>
          </section>

          <div className="mt-6">
            <PillarBreakdown pillars={result.health.pillars} />
          </div>

          {/* What each gap means */}
          {gaps.length > 0 && (
            <section className="mt-6 rounded-2xl border border-sand bg-card p-6">
              <h3 className="font-display text-lg font-bold">What each gap means</h3>
              <ul className="mt-3 space-y-2.5">
                {gaps.map((check) => (
                  <li key={check.id} className="flex items-start gap-2.5 text-sm">
                    <span className="mt-0.5 shrink-0 font-bold text-red-500" aria-hidden="true">
                      ✗
                    </span>
                    <span className="text-ink-soft">
                      <span className="font-semibold text-ink">{check.label}.</span>{' '}
                      {GAP_MEANINGS[check.id] ?? 'A fixable gap that is costing this business customers.'}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Conversion block */}
          <section className="mt-6 rounded-2xl bg-forest p-6 text-center sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-wide text-lime">
              This score is just the preview
            </p>
            <h3 className="mt-2 font-display text-xl font-bold text-white sm:text-2xl">
              Want the full shareable report, the fix list, and every competitor on the block?
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-white/70">
              LeadZipp Free includes 25 searches a month, no card. Creating an account also
              unlocks shareable report links; white-label PDF exports are part of the paid plans.
            </p>
            {/* Two Oranges Rule: on forest, signal (#C22F0A) sat at 2.67:1 —
                signal-bright is the dark-surface treatment (4.57:1 vs forest,
                ink label 5.58:1; hover #FF6A45: 5.34:1 vs forest, 6.51:1 vs ink). */}
            <Link
              href="/signup"
              onClick={() => track('free_audit_cta_clicked', { placement: 'result' })}
              className="mt-5 inline-block rounded-full bg-signal-bright px-6 py-3 text-sm font-semibold text-ink transition-colors hover:bg-[#FF6A45]"
            >
              Create a free account
            </Link>
          </section>
        </div>
      )}
    </div>
  )
}
