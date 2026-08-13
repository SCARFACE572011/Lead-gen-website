'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Clock,
  RotateCcw,
  Trash2,
  MapPin,
  Hash,
  SearchX,
} from 'lucide-react'
import { SearchHistory } from '@/types/lead'
import { COUNTRIES } from '@/lib/countries'

interface SearchHistoryRow {
  id: string
  user_id: string
  zip_code: string
  radius: number | null
  category: string | null
  keyword: string | null
  result_count: number | null
  created_at: string
  /** Feature-detected: search_history has no country/km columns today, but the
   *  API selects '*', so prefer them the moment they exist. */
  country_code?: string | null
  radius_km?: number | null
}

const ZIP_RE = /^\d{5}(-\d{4})?$/

/** A worldwide search stores its location text ("Berlin, Germany") in the same
 *  column a ZIP search stores "30301" in, so shape is the only signal. */
function isInternational(locationText: string): boolean {
  return !ZIP_RE.test(locationText.trim())
}

// Radius options offered in international (km) mode, and the snap used to undo
// the km -> integer-miles storage conversion (10 km is stored as 6 mi).
// Mirrors the same constants on the search page.
const KM_OPTIONS = [1, 5, 10, 25, 50]
function snapKm(km: number): number {
  return KM_OPTIONS.reduce(
    (best, opt) => (Math.abs(opt - km) < Math.abs(best - km) ? opt : best),
    KM_OPTIONS[0]
  )
}

// Common shorthand the country dropdown also accepts, so "London, UK" resolves.
const COUNTRY_NAME_ALIASES: Record<string, string> = {
  uk: 'GB',
  'united kingdom': 'GB',
  britain: 'GB',
  'great britain': 'GB',
  england: 'GB',
  scotland: 'GB',
  wales: 'GB',
  usa: 'US',
  'united states': 'US',
  america: 'US',
  uae: 'AE',
  emirates: 'AE',
  holland: 'NL',
  'south korea': 'KR',
  'czech republic': 'CZ',
}

/**
 * Best-effort ISO country for a stored location string.
 *
 * search_history has no country column (the search route writes only the
 * location text), so the trailing segment of the text is the only signal left:
 * "Berlin, Germany" -> DE. Matching is EXACT on a full country name or a known
 * alias — never on a bare two-letter tail, because "Cambridge, MA" would
 * otherwise resolve to Morocco and "Denver, CO" to Colombia.
 *
 * Returns undefined when nothing matches, in which case the rerun link omits the
 * country exactly as it did before. Closing the remaining gap ("Paris" saved
 * with FR selected) needs a country_code column on search_history plus a writer
 * for it in the search route.
 */
function inferCountryCode(locationText: string): string | undefined {
  const parts = locationText.split(',')
  if (parts.length < 2) return undefined
  const tail = parts[parts.length - 1].trim().toLowerCase()
  if (tail.length < 3) return COUNTRY_NAME_ALIASES[tail]
  return (
    COUNTRY_NAME_ALIASES[tail] ??
    COUNTRIES.find((c) => c.name.toLowerCase() === tail)?.code
  )
}

