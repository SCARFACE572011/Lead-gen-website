'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  TrendingUp,
  Search,
  MapPin,
  Globe,
  Star,
  MessageSquare,
  AlertCircle,
  Loader2,
  ArrowRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const HISTORY_KEY = 'leadzip_search_history'

interface CategoryGap {
  category: string
  total: number
  noWebsitePct: number
  weakRatingPct: number
  avgReviews: number
  avgRating: number | null
  opportunityIndex: number
  fromCache: boolean
  error?: string
}

interface GapResult {
  zipCode: string
  radiusMiles: number
  categories: CategoryGap[]
  analyzedAt: string
}

function standoutStat(gap: CategoryGap, zip: string): string {
  const cat = gap.category.toLowerCase()
  if (gap.noWebsitePct >= gap.weakRatingPct && gap.noWebsitePct > 0) {
    return `${gap.noWebsitePct}% of ${cat} in ${zip} have no website`
  }
  if (gap.weakRatingPct > 0) {
    return `${gap.weakRatingPct}% of ${cat} in ${zip} have a weak rating or too few reviews`
  }
  return `${cat} in ${zip} have a strong digital presence`
}

function OpportunityMeter({ value }: { value: number }) {
  const color =
    value >= 60 ? 'bg-signal' : value >= 35 ? 'bg-amber-500' : 'bg-stone/40'
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 h-1.5 bg-sand rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', color)}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
      <span className="font-mono text-sm font-bold text-ink w-8 text-right">{value}</span>
    </div>
  )
}

