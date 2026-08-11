'use client'

import { Clock, RotateCcw, MapPin, Tag, Compass } from 'lucide-react'
import { SearchHistory } from '@/types/lead'

interface RecentSearchesProps {
  searches: SearchHistory[]
  onRerun?: (search: SearchHistory) => void
}

function timeAgo(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function RecentSearches({ searches, onRerun }: RecentSearchesProps) {
  if (searches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-paper-2 border border-sand">
          <Clock className="h-6 w-6 text-stone" />
        </div>
        <div>
          <p className="text-sm font-medium text-ink-soft">No recent searches</p>
          <p className="mt-1 text-xs text-stone">
            Your search history will appear here
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="divide-y divide-sand">
      {searches.map((search) => (
        <div
          key={search.id}
          className="flex items-center justify-between gap-3 px-1 py-3 transition-colors hover:bg-paper-2 rounded-xl group"
        >
          <div className="flex items-start gap-3 min-w-0">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-signal-50">
              <MapPin className="h-4 w-4 text-signal shrink-0" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-mono text-sm font-semibold text-ink tabular-nums">
                  {search.zipCode}
                </span>
                {search.category && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-signal-50 px-2 py-0.5 text-xs font-medium text-signal">
                    <Tag className="h-2.5 w-2.5 shrink-0" />
                    {search.category}
                  </span>
                )}
                <span className="inline-flex items-center gap-1 text-xs text-stone">
                  <Compass className="h-2.5 w-2.5 shrink-0" />
                  {search.radius} mi
                </span>
              </div>
              <div className="mt-0.5 flex items-center gap-2">
                <span className="text-xs text-stone">{timeAgo(search.createdAt)}</span>
                <span className="text-sand">·</span>
                <span className="font-mono text-xs font-medium text-ink-soft tabular-nums">
                  {search.resultCount} results
                </span>
              </div>
            </div>
          </div>

          {onRerun && (
            <button
              onClick={() => onRerun(search)}
              aria-label={`Rerun search for ZIP ${search.zipCode}`}
              className="shrink-0 flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium text-stone transition-all opacity-0 group-hover:opacity-100 hover:bg-signal-50 hover:text-signal"
            >
              <RotateCcw className="h-3.5 w-3.5 shrink-0" />
              Rerun
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
