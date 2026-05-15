'use client'

import { useState, useCallback, useEffect, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  LayoutGrid,
  List,
  Download,
  CheckSquare,
  X,
  ChevronDown,
  SearchX,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Lead, SearchParams, SearchHistory } from '@/types/lead'
import { exportToCSV } from '@/lib/export'
import { SearchFilters } from '@/components/leads/SearchFilters'
import { LeadCard } from '@/components/leads/LeadCard'
import { LeadTable } from '@/components/leads/LeadTable'

type ViewMode = 'card' | 'table'
type SortOption = 'score_desc' | 'score_asc' | 'rating_desc' | 'name_asc'

const SORT_LABELS: Record<SortOption, string> = {
  score_desc: 'Score: High to Low',
  score_asc: 'Score: Low to High',
  rating_desc: 'Rating: High to Low',
  name_asc: 'Name: A to Z',
}

const SAVED_IDS_KEY = 'leadzip_saved'
const SAVED_LEADS_KEY = 'leadzip_saved_leads'
const HISTORY_KEY = 'leadzip_search_history'

function SkeletonCard() {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 space-y-2">
          <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200" />
          <div className="h-3 w-1/3 animate-pulse rounded-full bg-slate-100" />
        </div>
        <div className="h-6 w-16 animate-pulse rounded-full bg-slate-100" />
      </div>
      <div className="h-3 w-1/2 animate-pulse rounded bg-slate-100" />
      <div className="h-3 w-2/3 animate-pulse rounded bg-slate-100" />
      <div className="h-3 w-1/3 animate-pulse rounded bg-slate-100" />
      <div className="h-3 w-1/4 animate-pulse rounded bg-red-50" />
      <div className="mt-1 flex gap-2 border-t border-slate-100 pt-3">
        <div className="h-7 w-16 animate-pulse rounded-lg bg-slate-100" />
        <div className="h-7 w-16 animate-pulse rounded-lg bg-slate-100" />
      </div>
    </div>
  )
}

function EmptyState({ hasSearched }: { hasSearched: boolean }) {
  if (!hasSearched) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50">
          <SearchX className="h-8 w-8 text-blue-400" aria-hidden="true" />
        </div>
        <div>
          <p className="text-base font-semibold text-slate-700">Ready to find leads</p>
          <p className="mt-1 text-sm text-slate-400">
            Enter a ZIP code and click Search Leads to get started
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
        <SearchX className="h-8 w-8 text-slate-400" aria-hidden="true" />
      </div>
      <div>
        <p className="text-base font-semibold text-slate-700">No leads found</p>
        <p className="mt-1 text-sm text-slate-400">
          Try expanding your radius or changing the category
        </p>
      </div>
    </div>
  )
}

