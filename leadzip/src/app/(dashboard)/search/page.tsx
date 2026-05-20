'use client'

import { useState, useCallback, useEffect, useMemo, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  LayoutGrid,
  List,
  Map as MapIcon,
  Download,
  CheckSquare,
  X,
  ChevronDown,
  SearchX,
  Loader2,
  Bell,
  Activity,
  SlidersHorizontal,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Lead, SearchParams, SearchHistory } from '@/types/lead'
import { exportToCSV, exportToHubSpot, exportToSalesforce } from '@/lib/export'
import { SearchFilters } from '@/components/leads/SearchFilters'
import { LeadCard } from '@/components/leads/LeadCard'
import { LeadTable } from '@/components/leads/LeadTable'
import { LeadsMapWrapper } from '@/components/leads/LeadsMapWrapper'
import { createClient } from '@/lib/supabase/client'
import { SaveSearchModal } from '@/components/SaveSearchModal'
import type { SavedSearch } from '@/types/saved-search'

type ViewMode = 'card' | 'table' | 'map'
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

const MAX_BULK_ZIPS: Record<string, number> = { free: 3, pro: 10, agency: 25 }

function haversineDistanceMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function computeCompetitorDensity(leads: Lead[]): Lead[] {
  return leads.map((lead) => {
    if (lead.latitude == null || lead.longitude == null) return lead
    const count = leads.filter(
      (other) =>
        other.id !== lead.id &&
        other.category === lead.category &&
        other.latitude != null &&
        other.longitude != null &&
        haversineDistanceMiles(lead.latitude!, lead.longitude!, other.latitude!, other.longitude!) <= 1
    ).length
    return { ...lead, nearbyCompetitorCount: count }
  })
}

function formatAge(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (secs < 60) return 'just now'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  return `${hrs}h ago`
}

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