function mapRow(h: SearchHistoryRow): SearchHistory {
  const zipCode = h.zip_code
  const radius = h.radius ?? 25
  const intl = isInternational(zipCode)
  const storedKm = typeof h.radius_km === 'number' && h.radius_km > 0 ? h.radius_km : undefined
  const storedCountry = (h.country_code ?? '').trim().toUpperCase() || undefined
  return {
    id: h.id,
    userId: h.user_id,
    zipCode,
    radius,
    category: h.category ?? '',
    keyword: h.keyword ?? '',
    resultCount: h.result_count ?? 0,
    createdAt: h.created_at,
    countryCode: intl ? storedCountry ?? inferCountryCode(zipCode) : undefined,
    radiusKm: intl ? storedKm ?? snapKm(radius * 1.60934) : undefined,
  }
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function SearchHistoryPage() {
  const router = useRouter()
  const [history, setHistory] = useState<SearchHistory[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadHistory() {
      try {
        const res = await fetch('/api/history')
        const data = await res.json()
        if (res.ok && Array.isArray(data.history)) {
          setHistory((data.history as SearchHistoryRow[]).map(mapRow))
        }
      } catch {
        // Non-fatal — show the empty state rather than fabricated rows.
      } finally {
        setLoading(false)
      }
    }
    loadHistory()
  }, [])

  // The rerun URL has to reproduce the ORIGINAL search, country included: the
  // cache key for a worldwide search is `intl:{cc}:{location}|{category}|{km}km`,
  // so rerunning "Berlin, Germany" with no country builds `intl::berlin,germany...`
  // instead — a guaranteed miss, a second billable fetch, and a duplicate pool
  // nobody else can read. radiusKm goes along for the same reason: the stored
  // radius is integer miles and km -> mi -> km is lossy for 1 km and 25 km.
  const handleRerun = (entry: SearchHistory) => {
    const params = new URLSearchParams({
      zip: entry.zipCode,
      radius: String(entry.radius),
      category: entry.category,
      ...(entry.countryCode ? { country: entry.countryCode } : {}),
      ...(entry.radiusKm != null ? { radiusKm: String(entry.radiusKm) } : {}),
      ...(entry.keyword ? { keyword: entry.keyword } : {}),
    })
    router.push(`/search?${params.toString()}`)
  }

  // Deletes persist server-side (service-role endpoint) so they don't reappear
  // on reload. Optimistic update, then fire the request.
  const handleDelete = (id: string) => {
    setHistory((prev) => prev.filter((h) => h.id !== id))
    fetch('/api/history', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    }).catch(() => {})
  }

  const handleClearAll = () => {
    setHistory([])
    fetch('/api/history', { method: 'DELETE' }).catch(() => {})
  }

  return (
    <div className="min-h-screen bg-paper">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <span className="readout text-signal">Activity</span>
            <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-ink">Search History</h1>
            <p className="text-sm text-ink-soft mt-1.5">Rerun past searches or review previous results</p>
          </div>
          {history.length > 0 && (
            <button
              onClick={handleClearAll}
              className="inline-flex items-center gap-2 text-sm text-red-500 border border-red-200 px-4 py-2 rounded-full hover:bg-red-50 transition-colors font-medium"
            >
              <Trash2 className="w-4 h-4" />
              Clear History
            </button>
          )}
        </div>

        {loading ? (
          <div className="bg-card border border-sand rounded-2xl p-6 space-y-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 rounded-xl bg-paper-2 animate-pulse" />
            ))}
          </div>
        ) : history.length === 0 ? (
          <div className="bg-card border border-sand rounded-2xl">
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-2xl bg-signal-50 flex items-center justify-center mb-4">
                <SearchX className="w-8 h-8 text-signal" />
              </div>
              <h3 className="font-display text-lg font-bold text-ink mb-1">No search history</h3>
              <p className="text-sm text-stone max-w-xs">
                Your past searches will appear here so you can quickly rerun them.
              </p>
              <a
                href="/search"
                className="mt-5 inline-flex items-center gap-2 bg-signal text-white text-sm font-semibold px-5 py-2.5 rounded-full hover:bg-signal-600 transition-all active:scale-95"
              >
                Start Searching
              </a>
            </div>
          </div>
        ) : (
          <div className="bg-card border border-sand rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-sand bg-paper-2">
                    {/* Worldwide rows store a location like "Berlin, Germany" in
                        the same column a ZIP search stores "30301" in. */}
                    <th className="px-4 py-3 text-left readout font-semibold text-stone">Location</th>
                    <th className="px-4 py-3 text-left readout font-semibold text-stone">Category</th>
                    <th className="px-4 py-3 text-left readout font-semibold text-stone">Radius</th>
                    <th className="px-4 py-3 text-left readout font-semibold text-stone">Keyword</th>
                    <th className="px-4 py-3 text-left readout font-semibold text-stone">Results</th>
                    <th className="px-4 py-3 text-left readout font-semibold text-stone">Date</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((entry) => (
                    <tr
                      key={entry.id}
                      className="border-b border-sand hover:bg-signal-50/50 transition-colors"
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-signal-50 flex items-center justify-center">
                            <MapPin className="w-4 h-4 text-signal" />
                          </div>
                          <span className="font-mono font-semibold text-ink text-sm">{entry.zipCode}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-sm text-ink-soft">{entry.category}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        {/* Worldwide searches are run in km but stored in the
                            integer-miles column, so showing the raw number reads
                            as "6 mi" for a 10 km search. Show the km the user
                            actually picked instead. */}
                        <span className="text-xs bg-paper-2 text-ink-soft px-2 py-1 rounded-md font-mono font-medium border border-sand">
                          {entry.radiusKm != null ? `${entry.radiusKm} km` : `${entry.radius} mi`}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        {entry.keyword ? (
                          <div className="flex items-center gap-1">
                            <Hash className="w-3 h-3 text-stone" />
                            <span className="text-sm text-ink-soft italic">{entry.keyword}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-stone/50">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-mono font-semibold ${entry.resultCount >= 10 ? 'bg-lime/25 text-forest' : entry.resultCount >= 5 ? 'bg-amber-50 text-amber-700' : 'bg-paper-2 text-stone'}`}>
                          {entry.resultCount} found
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3 h-3 text-stone" />
                          <div>
                            <div className="text-xs font-medium text-ink-soft">{formatRelativeTime(entry.createdAt)}</div>
                            <div className="text-xs text-stone">{formatDate(entry.createdAt)}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleRerun(entry)}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold bg-signal text-white px-3 py-1.5 rounded-full hover:bg-signal-600 transition-colors"
                          >
                            <RotateCcw className="w-3 h-3" />
                            Rerun
                          </button>
                          <button
                            onClick={() => handleDelete(entry.id)}
                            aria-label="Delete search"
                            className="p-1.5 rounded-lg text-stone hover:text-red-500 hover:bg-red-50 transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-4 py-3 border-t border-sand bg-paper-2 flex items-center justify-between">
              <span className="text-xs text-stone"><span className="font-mono">{history.length}</span> searches in history</span>
              <span className="readout text-stone">Last 30 days</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