function SearchPageInner() {
  const searchParams = useSearchParams()

  const [leads, setLeads] = useState<Lead[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('card')
  const [sortOption, setSortOption] = useState<SortOption>('score_desc')
  const [sortMenuOpen, setSortMenuOpen] = useState(false)
  const [savedLeadIds, setSavedLeadIds] = useState<Set<string>>(new Set())
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [totalFound, setTotalFound] = useState(0)

  // Load saved lead IDs from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SAVED_IDS_KEY)
      if (raw) {
        const ids: string[] = JSON.parse(raw)
        setSavedLeadIds(new Set(ids))
      }
    } catch {
      // ignore
    }
  }, [])

  // Pre-populate initial filter values from URL params (for Rerun from history)
  const initialValues = useMemo<Partial<SearchParams>>(() => ({
    zipCode: searchParams.get('zip') ?? '',
    radiusMiles: searchParams.get('radius') ? Number(searchParams.get('radius')) : 25,
    category: searchParams.get('category') ?? '',
    keyword: searchParams.get('keyword') ?? undefined,
  }), [searchParams])

  const handleSearch = useCallback(async (params: SearchParams) => {
    setIsLoading(true)
    setHasSearched(true)
    setSelectedIds(new Set())

    try {
      const res = await fetch('/api/leads/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })

      if (!res.ok) {
        throw new Error(`Search API returned ${res.status}`)
      }

      const result = await res.json() as { leads: Lead[]; total: number }
      setLeads(result.leads)
      setTotalFound(result.total)

      // Save to search history in localStorage
      try {
        const entry: SearchHistory = {
          id: `h_${Date.now()}`,
          userId: 'local',
          zipCode: params.zipCode,
          radius: params.radiusMiles,
          category: params.category,
          keyword: params.keyword ?? '',
          resultCount: result.total,
          createdAt: new Date().toISOString(),
        }
        const raw = localStorage.getItem(HISTORY_KEY)
        const existing: SearchHistory[] = raw ? JSON.parse(raw) : []
        localStorage.setItem(HISTORY_KEY, JSON.stringify([entry, ...existing].slice(0, 50)))
      } catch {
        // non-fatal
      }
    } catch (err) {
      console.error('Search failed:', err)
      setLeads([])
      setTotalFound(0)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Auto-run search if URL params are present (from history Rerun)
  useEffect(() => {
    const zip = searchParams.get('zip')
    if (zip) {
      handleSearch({
        zipCode: zip,
        radiusMiles: searchParams.get('radius') ? Number(searchParams.get('radius')) : 25,
        category: searchParams.get('category') ?? '',
        keyword: searchParams.get('keyword') ?? undefined,
      })
    }
    // Only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSave = useCallback((lead: Lead) => {
    setSavedLeadIds((prev) => {
      const next = new Set(prev)
      if (next.has(lead.id)) {
        next.delete(lead.id)
      } else {
        next.add(lead.id)
      }
      try {
        // Track IDs for badge display in search results
        localStorage.setItem(SAVED_IDS_KEY, JSON.stringify([...next]))

        // Also maintain the full lead objects list used by /saved and /exports
        const rawLeads = localStorage.getItem(SAVED_LEADS_KEY)
        let savedLeads: Lead[] = []
        try { savedLeads = JSON.parse(rawLeads ?? '[]') } catch { /* ignore */ }

        if (next.has(lead.id)) {
          if (!savedLeads.some((l) => l.id === lead.id)) {
            savedLeads.push({ ...lead, savedAt: new Date().toISOString() })
          }
        } else {
          savedLeads = savedLeads.filter((l) => l.id !== lead.id)
        }
        localStorage.setItem(SAVED_LEADS_KEY, JSON.stringify(savedLeads))
      } catch {
        // ignore
      }
      return next
    })
  }, [])

  const handleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const handleExportSelected = useCallback(() => {
    const selected = leads.filter((l) => selectedIds.has(l.id))
    if (selected.length === 0) return
    exportToCSV(selected, `leadzip-export-${Date.now()}`)
    setSelectedIds(new Set())
  }, [leads, selectedIds])

  const sortedLeads = [...leads].sort((a, b) => {
    switch (sortOption) {
      case 'score_asc':
        return a.leadScore - b.leadScore
      case 'rating_desc':
        return (b.rating ?? 0) - (a.rating ?? 0)
      case 'name_asc':
        return a.businessName.localeCompare(b.businessName)
      case 'score_desc':
      default:
        return b.leadScore - a.leadScore
    }
  })

  const selectedCount = selectedIds.size

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Search Leads</h1>
        <p className="mt-1 text-sm text-slate-500">
          Find local businesses that need your services
        </p>
      </div>

      {/* Main layout: sidebar + results */}
      <div className="flex gap-6">
        {/* Filters sidebar — desktop */}
        <aside className="hidden w-72 shrink-0 lg:block">
          <SearchFilters onSearch={handleSearch} isLoading={isLoading} initialValues={initialValues} />
        </aside>

        {/* Results */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Mobile search filters */}
          <div className="lg:hidden">
            <SearchFilters onSearch={handleSearch} isLoading={isLoading} initialValues={initialValues} />
          </div>

          {/* Results toolbar */}
          {(hasSearched || leads.length > 0) && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Count */}
              <p className="text-sm text-slate-600">
                {isLoading ? (
                  <span className="inline-block h-4 w-32 animate-pulse rounded bg-slate-200" />
                ) : (
                  <>
                    <span className="font-semibold text-slate-900 tabular-nums">{totalFound}</span>{' '}
                    {totalFound === 1 ? 'lead' : 'leads'} found
                  </>
                )}
              </p>

              <div className="flex items-center gap-2">
                {/* Sort */}
                <div className="relative">
                  <button
                    onClick={() => setSortMenuOpen((o) => !o)}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-50"
                    aria-expanded={sortMenuOpen}
                    aria-haspopup="listbox"
                  >
                    {SORT_LABELS[sortOption]}
                    <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 transition-transform', sortMenuOpen && 'rotate-180')} />
                  </button>

                  {sortMenuOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        aria-hidden="true"
                        onClick={() => setSortMenuOpen(false)}
                      />
                      <div
                        role="listbox"
                        aria-label="Sort options"
                        className="absolute right-0 top-full z-20 mt-1 w-48 rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
                      >
                        {(Object.entries(SORT_LABELS) as [SortOption, string][]).map(([key, label]) => (
                          <button
                            key={key}
                            role="option"
                            aria-selected={sortOption === key}
                            onClick={() => {
                              setSortOption(key)
                              setSortMenuOpen(false)
                            }}
                            className={cn(
                              'w-full px-4 py-2 text-left text-sm transition-colors hover:bg-slate-50',
                              sortOption === key ? 'font-semibold text-blue-600' : 'text-slate-700'
                            )}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* View toggle */}
                <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm">
                  <button
                    onClick={() => setViewMode('card')}
                    aria-label="Card view"
                    aria-pressed={viewMode === 'card'}
                    className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-md transition-all',
                      viewMode === 'card'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-600'
                    )}
                  >
                    <LayoutGrid className="h-3.5 w-3.5 shrink-0" />
                  </button>
                  <button
                    onClick={() => setViewMode('table')}
                    aria-label="Table view"
                    aria-pressed={viewMode === 'table'}
                    className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-md transition-all',
                      viewMode === 'table'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-600'
                    )}
                  >
                    <List className="h-3.5 w-3.5 shrink-0" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Loading skeletons */}
          {isLoading && viewMode === 'card' && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          )}

          {isLoading && viewMode === 'table' && (
            <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex gap-4">
                  <div className="h-4 w-4 animate-pulse rounded bg-slate-200" />
                  <div className="h-4 flex-1 animate-pulse rounded bg-slate-200" />
                  <div className="h-4 w-24 animate-pulse rounded bg-slate-100" />
                  <div className="h-4 w-20 animate-pulse rounded bg-slate-100" />
                  <div className="h-4 w-16 animate-pulse rounded bg-slate-100" />
                </div>
              ))}
            </div>
          )}

          {/* Results */}
          {!isLoading && leads.length > 0 && viewMode === 'card' && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {sortedLeads.map((lead) => (
                <LeadCard
                  key={lead.id}
                  lead={lead}
                  onSave={handleSave}
                  isSaved={savedLeadIds.has(lead.id)}
                  isSelected={selectedIds.has(lead.id)}
                  onSelect={handleSelect}
                />
              ))}
            </div>
          )}

          {!isLoading && leads.length > 0 && viewMode === 'table' && (
            <LeadTable
              leads={sortedLeads}
              onSave={handleSave}
              savedIds={[...savedLeadIds]}
            />
          )}

          {/* Empty state */}
          {!isLoading && leads.length === 0 && (
            <EmptyState hasSearched={hasSearched} />
          )}
        </div>
      </div>

      {/* Floating bulk action bar */}
      {selectedCount > 0 && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2"
        >
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3 shadow-xl">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <CheckSquare className="h-4 w-4 text-blue-600 shrink-0" />
              {selectedCount} {selectedCount === 1 ? 'lead' : 'leads'} selected
            </div>
            <div className="h-4 w-px bg-slate-200" />
            <button
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700"
              onClick={handleExportSelected}
            >
              <Download className="h-3.5 w-3.5 shrink-0" />
              Export Selected
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              aria-label="Clear selection"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-4 w-4 shrink-0" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchPageInner />
    </Suspense>
  )
}