function EmptyState({ hasSearched, errorMessage }: { hasSearched: boolean; errorMessage?: string }) {
  if (errorMessage) {
    const isLimit = errorMessage.includes('limit')
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <div className={`flex h-16 w-16 items-center justify-center rounded-2xl ${isLimit ? 'bg-amber-50' : 'bg-red-50'}`}>
          <SearchX className={`h-8 w-8 ${isLimit ? 'text-amber-400' : 'text-red-400'}`} aria-hidden="true" />
        </div>
        <div>
          <p className="text-base font-semibold text-slate-700">
            {isLimit ? 'Search limit reached' : 'Search failed'}
          </p>
          <p className="mt-1 text-sm text-slate-500 max-w-xs">{errorMessage}</p>
          {isLimit && (
            <a
              href="/settings"
              className="mt-3 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
            >
              Upgrade plan
            </a>
          )}
        </div>
      </div>
    )
  }

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
  const [mapCenter, setMapCenter] = useState<{ lat: number; lon: number } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined)
  const [viewMode, setViewMode] = useState<ViewMode>('card')
  const [sortOption, setSortOption] = useState<SortOption>('score_desc')
  const [sortMenuOpen, setSortMenuOpen] = useState(false)
  const [savedLeadIds, setSavedLeadIds] = useState<Set<string>>(new Set())
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [totalFound, setTotalFound] = useState(0)

  const [searchMode, setSearchMode] = useState<'single' | 'bulk'>('single')
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null)
  const [noResultZips, setNoResultZips] = useState<string[]>([])
  const [userPlan, setUserPlan] = useState<'free' | 'pro' | 'agency'>('free')
  const [searchedZipCount, setSearchedZipCount] = useState(0)
  const [lastSearchParams, setLastSearchParams] = useState<SearchParams | null>(null)
  const [saveModalOpen, setSaveModalOpen] = useState(false)
  const [savedSearchCount, setSavedSearchCount] = useState(0)
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([])
  const [healthCheckProgress, setHealthCheckProgress] = useState<{ done: number; total: number } | null>(null)
  const healthCheckAbortRef = useRef(false)
  const [dataSource, setDataSource] = useState<string | null>(null)
  const [sourceBannerDismissed, setSourceBannerDismissed] = useState(false)
  const [fetchedAt, setFetchedAt] = useState<string | null>(null)
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)

  // Load saved lead IDs from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SAVED_IDS_KEY)
      if (raw) {
        const ids: string[] = JSON.parse(raw)
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSavedLeadIds(new Set(ids))
      }
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase
        .from('users_profile')
        .select('plan')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          if (data?.plan) setUserPlan(data.plan as 'free' | 'pro' | 'agency')
        })
    })
  }, [])

  useEffect(() => {
    fetch('/api/saved-searches')
      .then((r) => r.ok ? r.json() : { searches: [] })
      .then((data: { searches: SavedSearch[] }) => {
        setSavedSearches(data.searches)
        setSavedSearchCount(data.searches.length)
      })
      .catch(() => {})
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
    setErrorMessage(undefined)
    setSearchedZipCount(0)

    try {
      const res = await fetch('/api/leads/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })

      if (!res.ok) {
        let msg = 'Something went wrong. Please try again.'
        try {
          const body = await res.json() as { error?: string }
          if (body.error) msg = body.error
        } catch { /* ignore */ }
        if (res.status === 429) {
          setErrorMessage(msg.includes('limit') ? msg : 'Monthly search limit reached. Upgrade your plan for more searches.')
        } else {
          setErrorMessage(msg)
        }
        setLeads([])
        setTotalFound(0)
        return
      }

      const result = await res.json() as { leads: Lead[]; total: number; center?: { lat: number; lon: number }; source?: string; fetchedAt?: string }
      const filteredLeads = params.excludeSaved
        ? result.leads.filter((l) => !savedLeadIds.has(l.id))
        : result.leads
      const enrichedLeads = computeCompetitorDensity(filteredLeads)
      setLastSearchParams(params)
      setLeads(enrichedLeads)
      setTotalFound(enrichedLeads.length)
      if (result.center) setMapCenter(result.center)
      setDataSource(result.source ?? null)
      setFetchedAt(result.fetchedAt ?? null)
      setSourceBannerDismissed(false)

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
      setErrorMessage('Search failed. Please check your connection and try again.')
    } finally {
      setIsLoading(false)
    }
  }, [savedLeadIds])

  const handleBulkSearch = useCallback(async (
    baseParams: Omit<SearchParams, 'zipCode'>,
    zips: string[]
  ) => {
    setIsLoading(true)
    setHasSearched(true)
    setSelectedIds(new Set())
    setErrorMessage(undefined)
    setBulkProgress({ done: 0, total: zips.length })
    setNoResultZips([])
    setSearchedZipCount(zips.length)

    try {
      const results = await Promise.all(
        zips.map(async (zip) => {
          try {
            const res = await fetch('/api/leads/search', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...baseParams, zipCode: zip }),
            })
            setBulkProgress((prev) =>
              prev ? { done: prev.done + 1, total: prev.total } : null
            )
            if (!res.ok) return { zip, leads: [] as Lead[], center: undefined }
            const data = await res.json() as { leads: Lead[]; total: number; center?: { lat: number; lon: number } }
            return { zip, leads: data.leads, center: data.center }
          } catch {
            setBulkProgress((prev) =>
              prev ? { done: prev.done + 1, total: prev.total } : null
            )
            return { zip, leads: [] as Lead[], center: undefined }
          }
        })
      )

      const emptyZips = results.filter((r) => r.leads.length === 0).map((r) => r.zip)
      setNoResultZips(emptyZips)

      const firstCenter = results.find((r) => r.center)?.center
      if (firstCenter) setMapCenter(firstCenter)

      const allLeads = results.flatMap((r) =>
        r.leads.map((l) => ({ ...l, sourceZip: r.zip }))
      )

      const seen = new Map<string, Lead>()
      for (const lead of allLeads) {
        const key = `${lead.businessName.toLowerCase().trim()}|${lead.address.toLowerCase().trim()}`
        const existing = seen.get(key)
        if (
          !existing ||
          (lead.distanceMiles ?? Infinity) < (existing.distanceMiles ?? Infinity)
        ) {
          seen.set(key, lead)
        }
      }

      const merged = [...seen.values()].sort((a, b) => b.leadScore - a.leadScore)

      const filtered = baseParams.excludeSaved
        ? merged.filter((l) => !savedLeadIds.has(l.id))
        : merged

      const enrichedBulk = computeCompetitorDensity(filtered)
      setLeads(enrichedBulk)
      setTotalFound(enrichedBulk.length)

      try {
        const raw = localStorage.getItem(HISTORY_KEY)
        const existing: SearchHistory[] = raw ? JSON.parse(raw) : []
        const entries: SearchHistory[] = zips.map((zip) => ({
          id: `h_${Date.now()}_${zip}`,
          userId: 'local',
          zipCode: zip,
          radius: baseParams.radiusMiles,
          category: baseParams.category ?? '',
          keyword: baseParams.keyword ?? '',
          resultCount: results.find((r) => r.zip === zip)?.leads.length ?? 0,
          createdAt: new Date().toISOString(),
        }))
        localStorage.setItem(
          HISTORY_KEY,
          JSON.stringify([...entries, ...existing].slice(0, 50))
        )
      } catch { /* non-fatal */ }

    } catch (err) {
      console.error('Bulk search failed:', err)
      setLeads([])
      setTotalFound(0)
      setErrorMessage('Bulk search failed. Please try again.')
    } finally {
      setIsLoading(false)
      setBulkProgress(null)
    }
  }, [savedLeadIds])

  // Auto-run search if URL params are present (from history Rerun or onboarding)
  useEffect(() => {
    const zip = searchParams.get('zip')
    if (zip) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      handleSearch({
        zipCode: zip,
        radiusMiles: searchParams.get('radius') ? Number(searchParams.get('radius')) : 25,
        category: searchParams.get('category') ?? '',
        keyword: searchParams.get('keyword') ?? undefined,
        noWebsite: searchParams.get('noWebsite') === 'true' || undefined,
        hasWebsite: searchParams.get('hasWebsite') === 'true' || undefined,
        minRating: searchParams.get('minRating') ? Number(searchParams.get('minRating')) : undefined,
        minReviews: searchParams.get('minReviews') ? Number(searchParams.get('minReviews')) : undefined,
      })
    }
    // Only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSave = useCallback((lead: Lead) => {
    setSavedLeadIds((prev) => {
      const next = new Set(prev)
      const removing = next.has(lead.id)
      if (removing) { next.delete(lead.id) } else { next.add(lead.id) }

      try {
        localStorage.setItem(SAVED_IDS_KEY, JSON.stringify([...next]))

        const rawLeads = localStorage.getItem(SAVED_LEADS_KEY)
        let savedLeads: Lead[] = []
        try { savedLeads = JSON.parse(rawLeads ?? '[]') } catch { /* ignore */ }

        if (!removing) {
          if (!savedLeads.some((l) => l.id === lead.id)) {
            savedLeads.push({ ...lead, savedAt: new Date().toISOString() })
          }
        } else {
          savedLeads = savedLeads.filter((l) => l.id !== lead.id)
        }
        localStorage.setItem(SAVED_LEADS_KEY, JSON.stringify(savedLeads))
      } catch { /* ignore */ }

      // Persist to Supabase via API (non-blocking, fire-and-forget)
      if (removing) {
        fetch('/api/leads/save', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leadId: lead.id }),
        }).catch(() => {})
      } else {
        fetch('/api/leads/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lead: { ...lead, savedAt: new Date().toISOString() } }),
        }).catch(() => {})
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

  const handleExportHubSpot = useCallback(() => {
    const selected = leads.filter((l) => selectedIds.has(l.id))
    if (selected.length === 0) return
    exportToHubSpot(selected)
    setSelectedIds(new Set())
  }, [leads, selectedIds])

  const handleExportSalesforce = useCallback(() => {
    const selected = leads.filter((l) => selectedIds.has(l.id))
    if (selected.length === 0) return
    exportToSalesforce(selected)
    setSelectedIds(new Set())
  }, [leads, selectedIds])

  const handleBatchHealthCheck = useCallback(async () => {
    const leadsWithSite = leads.filter((l) => !!l.website && l.digitalHealthScore === undefined)
    if (leadsWithSite.length === 0) return
    healthCheckAbortRef.current = false
    setHealthCheckProgress({ done: 0, total: leadsWithSite.length })

    for (let i = 0; i < leadsWithSite.length; i++) {
      if (healthCheckAbortRef.current) break
      const lead = leadsWithSite[i]
      try {
        const res = await fetch('/api/leads/enrich/health', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ website: lead.website, leadId: lead.id }),
        })
        if (res.ok) {
          const data = await res.json() as { score?: number; details?: import('@/types/lead').DigitalHealthDetails }
          setLeads((prev) =>
            prev.map((l) =>
              l.id === lead.id
                ? { ...l, digitalHealthScore: data.score ?? 0, digitalHealthDetails: data.details }
                : l
            )
          )
        }
      } catch { /* non-fatal */ }
      setHealthCheckProgress((prev) => prev ? { done: prev.done + 1, total: prev.total } : null)
      if (i < leadsWithSite.length - 1) await new Promise((r) => setTimeout(r, 150))
    }
    setHealthCheckProgress(null)
  }, [leads])

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
  const maxBulkZips = MAX_BULK_ZIPS[userPlan] ?? 3

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
          <SearchFilters
            onSearch={handleSearch}
            onBulkSearch={handleBulkSearch}
            isLoading={isLoading}
            initialValues={initialValues}
            searchMode={searchMode}
            onSearchModeChange={setSearchMode}
            maxBulkZips={maxBulkZips}
          />
        </aside>

        {/* Results */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Mobile filter trigger */}
          <div className="lg:hidden mb-4 flex items-center gap-2">
            <button
              onClick={() => setFilterSheetOpen(true)}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-colors min-h-[44px]"
            >
              <SlidersHorizontal className="h-4 w-4 text-slate-400" />
              Filters
            </button>
          </div>

          {/* Mobile bottom sheet */}
          {filterSheetOpen && (
            <>
              {/* Backdrop */}
              <div
                className="lg:hidden fixed inset-0 bg-black/50 z-40"
                onClick={() => setFilterSheetOpen(false)}
                aria-hidden="true"
              />
              {/* Sheet */}
              <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl bg-white shadow-2xl animate-slide-up max-h-[70vh] overflow-y-auto">
                {/* Drag handle */}
                <div className="flex justify-center pt-3 pb-1">
                  <div className="h-1 w-10 rounded-full bg-slate-300" />
                </div>
                <div className="flex items-center justify-between px-4 pb-2">
                  <h2 className="text-sm font-semibold text-slate-900">Filters</h2>
                  <button
                    onClick={() => setFilterSheetOpen(false)}
                    className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                    aria-label="Close filters"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="px-4 pb-6">
                  <SearchFilters
                    onSearch={(params) => {
                      handleSearch(params)
                      setFilterSheetOpen(false)
                    }}
                    onBulkSearch={handleBulkSearch}
                    isLoading={isLoading}
                    initialValues={initialValues}
                    searchMode={searchMode}
                    onSearchModeChange={setSearchMode}
                    maxBulkZips={maxBulkZips}
                  />
                </div>
              </div>
            </>
          )}

          {/* Results toolbar */}
          {(hasSearched || leads.length > 0) && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Count */}
              <p className="text-sm text-slate-600">
                {isLoading ? (
                  searchMode === 'bulk' && bulkProgress ? (
                    <span className="inline-flex items-center gap-2 text-sm text-slate-500">
                      <Loader2 className="h-4 w-4 animate-spin shrink-0 text-blue-500" />
                      Searching {bulkProgress.total} ZIP{bulkProgress.total !== 1 ? 's' : ''}…{' '}
                      ({bulkProgress.done}/{bulkProgress.total} complete)
                    </span>
                  ) : (
                    <span className="inline-block h-4 w-32 animate-pulse rounded bg-slate-200" />
                  )
                ) : (
                  <>
                    <span className="font-semibold text-slate-900 tabular-nums">{totalFound}</span>{' '}
                    {searchMode === 'bulk' && searchedZipCount > 1 ? (
                      <>
                        results across{' '}
                        <span className="font-semibold text-slate-900 tabular-nums">
                          {searchedZipCount}
                        </span>{' '}
                        ZIP codes
                      </>
                    ) : (
                      <>{totalFound === 1 ? 'lead' : 'leads'} found</>
                    )}
                    {fetchedAt && (
                      <span className="ml-2 text-slate-400">
                        · fetched {formatAge(fetchedAt)}
                      </span>
                    )}
                    {noResultZips.length > 0 && (
                      <span className="ml-2 inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                        No results for: {noResultZips.join(', ')}
                      </span>
                    )}
                  </>
                )}
              </p>

              <div className="flex items-center gap-2">
                {/* Save this search */}
                {leads.length > 0 && !isLoading && searchMode === 'single' && lastSearchParams && (
                  <button
                    onClick={() => setSaveModalOpen(true)}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-50"
                    aria-label="Save this search"
                  >
                    <Bell className="h-3.5 w-3.5 shrink-0" />
                    Save search
                  </button>
                )}

                {/* Batch health check */}
                {leads.length > 0 && !isLoading && leads.some((l) => !!l.website && l.digitalHealthScore === undefined) && (
                  <div className="flex items-center gap-2">
                    {healthCheckProgress ? (
                      <>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0 text-blue-500" />
                          Checking {healthCheckProgress.done} / {healthCheckProgress.total} websites…
                        </div>
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-blue-500 transition-all duration-300"
                            style={{ width: `${Math.round((healthCheckProgress.done / healthCheckProgress.total) * 100)}%` }}
                          />
                        </div>
                        <button
                          onClick={() => { healthCheckAbortRef.current = true }}
                          className="text-xs text-slate-400 hover:text-slate-600"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={handleBatchHealthCheck}
                        className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-50"
                      >
                        <Activity className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                        Check all websites
                      </button>
                    )}
                  </div>
                )}
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
                      'hidden lg:flex h-7 w-7 items-center justify-center rounded-md transition-all',
                      viewMode === 'table'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-600'
                    )}
                  >
                    <List className="h-3.5 w-3.5 shrink-0" />
                  </button>
                  <button
                    onClick={() => setViewMode('map')}
                    aria-label="Map view"
                    aria-pressed={viewMode === 'map'}
                    className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-md transition-all',
                      viewMode === 'map'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-600'
                    )}
                  >
                    <MapIcon className="h-3.5 w-3.5 shrink-0" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Data source banner */}
          {!isLoading && leads.length > 0 && !sourceBannerDismissed && dataSource && dataSource !== 'google_places' && dataSource !== 'foursquare' && (
            <div className={cn(
              'flex items-center justify-between gap-3 rounded-lg border px-4 py-2.5 text-sm',
              dataSource === 'demo'
                ? 'border-amber-200 bg-amber-50 text-amber-800'
                : 'border-slate-200 bg-slate-50 text-slate-600'
            )}>
              <span>
                {dataSource === 'demo' ? (
                  <>
                    <span className="font-semibold">Demo data</span> — these are sample businesses, not real leads.{' '}
                    Add a <span className="font-medium">GOOGLE_PLACES_API_KEY</span> in your Vercel environment variables to get real results.
                  </>
                ) : (
                  <>Data from <span className="font-medium">OpenStreetMap</span> · Real businesses, limited contact info</>
                )}
              </span>
              <button
                onClick={() => setSourceBannerDismissed(true)}
                aria-label="Dismiss"
                className="shrink-0 rounded p-0.5 hover:bg-black/10 transition-colors"
              >
                <X className="h-3.5 w-3.5 shrink-0" />
              </button>
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

          {isLoading && viewMode === 'map' && (
            <div className="h-96 animate-pulse rounded-xl bg-slate-200" />
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

          {!isLoading && leads.length > 0 && viewMode === 'map' && (
            <LeadsMapWrapper
              leads={leads}
              centerLat={mapCenter?.lat ?? leads.find((l) => l.latitude != null)?.latitude ?? 39.5}
              centerLon={mapCenter?.lon ?? leads.find((l) => l.longitude != null)?.longitude ?? -98.35}
            />
          )}

          {/* Empty state */}
          {!isLoading && leads.length === 0 && (
            <EmptyState hasSearched={hasSearched} errorMessage={errorMessage} />
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
              Export CSV
            </button>
            <button
              className="flex items-center gap-1.5 rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-orange-600"
              onClick={handleExportHubSpot}
            >
              <Download className="h-3.5 w-3.5 shrink-0" />
              HubSpot
            </button>
            <button
              className="flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-sky-700"
              onClick={handleExportSalesforce}
            >
              <Download className="h-3.5 w-3.5 shrink-0" />
              Salesforce
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

      {saveModalOpen && lastSearchParams && (
        <SaveSearchModal
          isOpen={saveModalOpen}
          onClose={() => setSaveModalOpen(false)}
          defaultName={`${lastSearchParams.category || 'Leads'} · ${lastSearchParams.zipCode}`}
          zip={lastSearchParams.zipCode}
          radius={lastSearchParams.radiusMiles ?? 25}
          category={lastSearchParams.category ?? ''}
          keyword={lastSearchParams.keyword}
          savedCount={savedSearchCount}
          isPaidUser={userPlan !== 'free'}
          onSaved={(search) => {
            setSavedSearches((prev) => [search, ...prev])
            setSavedSearchCount((prev) => prev + 1)
          }}
        />
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
