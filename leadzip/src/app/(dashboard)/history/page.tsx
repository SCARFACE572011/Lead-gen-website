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

interface SearchHistoryRow {
  id: string
  user_id: string
  zip_code: string
  radius: number | null
  category: string | null
  keyword: string | null
  result_count: number | null
  created_at: string
}

function mapRow(h: SearchHistoryRow): SearchHistory {
  return {
    id: h.id,
    userId: h.user_id,
    zipCode: h.zip_code,
    radius: h.radius ?? 25,
    category: h.category ?? '',
    keyword: h.keyword ?? '',
    resultCount: h.result_count ?? 0,
    createdAt: h.created_at,
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

  const handleRerun = (entry: SearchHistory) => {
    const params = new URLSearchParams({
      zip: entry.zipCode,
      radius: String(entry.radius),
      category: entry.category,
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
                    <th className="px-4 py-3 text-left readout font-semibold text-stone">ZIP Code</th>
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
                        <span className="text-xs bg-paper-2 text-ink-soft px-2 py-1 rounded-md font-mono font-medium border border-sand">
                          {entry.radius} mi
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
