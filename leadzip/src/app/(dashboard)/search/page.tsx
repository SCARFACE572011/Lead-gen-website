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
  Bookmark,
  Activity,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { track, bucketResultCount } from '@/lib/analytics'
import { Lead, SearchParams, SearchHistory } from '@/types/lead'
import { exportToHubSpot, exportToSalesforce } from '@/lib/export'
import {
  exportReturnedLeadsCsv,
  LeadBulkActionError,
  saveReturnedLeads,
} from '@/lib/leadBulkActions'
import { getLeadEntitlements } from '@/lib/leadEntitlements'
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

// Radius options offered in international (km) mode. Reruns from history store
// miles (integer column), so we snap the converted value back onto an option.
const KM_OPTIONS = [1, 5, 10, 25, 50]
function snapKm(km: number): number {
  return KM_OPTIONS.reduce(
    (best, opt) => (Math.abs(opt - km) < Math.abs(best - km) ? opt : best),
    KM_OPTIONS[0]
  )
}
const ZIP_RE = /^\d{5}(-\d{4})?$/

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

// Map raw provider ids to friendly names for the "real, not scraped" freshness badge
function sourceLabel(source: string | null): string {
  switch (source) {
    case 'google_places':
      return 'Google'
    case 'yelp':
      return 'Yelp'
    case 'osm':
      return 'OpenStreetMap'
    case 'foursquare':
      return 'Foursquare'
    case 'here':
      return 'HERE'
    case 'tomtom':
      return 'TomTom'
    case 'demo':
      return 'demo data'
    default:
      return 'live data'
  }
}

