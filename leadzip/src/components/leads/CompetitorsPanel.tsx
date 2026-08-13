'use client'

import { useEffect, useState } from 'react'
import { Loader2, Lightbulb } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Lead } from '@/types/lead'
import type { CompetitorComparison } from '@/lib/competitorAnalysis'

/**
 * Lazy-loaded competitor comparison for a lead. Mounted only when the user
 * expands the Competitors section (each request is a billable Places call), and
 * results are cached per lead for the session so re-expanding is free.
 */

const sessionCache = new Map<string, CompetitorComparison>()

type PanelState = 'loading' | 'loaded' | 'error'

export function CompetitorsPanel({ lead }: { lead: Lead }) {
  const [state, setState] = useState<PanelState>(() =>
    sessionCache.has(lead.id) ? 'loaded' : 'loading'
  )
  const [data, setData] = useState<CompetitorComparison | null>(
    () => sessionCache.get(lead.id) ?? null
  )
  const [error, setError] = useState('')

  useEffect(() => {
    if (sessionCache.has(lead.id)) return
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/leads/competitors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lead: {
              businessName: lead.businessName,
              category: lead.category,
              latitude: lead.latitude,
              longitude: lead.longitude,
              zipCode: lead.zipCode || lead.sourceZip,
              website: lead.website,
              rating: lead.rating,
              reviewCount: lead.reviewCount,
            },
          }),
        })
        const json = await res.json()
        if (cancelled) return
        if (res.ok && Array.isArray(json.competitors)) {
          sessionCache.set(lead.id, json)
          setData(json)
          setState('loaded')
        } else {
          setError(
            res.status === 401
              ? 'Sign in to run competitor analysis.'
              : res.status === 429
                ? 'Rate limit reached. Try again in a minute.'
                : json.error || 'Could not load competitors.'
          )
          setState('error')
        }
      } catch {
        if (!cancelled) {
          setError('Could not load competitors.')
          setState('error')
        }
      }
    }
    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead.id])

  if (state === 'loading') {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-paper-2 p-3 text-xs text-stone">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Analyzing nearby competitors…
      </div>
    )
  }

  if (state === 'error') {
    return <p className="rounded-lg bg-paper-2 p-3 text-xs text-stone">{error}</p>
  }

  if (!data || data.competitors.length === 0) {
    return (
      <p className="rounded-lg bg-paper-2 p-3 text-xs text-stone">
        No same-category competitors found nearby. This business may own its local market.
      </p>
    )
  }

  const leadHasWebsite = Boolean(lead.website && lead.website.trim())

  return (
    <div className="rounded-lg border border-sand bg-paper-2 p-2.5">
      <p className="px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-stone">
        Top {data.competitors.length} nearby competitors
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[380px] text-xs">
          <thead>
            <tr className="border-b border-sand text-left text-[10px] uppercase tracking-wide text-stone">
              <th className="px-1.5 py-1 font-medium">Business</th>
              <th className="px-1.5 py-1 text-right font-medium">Rating</th>
              <th className="px-1.5 py-1 text-right font-medium">Reviews</th>
              <th className="px-1.5 py-1 text-center font-medium">Website</th>
              <th className="px-1.5 py-1 text-right font-medium">Dist.</th>
            </tr>
          </thead>
          <tbody>
            {/* The lead itself, highlighted */}
            <tr className="border-b border-sand bg-signal-50">
              <td className="max-w-[160px] truncate px-1.5 py-1.5 font-semibold text-signal-600">
                {lead.businessName}
              </td>
              <td className="px-1.5 py-1.5 text-right font-mono tabular-nums text-ink-soft">
                {lead.rating != null ? lead.rating.toFixed(1) : '–'}
              </td>
              <td className="px-1.5 py-1.5 text-right font-mono tabular-nums text-ink-soft">
                {lead.reviewCount ?? 0}
              </td>
              <td
                className={cn(
                  'px-1.5 py-1.5 text-center font-bold',
                  leadHasWebsite ? 'text-green-600' : 'text-red-500'
                )}
              >
                {leadHasWebsite ? '✓' : '✗'}
              </td>
              <td className="px-1.5 py-1.5 text-right font-mono tabular-nums text-stone">0.0</td>
            </tr>
            {data.competitors.map((c) => (
              <tr key={c.name + c.address} className="border-b border-sand last:border-0">
                <td className="max-w-[160px] truncate px-1.5 py-1.5 text-ink-soft" title={c.name}>
                  {c.name}
                </td>
                <td className="px-1.5 py-1.5 text-right font-mono tabular-nums text-ink-soft">
                  {c.rating != null ? c.rating.toFixed(1) : '–'}
                </td>
                <td className="px-1.5 py-1.5 text-right font-mono tabular-nums text-ink-soft">
                  {c.reviewCount ?? 0}
                </td>
                <td
                  className={cn(
                    'px-1.5 py-1.5 text-center font-bold',
                    c.hasWebsite ? 'text-green-600' : 'text-red-500'
                  )}
                >
                  {c.hasWebsite ? '✓' : '✗'}
                </td>
                <td className="px-1.5 py-1.5 text-right font-mono tabular-nums text-stone">
                  {c.distanceMiles != null ? c.distanceMiles.toFixed(1) : '–'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.insights.length > 0 && (
        <ul className="mt-2 space-y-1.5 px-1">
          {data.insights.map((insight, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs text-ink-soft">
              <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
              <span className="leading-relaxed">{insight}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
