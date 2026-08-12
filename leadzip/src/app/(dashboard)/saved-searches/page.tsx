// src/app/(dashboard)/saved-searches/page.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { Bell, Trash2, Search, AlertCircle, RefreshCw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { SavedSearch } from '@/types/saved-search'

function formatRelativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  if (diffHours < 1) return 'Just now'
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays === 1) return 'Yesterday'
  return `${diffDays} days ago`
}

export default function SavedSearchesPage() {
  const [searches, setSearches] = useState<SavedSearch[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [isPaidUser, setIsPaidUser] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    setLoadError(false)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('users_profile')
          .select('plan')
          .eq('id', user.id)
          .maybeSingle()
        setIsPaidUser((profile?.plan ?? 'free') !== 'free')
      }

      const res = await fetch('/api/saved-searches')
      if (!res.ok) throw new Error('Failed to load saved searches')
      const data = await res.json() as { searches: SavedSearch[] }
      setSearches(data.searches)
    } catch {
      // Surface a distinct error state so a failed fetch is not mistaken for
      // an empty list
      setLoadError(true)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleToggleAlert(search: SavedSearch) {
    if (!isPaidUser && !search.alertEnabled) return
    setTogglingId(search.id)
    try {
      const res = await fetch(`/api/saved-searches/${search.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertEnabled: !search.alertEnabled }),
      })
      const data = await res.json() as { search?: SavedSearch; error?: string }
      if (res.ok && data.search) {
        setSearches((prev) => prev.map((s) => s.id === search.id ? data.search! : s))
      }
    } catch { /* non-fatal */ } finally {
      setTogglingId(null)
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    setSearches((prev) => prev.filter((s) => s.id !== id))
    try {
      const res = await fetch(`/api/saved-searches/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const listRes = await fetch('/api/saved-searches')
        if (listRes.ok) {
          const data = await listRes.json() as { searches: SavedSearch[] }
          setSearches(data.searches)
        }
      }
    } catch {
      const res = await fetch('/api/saved-searches')
      if (res.ok) {
        const data = await res.json() as { searches: SavedSearch[] }
        setSearches(data.searches)
      }
    } finally {
      setDeletingId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <span className="readout text-signal">Alerts</span>
          <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-ink">Saved Searches</h1>
          <p className="mt-1.5 text-sm text-ink-soft">Get daily email alerts when new businesses match your search</p>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-2xl bg-paper-2" />
          ))}
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <span className="readout text-signal">Alerts</span>
          <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-ink">Saved Searches</h1>
          <p className="mt-1.5 text-sm text-ink-soft">Get daily email alerts when new businesses match your search</p>
        </div>
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-sand bg-card py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-signal-50">
            <AlertCircle className="h-7 w-7 text-signal" aria-hidden="true" />
          </div>
          <div>
            <p className="font-display text-base font-bold text-ink">Couldn&rsquo;t load your saved searches</p>
            <p className="mt-1 max-w-xs text-sm text-stone">
              Something went wrong. Check your connection and try again.
            </p>
          </div>
          <button
            onClick={() => load()}
            className="inline-flex items-center gap-2 rounded-full bg-signal px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-signal-600 active:scale-95"
          >
            <RefreshCw className="h-4 w-4 shrink-0" />
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <span className="readout text-signal">Alerts</span>
        <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-ink">Saved Searches</h1>
        <p className="mt-1.5 text-sm text-ink-soft">
          Get daily email alerts when new businesses match your search
        </p>
      </div>

      {searches.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-sand bg-card py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-signal-50">
            <Bell className="h-7 w-7 text-signal" aria-hidden="true" />
          </div>
          <div>
            <p className="font-display text-base font-bold text-ink">No saved searches yet</p>
            <p className="mt-1 text-sm text-stone max-w-xs">
              Run a search and click &ldquo;Save search&rdquo; to get started
            </p>
          </div>
          <a
            href="/search"
            className="inline-flex items-center gap-2 rounded-full bg-signal px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-signal-600 active:scale-95"
          >
            <Search className="h-4 w-4 shrink-0" />
            Search Leads
          </a>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-sand bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-sand bg-paper-2 text-left">
                <th className="px-4 py-3 readout font-medium text-stone">Name</th>
                <th className="hidden px-4 py-3 readout font-medium text-stone sm:table-cell">Location</th>
                <th className="hidden px-4 py-3 readout font-medium text-stone md:table-cell">Category</th>
                <th className="px-4 py-3 text-center readout font-medium text-stone">Alerts</th>
                <th className="hidden px-4 py-3 readout font-medium text-stone lg:table-cell">Last run</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-sand">
              {searches.map((search) => (
                <tr key={search.id} className="transition-colors hover:bg-signal-50/50">
                  <td className="px-4 py-3 font-semibold text-ink">{search.name}</td>
                  <td className="hidden px-4 py-3 text-ink-soft sm:table-cell">
                    <span className="font-mono">{search.zip}</span> · {search.radius} mi
                  </td>
                  <td className="hidden px-4 py-3 capitalize text-ink-soft md:table-cell">
                    {search.category}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {isPaidUser ? (
                      <button
                        onClick={() => handleToggleAlert(search)}
                        disabled={togglingId === search.id}
                        aria-label={search.alertEnabled ? 'Disable alert' : 'Enable alert'}
                        className={`inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                          search.alertEnabled ? 'bg-signal' : 'bg-sand'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                            search.alertEnabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    ) : (
                      <div className="group relative inline-block">
                        <button
                          disabled
                          aria-label="Upgrade to enable alerts"
                          className="inline-flex h-6 w-11 cursor-not-allowed items-center rounded-full bg-sand opacity-60"
                        >
                          <span className="inline-block h-4 w-4 translate-x-1 transform rounded-full bg-white shadow" />
                        </button>
                        <div className="absolute bottom-full left-1/2 z-10 mb-1 hidden w-40 -translate-x-1/2 rounded-lg bg-ink px-2 py-1.5 text-center text-xs text-paper shadow-lg group-hover:block">
                          Upgrade to enable alerts
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="hidden px-4 py-3 text-xs text-stone lg:table-cell">
                    {search.lastRunAt ? formatRelativeTime(search.lastRunAt) : 'Never'}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleDelete(search.id)}
                      disabled={deletingId === search.id}
                      aria-label="Delete saved search"
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-stone transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5 shrink-0" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!isPaidUser && (
            <div className="border-t border-sand bg-paper-2 px-4 py-3">
              <p className="text-xs text-stone">
                <span className="font-mono">{searches.length}</span> of <span className="font-mono">8</span> searches used on free plan ·{' '}
                <a href="/settings" className="font-semibold text-signal hover:text-signal-600">
                  Upgrade for unlimited saves + alerts
                </a>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