export default function MarketGapsPage() {
  const [zip, setZip] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<GapResult | null>(null)

  // Prefill from the user's most recent search
  useEffect(() => {
    try {
      const history = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]') as {
        zipCode?: string
      }[]
      const last = history.find((h) => h.zipCode && h.zipCode.length >= 5)
      if (last?.zipCode) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setZip(last.zipCode)
      }
    } catch { /* non-fatal */ }
  }, [])

  const analyze = async () => {
    const trimmed = zip.trim()
    if (trimmed.length < 5) {
      setError('Enter a valid 5-digit ZIP code')
      return
    }
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/leads/market-gaps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zipCode: trimmed }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error ?? 'Analysis failed')
      }
      setResult(data as GapResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-paper">
      <div className="max-w-[1100px] mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-6">
          <span className="readout text-signal">Market intelligence</span>
          <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-ink">
            Local Market Gap Finder
          </h1>
          <p className="text-sm text-ink-soft mt-1.5 max-w-xl">
            Scan 6 high-value categories in one location and find the industries with the
            weakest digital presence. The biggest gaps are your easiest sales.
          </p>
        </div>

        {/* Input */}
        <div className="bg-card border border-sand rounded-2xl px-4 py-4 mb-6 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone" />
            <input
              type="text"
              inputMode="numeric"
              placeholder="ZIP code, e.g. 30301"
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !loading) analyze() }}
              className="w-full pl-9 pr-3 py-2 text-sm bg-paper-2 border border-sand rounded-full focus:outline-none focus:ring-2 focus:ring-signal/20 focus:border-signal"
            />
          </div>
          <button
            onClick={analyze}
            disabled={loading}
            className="inline-flex items-center gap-2 bg-signal text-white text-sm font-semibold px-5 py-2.5 rounded-full hover:bg-signal-600 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
            {loading ? 'Analyzing…' : 'Find market gaps'}
          </button>
          <span className="text-xs text-stone">
            Plumbers · Dentists · Salons · Restaurants · Contractors · Auto Shops
          </span>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700 rounded-2xl px-4 py-3">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-3">
            <p className="text-xs text-stone">
              Analyzing categories one by one. Cached areas finish in seconds; fresh areas can take up to a minute.
            </p>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-card border border-sand rounded-2xl px-5 py-5 flex items-center gap-4">
                <div className="w-7 h-7 rounded-lg bg-paper-2 animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-36 rounded bg-paper-2 animate-pulse" />
                  <div className="h-3 w-64 max-w-full rounded bg-paper-2 animate-pulse" />
                </div>
                <div className="h-6 w-24 rounded bg-paper-2 animate-pulse" />
              </div>
            ))}
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-ink">
                Opportunities in {result.zipCode}
              </h2>
              <span className="text-xs text-stone">
                Ranked by Opportunity Index · {result.radiusMiles} mile radius
              </span>
            </div>

            {result.categories.map((gap, i) => (
              <div
                key={gap.category}
                className={cn(
                  'bg-card border rounded-2xl px-5 py-4 transition-colors',
                  i === 0 && gap.opportunityIndex > 0 ? 'border-signal/50' : 'border-sand'
                )}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className={cn(
                      'w-7 h-7 rounded-lg flex items-center justify-center font-mono text-sm font-bold shrink-0',
                      i === 0 && gap.opportunityIndex > 0
                        ? 'bg-signal text-white'
                        : 'bg-paper-2 text-stone border border-sand'
                    )}
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-display text-base font-bold text-ink">{gap.category}</h3>
                      {i === 0 && gap.opportunityIndex > 0 && (
                        <span className="text-[10px] font-semibold tracking-wide uppercase bg-signal-50 text-signal px-2 py-0.5 rounded-md">
                          Biggest gap
                        </span>
                      )}
                    </div>
                    {gap.error ? (
                      <p className="text-xs text-red-600 mt-0.5">{gap.error}</p>
                    ) : gap.total === 0 ? (
                      <p className="text-xs text-stone mt-0.5">No businesses found in this category</p>
                    ) : (
                      <p className="text-sm text-signal font-medium mt-0.5">
                        {standoutStat(gap, result.zipCode)}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="readout text-stone hidden sm:inline">Opportunity</span>
                    <OpportunityMeter value={gap.opportunityIndex} />
                  </div>
                </div>

                {gap.total > 0 && (
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 mt-3 pl-10">
                    <span className="inline-flex items-center gap-1.5 text-xs text-ink-soft">
                      <Search className="w-3.5 h-3.5 text-stone" />
                      <span className="font-mono font-semibold">{gap.total}</span> found
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs text-ink-soft">
                      <Globe className="w-3.5 h-3.5 text-stone" />
                      <span className="font-mono font-semibold">{gap.noWebsitePct}%</span> no website
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs text-ink-soft">
                      <Star className="w-3.5 h-3.5 text-stone" />
                      <span className="font-mono font-semibold">{gap.weakRatingPct}%</span> weak rating
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs text-ink-soft">
                      <MessageSquare className="w-3.5 h-3.5 text-stone" />
                      <span className="font-mono font-semibold">{gap.avgReviews}</span> avg reviews
                      {gap.avgRating != null && (
                        <span className="text-stone">· {gap.avgRating} avg rating</span>
                      )}
                    </span>
                    <Link
                      href={`/search?zip=${encodeURIComponent(result.zipCode)}&category=${encodeURIComponent(gap.category)}`}
                      className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold text-signal hover:text-signal-600 transition-colors"
                    >
                      Search these leads
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                )}
              </div>
            ))}

            <p className="text-xs text-stone pt-2">
              Weak rating counts businesses under 4.0 stars or with fewer than 10 reviews.
              The Opportunity Index blends website gaps, rating gaps, and market size into a 0-100 score.
            </p>
          </div>
        )}

        {/* Empty state */}
        {!result && !loading && !error && (
          <div className="bg-card border border-sand rounded-2xl">
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <div className="w-16 h-16 rounded-2xl bg-signal-50 flex items-center justify-center mb-4">
                <TrendingUp className="w-8 h-8 text-signal" />
              </div>
              <h3 className="font-display text-lg font-bold text-ink mb-1">
                Find the weakest market first
              </h3>
              <p className="text-sm text-stone max-w-sm">
                Enter a ZIP code and LeadZipp will compare plumbers, dentists, salons,
                restaurants, contractors, and auto shops to show you where the digital
                gaps, and the easiest clients, are.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