function SkeletonCard() {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-sand bg-card p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 space-y-2">
          <div className="h-4 w-3/4 animate-pulse rounded bg-sand" />
          <div className="h-3 w-1/3 animate-pulse rounded-full bg-paper-2" />
        </div>
        <div className="h-6 w-16 animate-pulse rounded-full bg-paper-2" />
      </div>
      <div className="h-3 w-1/2 animate-pulse rounded bg-paper-2" />
      <div className="h-3 w-2/3 animate-pulse rounded bg-paper-2" />
      <div className="h-3 w-1/3 animate-pulse rounded bg-paper-2" />
      <div className="h-3 w-1/4 animate-pulse rounded bg-signal-50" />
      <div className="mt-1 flex gap-2 border-t border-sand pt-3">
        <div className="h-7 w-16 animate-pulse rounded-full bg-paper-2" />
        <div className="h-7 w-16 animate-pulse rounded-full bg-paper-2" />
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
          <p className="text-base font-semibold font-display text-ink">
            {isLimit ? 'Search limit reached' : 'Search failed'}
          </p>
          <p className="mt-1 text-sm text-stone max-w-xs">{errorMessage}</p>
          {isLimit && (
            <a
              href="/settings"
              className="mt-3 inline-block rounded-full bg-signal px-4 py-2 text-sm font-semibold text-white hover:bg-signal-600 transition-colors"
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
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-signal-50">
          <SearchX className="h-8 w-8 text-signal" aria-hidden="true" />
        </div>
        <div>
          <p className="text-base font-semibold font-display text-ink">Ready to find leads</p>
          <p className="mt-1 text-sm text-stone">
            Enter a US ZIP code or any city worldwide, like London, UK, then click Search Leads
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-paper-2">
        <SearchX className="h-8 w-8 text-stone" aria-hidden="true" />
      </div>
      <div>
        <p className="text-base font-semibold font-display text-ink">No leads found</p>
        <p className="mt-1 text-sm text-stone">
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
  // Only the setter is used: the list itself is never rendered here, it is
  // kept so the saved-search count and modal stay in sync after a save.
  const [, setSavedSearches] = useState<SavedSearch[]>([])
  const [healthCheckProgress, setHealthCheckProgress] = useState<{ done: number; total: number } | null>(null)
  const healthCheckAbortRef = useRef(false)
  const [dataSource, setDataSource] = useState<string | null>(null)
  const [sourceBannerDismissed, setSourceBannerDismissed] = useState(false)
  const [fetchedAt, setFetchedAt] = useState<string | null>(null)
  const [fromCache, setFromCache] = useState(false)
  const [locationLabel, setLocationLabel] = useState<string | null>(null)
  const [bulkSaveProgress, setBulkSaveProgress] = useState<{ completed: number; total: number; saved: number } | null>(null)
  const [exporting, setExporting] = useState(false)
  const [actionNotice, setActionNotice] = useState<{ tone: 'success' | 'warning' | 'error'; message: string } | null>(null)

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

  // Pre-populate initial filter values from URL params (for Rerun from history).
  // The zip param may carry an international location string ("Berlin, Germany")
  // written by an international search; detect by pattern and rebuild km mode.
  const initialValues = useMemo<Partial<SearchParams>>(() => {
    const zipParam = (searchParams.get('zip') ?? '').trim()
    const locationParam = (searchParams.get('location') ?? '').trim()
    const radiusParam = searchParams.get('radius') ? Number(searchParams.get('radius')) : undefined
    const radiusKmParam = searchParams.get('radiusKm') ? Number(searchParams.get('radiusKm')) : undefined
    const countryParam = (searchParams.get('country') ?? '').trim().toUpperCase() || undefined
    const category = searchParams.get('category') ?? ''
    const keyword = searchParams.get('keyword') ?? undefined

    const zipIsZip = ZIP_RE.test(zipParam) && (!countryParam || countryParam === 'US')
    const location = locationParam || (!zipIsZip ? zipParam : '')

    if (location) {
      // History stores miles; snap back to the closest km option (10 km <-> 6 mi)
      const radiusKm = radiusKmParam ?? snapKm((radiusParam ?? 6) * 1.60934)
      return {
        zipCode: '',
        location,
        countryCode: countryParam,
        radiusKm,
        radiusMiles: Math.round(radiusKm * 0.621371 * 100) / 100,
        category,
        keyword,
      }
    }
    return {
      zipCode: zipParam,
      radiusMiles: radiusParam ?? 25,
      category,
      keyword,
    }
  }, [searchParams])

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

      const result = await res.json() as { leads: Lead[]; total: number; center?: { lat: number; lon: number }; source?: string; fetchedAt?: string; fromCache?: boolean; locationLabel?: string }
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
      setFromCache(result.fromCache ?? false)
      setSourceBannerDismissed(false)
      setLocationLabel(result.locationLabel ?? params.location ?? null)

      // Activation signal. Deliberately carries no ZIP, no location, no
      // category and no keyword: only whether the shared cache served it and
      // how many leads came back, bucketed.
      track('search_run', {
        from_cache: result.fromCache ?? false,
        result_bucket: bucketResultCount(enrichedLeads.length),
      })

      // Save to search history in localStorage
      try {
        const entry: SearchHistory = {
          id: `h_${Date.now()}`,
          userId: 'local',
          zipCode: params.location || params.zipCode,
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
    setLocationLabel(null)

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

      // One event for the whole bulk run. from_cache is null because a bulk run
      // merges several responses that can individually hit or miss the cache.
      track('search_run', {
        from_cache: null,
        result_bucket: bucketResultCount(enrichedBulk.length),
      })

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

  // Auto-run search if URL params are present (from history Rerun or onboarding).
  // initialValues already normalized ZIP vs international mode from the URL.
  useEffect(() => {
    if (!searchParams.get('zip') && !searchParams.get('location')) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    handleSearch({
      zipCode: initialValues.zipCode ?? '',
      location: initialValues.location,
      countryCode: initialValues.countryCode,
      radiusKm: initialValues.radiusKm,
      radiusMiles: initialValues.radiusMiles ?? 25,
      category: initialValues.category ?? '',
      keyword: initialValues.keyword,
      noWebsite: searchParams.get('noWebsite') === 'true' || undefined,
      hasWebsite: searchParams.get('hasWebsite') === 'true' || undefined,
      minRating: searchParams.get('minRating') ? Number(searchParams.get('minRating')) : undefined,
      minReviews: searchParams.get('minReviews') ? Number(searchParams.get('minReviews')) : undefined,
    })
    // Only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSave = useCallback(async (lead: Lead) => {
    const removing = savedLeadIds.has(lead.id)
    setActionNotice(null)

    try {
      if (removing) {
        const response = await fetch('/api/leads/save', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leadId: lead.id }),
        })
        if (!response.ok) {
          const payload = await response.json().catch(() => ({})) as { error?: string }
          throw new Error(payload.error || 'Could not remove this saved lead.')
        }

        setSavedLeadIds((previous) => {
          const next = new Set(previous)
          next.delete(lead.id)
          try { localStorage.setItem(SAVED_IDS_KEY, JSON.stringify([...next])) } catch { /* ignore */ }
          return next
        })
        try {
          const stored = JSON.parse(localStorage.getItem(SAVED_LEADS_KEY) ?? '[]') as Lead[]
          localStorage.setItem(SAVED_LEADS_KEY, JSON.stringify(stored.filter((item) => item.id !== lead.id)))
        } catch { /* ignore */ }
        return
      }

      const result = await saveReturnedLeads([{ ...lead, savedAt: new Date().toISOString() }])
      if (result.savedIds.includes(lead.id)) {
        setSavedLeadIds((previous) => new Set([...previous, lead.id]))
      }
      if (result.limitReached) {
        setActionNotice({
          tone: 'warning',
          message: 'Your saved-lead limit is full. Upgrade your plan to keep saving new leads.',
        })
      }
    } catch (error) {
      setActionNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not save this lead.',
      })
    }
  }, [savedLeadIds])

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

  const handleSelectAllVisible = useCallback((selected: boolean) => {
    setSelectedIds(selected ? new Set(leads.map((lead) => lead.id)) : new Set())
  }, [leads])

  const handleBulkSave = useCallback(async (scope: 'selected' | 'all') => {
    const entitlement = getLeadEntitlements(userPlan)
    if (!entitlement.canBulkSave) {
      setActionNotice({ tone: 'warning', message: 'Bulk saving is included with Pro and Agency. Free accounts can save leads one at a time.' })
      return
    }

    const candidates = (scope === 'selected'
      ? leads.filter((lead) => selectedIds.has(lead.id))
      : leads
    ).filter((lead) => !savedLeadIds.has(lead.id))

    if (candidates.length === 0) {
      setActionNotice({ tone: 'success', message: 'All of these leads are already saved.' })
      return
    }

    setActionNotice(null)
    try {
      const result = await saveReturnedLeads(candidates, setBulkSaveProgress)
      setSavedLeadIds((previous) => new Set([...previous, ...result.savedIds]))
      if (scope === 'selected') setSelectedIds(new Set())

      const detail = result.alreadySavedCount > 0 ? ` ${result.alreadySavedCount} were already in your list.` : ''
      setActionNotice({
        tone: result.limitReached || result.failedCount > 0 ? 'warning' : 'success',
        message: result.limitReached
          ? `Saved ${result.insertedCount} leads before reaching your plan limit.${detail}`
          : `Saved ${result.insertedCount} ${result.insertedCount === 1 ? 'lead' : 'leads'}.${detail}`,
      })
    } catch (error) {
      const message = error instanceof LeadBulkActionError && error.upgradeRequired
        ? 'Bulk saving is included with Pro and Agency.'
        : error instanceof Error ? error.message : 'Could not save these leads.'
      setActionNotice({ tone: 'error', message })
    } finally {
      setBulkSaveProgress(null)
    }
  }, [leads, savedLeadIds, selectedIds, userPlan])

  const handleExportCsv = useCallback(async (scope: 'selected' | 'all') => {
    const exportLeads = scope === 'selected'
      ? leads.filter((lead) => selectedIds.has(lead.id))
      : leads
    if (exportLeads.length === 0) return

    setExporting(true)
    setActionNotice(null)
    try {
      const result = await exportReturnedLeadsCsv(exportLeads, { filename: `leadzipp-${Date.now()}` })
      if (scope === 'selected') setSelectedIds(new Set())
      setActionNotice({
        tone: result.planCapped ? 'warning' : 'success',
        message: result.planCapped
          ? `Exported the first ${result.exportedCount} leads allowed on Free. Upgrade to export the full result set.`
          : `Exported ${result.exportedCount} ${result.exportedCount === 1 ? 'lead' : 'leads'} to CSV.`,
      })
    } catch (error) {
      setActionNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Could not export these leads.' })
    } finally {
      setExporting(false)
    }
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
  const leadEntitlements = getLeadEntitlements(userPlan)
  const allVisibleSelected = leads.length > 0 && leads.every((lead) => selectedIds.has(lead.id))
  const unsavedVisibleCount = leads.filter((lead) => !savedLeadIds.has(lead.id)).length

  return (
    <div className="mx-auto max-w-[1720px] space-y-5">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="readout text-signal">Lead workspace</p>
          <h1 className="mt-1 font-display text-2xl font-bold text-ink sm:text-3xl">Find your next customers</h1>
          <p className="mt-1 text-sm text-stone">Search a territory, review the best opportunities, then save or export the leads you want.</p>
        </div>
        <ol className="flex items-center gap-1 rounded-2xl border border-sand bg-card p-1 text-xs font-semibold text-stone shadow-card" aria-label="Lead workflow">
          {['Search', 'Select', 'Save or export'].map((step, index) => (
            <li
              key={step}
              className={cn(
                'flex items-center gap-1.5 rounded-xl px-2.5 py-2 sm:px-3',
                index === 0 && !hasSearched && 'bg-signal-50 text-signal-600',
                index === 1 && hasSearched && selectedCount === 0 && 'bg-signal-50 text-signal-600',
                index === 2 && selectedCount > 0 && 'bg-signal-50 text-signal-600'
              )}
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full border border-current font-mono text-[10px]">{index + 1}</span>
              <span className={cn(index === 2 && 'hidden sm:inline')}>{step}</span>
            </li>
          ))}
        </ol>
      </div>

      <SearchFilters
        onSearch={handleSearch}
        onBulkSearch={handleBulkSearch}
        isLoading={isLoading}
        initialValues={initialValues}
        searchMode={searchMode}
        onSearchModeChange={setSearchMode}
        maxBulkZips={maxBulkZips}
      />

      <section className="min-w-0 space-y-4" aria-label="Lead search results">

          {/* Results toolbar */}
          {(hasSearched || leads.length > 0) && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Count */}
              <p className="text-sm text-ink-soft">
                {isLoading ? (
                  searchMode === 'bulk' && bulkProgress ? (
                    <span className="inline-flex items-center gap-2 text-sm text-stone">
                      <Loader2 className="h-4 w-4 animate-spin shrink-0 text-signal" />
                      Searching {bulkProgress.total} ZIP{bulkProgress.total !== 1 ? 's' : ''}…{' '}
                      ({bulkProgress.done}/{bulkProgress.total} complete)
                    </span>
                  ) : (
                    <span className="inline-block h-4 w-32 animate-pulse rounded bg-sand" />
                  )
                ) : (
                  <>
                    <span className="font-semibold font-mono text-ink tabular-nums">{totalFound}</span>{' '}
                    {searchMode === 'bulk' && searchedZipCount > 1 ? (
                      <>
                        results across{' '}
                        <span className="font-semibold font-mono text-ink tabular-nums">
                          {searchedZipCount}
                        </span>{' '}
                        ZIP codes
                      </>
                    ) : locationLabel ? (
                      <>
                        {totalFound === 1 ? 'lead' : 'leads'} in{' '}
                        <span className="font-semibold text-ink">{locationLabel}</span>
                      </>
                    ) : (
                      <>{totalFound === 1 ? 'lead' : 'leads'} found</>
                    )}
                    {fetchedAt && (
                      <span className="ml-2 inline-flex items-center gap-1.5 rounded-full border border-sand bg-card px-2.5 py-1 align-middle font-mono text-xs text-ink-soft">
                        <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
                          {!fromCache && (
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-forest opacity-60" />
                          )}
                          <span className={cn('relative inline-flex h-1.5 w-1.5 rounded-full', fromCache ? 'bg-stone' : 'bg-forest')} />
                        </span>
                        {fromCache
                          ? `Cached from ${sourceLabel(dataSource)}`
                          : `Live from ${sourceLabel(dataSource)}`}
                        <span className="text-stone">· fetched {formatAge(fetchedAt)}</span>
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

              <div className="flex flex-wrap items-center justify-end gap-2">
                {leads.length > 0 && !isLoading && (
                  <button
                    onClick={() => handleSelectAllVisible(!allVisibleSelected)}
                    className="flex items-center gap-1.5 rounded-full border border-sand bg-card px-3 py-2 text-xs font-medium text-ink-soft shadow-card transition-colors hover:bg-paper-2"
                  >
                    <CheckSquare className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    {allVisibleSelected ? 'Clear selection' : 'Select all'}
                  </button>
                )}

                {leads.length > 0 && !isLoading && leadEntitlements.canBulkSave && (
                  <button
                    onClick={() => void handleBulkSave('all')}
                    disabled={bulkSaveProgress !== null || unsavedVisibleCount === 0}
                    className="flex items-center gap-1.5 rounded-full bg-ink px-3 py-2 text-xs font-semibold text-white shadow-card transition-colors hover:bg-ink-soft disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {bulkSaveProgress ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Bookmark className="h-3.5 w-3.5" aria-hidden="true" />}
                    {bulkSaveProgress
                      ? `Saving ${bulkSaveProgress.completed}/${bulkSaveProgress.total}`
                      : unsavedVisibleCount === 0 ? 'All saved' : `Save all ${unsavedVisibleCount}`}
                  </button>
                )}

                {leads.length > 0 && !isLoading && (
                  <button
                    onClick={() => void handleExportCsv('all')}
                    disabled={exporting}
                    className="flex items-center gap-1.5 rounded-full bg-signal px-3 py-2 text-xs font-semibold text-white shadow-card transition-colors hover:bg-signal-600 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Download className="h-3.5 w-3.5" aria-hidden="true" />}
                    {leadEntitlements.canExportAll ? 'Export all' : 'Export CSV'}
                  </button>
                )}

                {/* Save this search */}
                {leads.length > 0 && !isLoading && searchMode === 'single' && lastSearchParams && (
                  <button
                    onClick={() => setSaveModalOpen(true)}
                    className="flex items-center gap-1.5 rounded-full border border-sand bg-card px-3 py-2 text-xs font-medium text-ink-soft shadow-card transition-colors hover:bg-paper-2"
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
                        <div className="flex items-center gap-1.5 text-xs text-stone">
                          <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0 text-signal" />
                          Checking {healthCheckProgress.done} / {healthCheckProgress.total} websites…
                        </div>
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-sand">
                          <div
                            className="h-full rounded-full bg-signal transition-all duration-300"
                            style={{ width: `${Math.round((healthCheckProgress.done / healthCheckProgress.total) * 100)}%` }}
                          />
                        </div>
                        <button
                          onClick={() => { healthCheckAbortRef.current = true }}
                          className="text-xs text-stone hover:text-ink-soft"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={handleBatchHealthCheck}
                        className="flex items-center gap-1.5 rounded-full border border-sand bg-card px-3 py-2 text-xs font-medium text-ink-soft shadow-card transition-colors hover:bg-paper-2"
                      >
                        <Activity className="h-3.5 w-3.5 shrink-0 text-forest" />
                        Check websites
                      </button>
                    )}
                  </div>
                )}
                {/* Sort */}
                <div className="relative">
                  <button
                    onClick={() => setSortMenuOpen((o) => !o)}
                    className="flex items-center gap-1.5 rounded-full border border-sand bg-card px-3 py-2 text-xs font-medium text-ink-soft shadow-card transition-colors hover:bg-paper-2"
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
                        className="absolute right-0 top-full z-20 mt-1 w-48 rounded-xl border border-sand bg-card py-1 shadow-lg"
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
                              'w-full px-4 py-2 text-left text-sm transition-colors hover:bg-paper-2',
                              sortOption === key ? 'font-semibold text-signal' : 'text-ink-soft'
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
                <div className="flex rounded-full border border-sand bg-card p-0.5 shadow-card">
                  <button
                    onClick={() => setViewMode('card')}
                    aria-label="Card view"
                    aria-pressed={viewMode === 'card'}
                    className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-full transition-all',
                      viewMode === 'card'
                        ? 'bg-signal text-white shadow-sm'
                        : 'text-stone hover:text-ink-soft'
                    )}
                  >
                    <LayoutGrid className="h-3.5 w-3.5 shrink-0" />
                  </button>
                  <button
                    onClick={() => setViewMode('table')}
                    aria-label="Table view"
                    aria-pressed={viewMode === 'table'}
                    className={cn(
                      'hidden lg:flex h-7 w-7 items-center justify-center rounded-full transition-all',
                      viewMode === 'table'
                        ? 'bg-signal text-white shadow-sm'
                        : 'text-stone hover:text-ink-soft'
                    )}
                  >
                    <List className="h-3.5 w-3.5 shrink-0" />
                  </button>
                  <button
                    onClick={() => setViewMode('map')}
                    aria-label="Map view"
                    aria-pressed={viewMode === 'map'}
                    className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-full transition-all',
                      viewMode === 'map'
                        ? 'bg-signal text-white shadow-sm'
                        : 'text-stone hover:text-ink-soft'
                    )}
                  >
                    <MapIcon className="h-3.5 w-3.5 shrink-0" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {actionNotice && (
            <div
              role="status"
              aria-live="polite"
              className={cn(
                'flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm',
                actionNotice.tone === 'success' && 'border-emerald-200 bg-emerald-50 text-emerald-800',
                actionNotice.tone === 'warning' && 'border-amber-200 bg-amber-50 text-amber-800',
                actionNotice.tone === 'error' && 'border-red-200 bg-red-50 text-red-700'
              )}
            >
              <span>
                {actionNotice.message}{' '}
                {actionNotice.tone === 'warning' && userPlan === 'free' && (
                  <a href="/pricing" className="font-semibold underline underline-offset-2">View paid plans</a>
                )}
              </span>
              <button onClick={() => setActionNotice(null)} aria-label="Dismiss message" className="shrink-0 rounded-lg p-1 hover:bg-black/5">
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          )}

          {/* Data source banner */}
          {!isLoading && leads.length > 0 && !sourceBannerDismissed && dataSource && dataSource !== 'google_places' && dataSource !== 'foursquare' && (
            <div className={cn(
              'flex items-center justify-between gap-3 rounded-lg border px-4 py-2.5 text-sm',
              dataSource === 'demo'
                ? 'border-amber-200 bg-amber-50 text-amber-800'
                : 'border-sand bg-paper-2 text-ink-soft'
            )}>
              <span>
                {dataSource === 'demo' ? (
                  <>
                    <span className="font-semibold">Demo data:</span> these are sample businesses, not real leads.{' '}
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          )}

          {isLoading && viewMode === 'table' && (
            <div className="space-y-2 rounded-2xl border border-sand bg-card p-4 shadow-card">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex gap-4">
                  <div className="h-4 w-4 animate-pulse rounded bg-sand" />
                  <div className="h-4 flex-1 animate-pulse rounded bg-sand" />
                  <div className="h-4 w-24 animate-pulse rounded bg-paper-2" />
                  <div className="h-4 w-20 animate-pulse rounded bg-paper-2" />
                  <div className="h-4 w-16 animate-pulse rounded bg-paper-2" />
                </div>
              ))}
            </div>
          )}

          {isLoading && viewMode === 'map' && (
            <div className="h-96 animate-pulse rounded-2xl bg-sand" />
          )}

          {/* Results */}
          {!isLoading && leads.length > 0 && viewMode === 'card' && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
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
              selectedIds={selectedIds}
              onSelect={handleSelect}
              onSelectAll={handleSelectAllVisible}
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
      </section>

      {/* Floating bulk action bar */}
      {selectedCount > 0 && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-x-3 bottom-3 z-50 sm:inset-x-auto sm:bottom-6 sm:left-1/2 sm:-translate-x-1/2"
        >
          <div className="flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-sand bg-card px-3 py-3 shadow-xl sm:flex-nowrap sm:gap-3 sm:px-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              <CheckSquare className="h-4 w-4 text-signal shrink-0" />
              {selectedCount} {selectedCount === 1 ? 'lead' : 'leads'} selected
            </div>
            <div className="hidden h-4 w-px bg-sand sm:block" />
            {leadEntitlements.canBulkSave && (
              <button
                className="flex items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-ink-soft disabled:opacity-50"
                onClick={() => void handleBulkSave('selected')}
                disabled={bulkSaveProgress !== null}
              >
                {bulkSaveProgress ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bookmark className="h-3.5 w-3.5 shrink-0" />}
                Save selected
              </button>
            )}
            <button
              className="flex items-center gap-1.5 rounded-full bg-signal px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-signal-600"
              onClick={() => void handleExportCsv('selected')}
              disabled={exporting}
            >
              {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5 shrink-0" />}
              Export CSV
            </button>
            {leadEntitlements.canExportAll && (
              <>
                <button
                  className="hidden items-center gap-1.5 rounded-full bg-forest px-3 py-1.5 text-xs font-semibold text-lime transition-colors hover:bg-forest-700 md:flex"
                  onClick={handleExportHubSpot}
                >
                  HubSpot
                </button>
                <button
                  className="hidden items-center gap-1.5 rounded-full border border-sand bg-card px-3 py-1.5 text-xs font-semibold text-ink-soft transition-colors hover:bg-paper-2 md:flex"
                  onClick={handleExportSalesforce}
                >
                  Salesforce
                </button>
              </>
            )}
            <button
              onClick={() => setSelectedIds(new Set())}
              aria-label="Clear selection"
              className="flex h-7 w-7 items-center justify-center rounded-full text-stone transition-colors hover:bg-paper-2 hover:text-ink"
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
          defaultName={`${lastSearchParams.category || 'Leads'} · ${lastSearchParams.location || lastSearchParams.zipCode}`}
          zip={lastSearchParams.location || lastSearchParams.zipCode}
          radius={
            lastSearchParams.radiusKm != null
              ? Math.max(1, Math.round(lastSearchParams.radiusKm * 0.621371))
              : lastSearchParams.radiusMiles ?? 25
          }
          category={lastSearchParams.category ?? ''}
          keyword={lastSearchParams.keyword}
          /* Worldwide only (both undefined on the US ZIP path). The country stops
             a saved "Cambridge" re-geocoding to Massachusetts on the nightly alert
             run, and the km radius avoids the lossy miles round-trip that re-keys
             1 km and 25 km off the shared cache pool. */
          countryCode={lastSearchParams.countryCode}
          radiusKm={lastSearchParams.radiusKm}
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
