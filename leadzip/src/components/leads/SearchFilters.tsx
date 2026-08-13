'use client'

import { useEffect, useRef, useState } from 'react'
import { Search, Loader2, SlidersHorizontal, X, Zap, ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SearchParams, LEAD_CATEGORIES } from '@/types/lead'
import { COUNTRIES, POPULAR_COUNTRIES, matchesCountry, countryName } from '@/lib/countries'

interface SearchFiltersProps {
  onSearch: (params: SearchParams) => void
  onBulkSearch?: (baseParams: Omit<SearchParams, 'zipCode'>, zips: string[]) => void
  isLoading: boolean
  initialValues?: Partial<SearchParams>
  searchMode: 'single' | 'bulk'
  onSearchModeChange: (mode: 'single' | 'bulk') => void
  maxBulkZips: number
}

const RADIUS_OPTIONS = [
  { value: 5, label: '5 miles' },
  { value: 10, label: '10 miles' },
  { value: 25, label: '25 miles' },
  { value: 50, label: '50 miles' },
  { value: 100, label: '100 miles' },
]

// International (km) radius options. 50 km is the Places API bias cap.
const RADIUS_KM_OPTIONS = [
  { value: 1, label: '1 km' },
  { value: 5, label: '5 km' },
  { value: 10, label: '10 km' },
  { value: 25, label: '25 km' },
  { value: 50, label: '50 km' },
]

const COUNTRY_STORAGE_KEY = 'leadzip_country'

const MIN_RATING_OPTIONS = [
  { value: 0, label: 'Any Rating' },
  { value: 3.0, label: '3.0+' },
  { value: 3.5, label: '3.5+' },
  { value: 4.0, label: '4.0+' },
  { value: 4.5, label: '4.5+' },
]

const MIN_REVIEWS_OPTIONS = [
  { value: 0, label: 'Any' },
  { value: 5, label: '5+' },
  { value: 10, label: '10+' },
  { value: 25, label: '25+' },
  { value: 50, label: '50+' },
  { value: 100, label: '100+' },
]

type WebsiteFilter = 'any' | 'has' | 'none'

interface Preset {
  id: string
  label: string
  description: string
  apply: () => Partial<FilterState>
}

interface FilterState {
  minRating: number
  minReviews: number
  websiteFilter: WebsiteFilter
  hasPhone: boolean
  excludeSaved: boolean
}

const PRESETS: Preset[] = [
  {
    id: 'no_website',
    label: 'No Website',
    description: 'Businesses with no online presence — ideal for web design agencies',
    apply: () => ({ websiteFilter: 'none' as WebsiteFilter, minRating: 0, minReviews: 0 }),
  },
  {
    id: 'needs_seo',
    label: 'Needs SEO',
    description: 'Has a website but needs search help — solid SEO agency targets',
    apply: () => ({ websiteFilter: 'has' as WebsiteFilter, minRating: 3.5, minReviews: 0 }),
  },
  {
    id: 'established',
    label: 'Established',
    description: 'Proven businesses with strong reviews — higher budgets',
    apply: () => ({ minRating: 4.0, minReviews: 25, websiteFilter: 'any' as WebsiteFilter }),
  },
  {
    id: 'high_volume',
    label: 'High Volume',
    description: 'Lots of reviews — busy, active businesses',
    apply: () => ({ minReviews: 50, minRating: 0, websiteFilter: 'any' as WebsiteFilter }),
  },
  {
    id: 'high_rated',
    label: 'Top Rated',
    description: '4.5+ stars — best-in-class local businesses',
    apply: () => ({ minRating: 4.5, minReviews: 0, websiteFilter: 'any' as WebsiteFilter }),
  },
]

const inputClass =
  'w-full rounded-xl border border-sand bg-card px-3 py-2 text-sm text-ink placeholder:text-stone focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/20 transition-all'

const selectClass =
  'w-full rounded-xl border border-sand bg-card px-3 py-2 text-sm text-ink focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/20 transition-all appearance-none cursor-pointer'

const labelClass = 'block readout text-stone mb-1.5'

interface ToggleProps {
  checked: boolean
  onChange: (val: boolean) => void
  label: string
}

function Toggle({ checked, onChange, label }: ToggleProps) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 select-none">
      <span className="text-sm text-ink-soft">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-signal',
          checked ? 'bg-signal' : 'bg-sand'
        )}
      >
        <span
          className={cn(
            'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200',
            checked ? 'translate-x-4' : 'translate-x-0'
          )}
        />
      </button>
    </label>
  )
}

// Compact searchable country dropdown. Popular markets pinned on top, then the
// full ISO list. Selection biases geocoding and persists in localStorage.
function CountrySelect({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const wrapRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    searchRef.current?.focus()
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  const q = query.trim()
  const popular = POPULAR_COUNTRIES.filter((c) => matchesCountry(c, q))
  const popularCodes = new Set(POPULAR_COUNTRIES.map((c) => c.code))
  const rest = COUNTRIES.filter((c) => !popularCodes.has(c.code) && matchesCountry(c, q))

  function select(code: string) {
    onChange(code)
    setOpen(false)
    setQuery('')
  }

  const optionClass = (code: string) =>
    cn(
      'flex w-full items-center justify-between px-3 py-1.5 text-left text-sm transition-colors hover:bg-paper-2',
      code === value ? 'font-semibold text-signal' : 'text-ink-soft'
    )

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Country: ${countryName(value)}`}
        title={countryName(value)}
        className="flex h-full items-center gap-1 rounded-xl border border-sand bg-card px-2.5 py-2 text-sm font-mono font-medium text-ink hover:bg-paper-2 focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/20 transition-all"
      >
        {value}
        <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 text-stone transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Country"
          className="absolute right-0 top-full z-30 mt-1 w-64 rounded-xl border border-sand bg-card shadow-lg"
        >
          <div className="border-b border-sand p-2">
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search countries"
              className="w-full rounded-lg border border-sand bg-card px-2.5 py-1.5 text-sm text-ink placeholder:text-stone focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/20"
            />
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {popular.length > 0 && (
              <>
                <p className="px-3 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-stone">
                  Popular
                </p>
                {popular.map((c) => (
                  <button key={`p_${c.code}`} type="button" role="option" aria-selected={c.code === value} onClick={() => select(c.code)} className={optionClass(c.code)}>
                    <span className="truncate">{c.name}</span>
                    {c.code === value && <Check className="h-3.5 w-3.5 shrink-0" />}
                  </button>
                ))}
              </>
            )}
            {rest.length > 0 && (
              <>
                <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-stone">
                  All countries
                </p>
                {rest.map((c) => (
                  <button key={c.code} type="button" role="option" aria-selected={c.code === value} onClick={() => select(c.code)} className={optionClass(c.code)}>
                    <span className="truncate">{c.name}</span>
                    {c.code === value && <Check className="h-3.5 w-3.5 shrink-0" />}
                  </button>
                ))}
              </>
            )}
            {popular.length === 0 && rest.length === 0 && (
              <p className="px-3 py-2 text-sm text-stone">No countries match</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function SearchFilters({
  onSearch,
  onBulkSearch,
  isLoading,
  initialValues,
  searchMode,
  onSearchModeChange,
  maxBulkZips,
}: SearchFiltersProps) {
  const [locationInput, setLocationInput] = useState(
    initialValues?.location ?? initialValues?.zipCode ?? ''
  )
  const [locationError, setLocationError] = useState('')
  const [country, setCountry] = useState((initialValues?.countryCode ?? 'US').toUpperCase())
  const [bulkZips, setBulkZips] = useState<string[]>([])
  const [bulkInput, setBulkInput] = useState('')
  const [bulkZipError, setBulkZipError] = useState('')

  const [radiusMiles, setRadiusMiles] = useState(initialValues?.radiusMiles ?? 25)
  const [radiusKm, setRadiusKm] = useState(initialValues?.radiusKm ?? 10)
  const [category, setCategory] = useState(initialValues?.category ?? '')
  const [keyword, setKeyword] = useState(initialValues?.keyword ?? '')
  const [minRating, setMinRating] = useState(initialValues?.minRating ?? 0)
  const [minReviews, setMinReviews] = useState(0)
  const [websiteFilter, setWebsiteFilter] = useState<WebsiteFilter>('any')
  const [hasPhone, setHasPhone] = useState(false)
  const [excludeSaved, setExcludeSaved] = useState(false)
  const [activePreset, setActivePreset] = useState<string | null>(null)
  const [advancedOpen, setAdvancedOpen] = useState(false)

  // Restore the last-used country (defaults to US). Read in an effect so the
  // server-rendered markup stays hydration-safe.
  useEffect(() => {
    if (initialValues?.countryCode) return
    try {
      const stored = localStorage.getItem(COUNTRY_STORAGE_KEY)
      if (stored && /^[A-Z]{2}$/.test(stored)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCountry(stored)
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleCountryChange(code: string) {
    setCountry(code)
    try { localStorage.setItem(COUNTRY_STORAGE_KEY, code) } catch { /* ignore */ }
  }

  // ZIP mode: country is US and the input is empty or digits (a ZIP being
  // typed). Any text, or any non-US country, switches to worldwide mode with a
  // km radius. "10117" with Germany selected is a Berlin postal code, not a ZIP.
  const trimmedLocation = locationInput.trim()
  const zipStyle = country === 'US' && /^[\d-]*$/.test(trimmedLocation)

  function applyPreset(preset: Preset) {
    if (activePreset === preset.id) {
      // Deselect
      setActivePreset(null)
      setMinRating(0)
      setMinReviews(0)
      setWebsiteFilter('any')
      return
    }
    setActivePreset(preset.id)
    const state = preset.apply()
    if (state.minRating !== undefined) setMinRating(state.minRating)
    if (state.minReviews !== undefined) setMinReviews(state.minReviews)
    if (state.websiteFilter !== undefined) setWebsiteFilter(state.websiteFilter)
  }

  function buildFilterParams(): Partial<SearchParams> {
    return {
      minRating: minRating > 0 ? minRating : undefined,
      minReviews: minReviews > 0 ? minReviews : undefined,
      hasWebsite: websiteFilter === 'has' ? true : undefined,
      noWebsite: websiteFilter === 'none' ? true : undefined,
      hasPhone: hasPhone || undefined,
      excludeSaved: excludeSaved || undefined,
    }
  }

  function addBulkZip() {
    const zip = bulkInput.trim()
    if (!zip) return
    if (!/^\d{5}$/.test(zip)) { setBulkZipError('Enter a valid 5-digit ZIP code'); return }
    if (bulkZips.includes(zip)) { setBulkZipError('ZIP already added'); return }
    if (bulkZips.length >= maxBulkZips) { setBulkZipError(`Your plan allows up to ${maxBulkZips} ZIPs`); return }
    setBulkZips((prev) => [...prev, zip])
    setBulkInput('')
    setBulkZipError('')
  }

  function removeBulkZip(zip: string) {
    setBulkZips((prev) => prev.filter((z) => z !== zip))
  }

  function handleBulkKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addBulkZip() }
    else if (e.key === 'Backspace' && bulkInput === '' && bulkZips.length > 0) removeBulkZip(bulkZips[bulkZips.length - 1])
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const filters = buildFilterParams()

    if (searchMode === 'bulk') {
      if (bulkZips.length === 0) { setBulkZipError('Add at least one ZIP code'); return }
      onBulkSearch?.({ radiusMiles, category, keyword: keyword.trim() || undefined, ...filters }, bulkZips)
      return
    }

    const input = trimmedLocation
    if (!input) { setLocationError('Enter a ZIP code or a city'); return }

    // US ZIP fast path — identical params to the original ZIP-only search
    if (country === 'US' && /^\d{5}(-\d{4})?$/.test(input)) {
      setLocationError('')
      onSearch({ zipCode: input, radiusMiles, category, keyword: keyword.trim() || undefined, ...filters })
      return
    }

    if (country === 'US' && /^[\d-]+$/.test(input)) {
      setLocationError('Enter a valid 5-digit ZIP code, or a city like London, UK')
      return
    }
    if (input.length < 2) { setLocationError('Enter a location, like Berlin, Germany'); return }

    setLocationError('')
    onSearch({
      zipCode: '',
      location: input,
      countryCode: country,
      radiusKm,
      radiusMiles: Math.round(radiusKm * 0.621371 * 100) / 100,
      category,
      keyword: keyword.trim() || undefined,
      ...filters,
    })
  }

  const advancedFilterCount = [
    keyword.trim().length > 0,
    minRating > 0,
    minReviews > 0,
    websiteFilter !== 'any',
    hasPhone,
    excludeSaved,
  ].filter(Boolean).length

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="overflow-visible rounded-3xl border border-sand bg-card shadow-card">
        <div className="flex flex-wrap items-center gap-3 border-b border-sand px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-signal-50 text-signal">
              <Search className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <p className="font-display text-sm font-bold text-ink">Build a lead search</p>
              <p className="hidden text-xs text-stone sm:block">Choose a territory, then narrow the opportunity</p>
            </div>
          </div>

          <div className="ml-auto flex items-center rounded-xl border border-sand bg-paper-2 p-1" aria-label="Search mode">
            <button
              type="button"
              onClick={() => onSearchModeChange('single')}
              aria-pressed={searchMode === 'single'}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-semibold transition-all',
                searchMode === 'single' ? 'bg-card text-ink shadow-sm' : 'text-stone hover:text-ink'
              )}
            >
              One territory
            </button>
            <button
              type="button"
              onClick={() => onSearchModeChange('bulk')}
              aria-pressed={searchMode === 'bulk'}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-semibold transition-all',
                searchMode === 'bulk' ? 'bg-card text-ink shadow-sm' : 'text-stone hover:text-ink'
              )}
            >
              Multiple ZIPs
            </button>
          </div>
        </div>

        <div className="space-y-4 p-4 sm:p-5">
          <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-2 xl:grid-cols-12">
            {searchMode === 'single' ? (
              <div className="md:col-span-2 xl:col-span-4">
                <label htmlFor="locationInput" className={labelClass}>
                  Territory <span className="text-signal">*</span>
                </label>
                <div className="flex gap-1.5">
                  <input
                    id="locationInput"
                    type="text"
                    value={locationInput}
                    onChange={(e) => { setLocationInput(e.target.value); if (locationError) setLocationError('') }}
                    placeholder={country === 'US' ? 'City or ZIP, e.g. Austin or 78701' : `City in ${countryName(country)}`}
                    maxLength={80}
                    className={cn(inputClass, 'min-w-0 flex-1 py-2.5', zipStyle && 'font-mono tracking-wider', locationError && 'border-red-400 ring-2 ring-red-400/20')}
                  />
                  <CountrySelect value={country} onChange={handleCountryChange} />
                </div>
                {locationError && <p role="alert" className="mt-1 text-xs text-red-600">{locationError}</p>}
              </div>
            ) : (
              <div className="md:col-span-2 xl:col-span-4">
                <label htmlFor="bulkZipInput" className={labelClass}>
                  ZIP territories <span className="text-signal">*</span>
                </label>
                <div
                  className={cn(
                    'flex min-h-[42px] cursor-text flex-wrap items-center gap-1.5 rounded-xl border bg-card px-2 py-1.5 focus-within:border-signal focus-within:ring-2 focus-within:ring-signal/20',
                    bulkZipError ? 'border-red-400' : 'border-sand'
                  )}
                  onClick={() => (document.getElementById('bulkZipInput') as HTMLInputElement)?.focus()}
                >
                  {bulkZips.map((zip) => (
                    <span key={zip} className="inline-flex items-center gap-1 rounded-full bg-signal-50 px-2 py-0.5 font-mono text-xs font-medium text-signal-600">
                      {zip}
                      <button type="button" onClick={() => removeBulkZip(zip)} aria-label={`Remove ZIP ${zip}`}>
                        <X className="h-3 w-3" aria-hidden="true" />
                      </button>
                    </span>
                  ))}
                  <input
                    id="bulkZipInput"
                    type="text"
                    inputMode="numeric"
                    value={bulkInput}
                    onChange={(e) => { setBulkInput(e.target.value.replace(/[^\d]/g, '').slice(0, 5)); if (bulkZipError) setBulkZipError('') }}
                    onKeyDown={handleBulkKeyDown}
                    onBlur={() => { if (bulkInput.length === 5) addBulkZip() }}
                    placeholder={bulkZips.length === 0 ? 'Type ZIP, press Enter' : ''}
                    className="min-w-[140px] flex-1 border-none bg-transparent text-sm font-mono text-ink outline-none placeholder:font-sans placeholder:text-stone"
                  />
                  <span className="ml-auto shrink-0 px-1 font-mono text-[10px] text-stone">{bulkZips.length}/{maxBulkZips}</span>
                </div>
                {bulkZipError && <p role="alert" className="mt-1 text-xs text-red-600">{bulkZipError}</p>}
              </div>
            )}

            <div className="xl:col-span-3">
              <label htmlFor="category" className={labelClass}>Business type</label>
              <div className="relative">
                <select id="category" value={category} onChange={(e) => setCategory(e.target.value)} className={cn(selectClass, 'py-2.5')}>
                  <option value="">All business types</option>
                  {LEAD_CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                </select>
                <ChevronIcon />
              </div>
            </div>

            <div className="xl:col-span-2">
              <label htmlFor="radius" className={labelClass}>Radius</label>
              <div className="relative">
                {zipStyle || searchMode === 'bulk' ? (
                  <select id="radius" value={radiusMiles} onChange={(e) => setRadiusMiles(Number(e.target.value))} className={cn(selectClass, 'py-2.5')}>
                    {RADIUS_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                ) : (
                  <select id="radius" value={radiusKm} onChange={(e) => setRadiusKm(Number(e.target.value))} className={cn(selectClass, 'py-2.5')}>
                    {RADIUS_KM_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                )}
                <ChevronIcon />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="flex min-h-[42px] items-center justify-center gap-2 rounded-xl bg-signal px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-signal-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 md:col-span-2 xl:col-span-3"
            >
              {isLoading ? (
                <><Loader2 className="h-4 w-4 shrink-0 animate-spin" />Searching…</>
              ) : (
                <><Search className="h-4 w-4 shrink-0" />{searchMode === 'bulk' ? `Search ${bulkZips.length || ''} ZIP${bulkZips.length === 1 ? '' : 's'}` : 'Find leads'}</>
              )}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-sand pt-4">
            <span className="mr-1 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-stone">
              <Zap className="h-3 w-3 text-signal" aria-hidden="true" />
              Opportunity presets
            </span>
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                title={preset.description}
                aria-pressed={activePreset === preset.id}
                onClick={() => applyPreset(preset)}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                  activePreset === preset.id
                    ? 'border-signal bg-signal text-white'
                    : 'border-sand bg-card text-ink-soft hover:border-signal hover:text-signal'
                )}
              >
                {preset.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setAdvancedOpen((open) => !open)}
              aria-expanded={advancedOpen}
              aria-controls="advanced-lead-filters"
              className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-sand bg-paper-2 px-3 py-1.5 text-xs font-semibold text-ink-soft transition-colors hover:border-signal hover:text-signal"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
              More filters
              {advancedFilterCount > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-signal px-1 font-mono text-[10px] text-white">{advancedFilterCount}</span>
              )}
              <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', advancedOpen && 'rotate-180')} aria-hidden="true" />
            </button>
          </div>

          {advancedOpen && (
            <div id="advanced-lead-filters" className="grid grid-cols-1 gap-4 rounded-2xl border border-sand bg-paper-2 p-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label htmlFor="keyword" className={labelClass}>Keyword <span className="font-normal normal-case text-stone">(optional)</span></label>
                <input id="keyword" type="text" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="e.g. pizza, roofing" className={inputClass} />
              </div>
              <div>
                <label htmlFor="minRating" className={labelClass}>Minimum rating</label>
                <div className="relative">
                  <select id="minRating" value={minRating} onChange={(e) => { setMinRating(Number(e.target.value)); setActivePreset(null) }} className={selectClass}>
                    {MIN_RATING_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                  <ChevronIcon />
                </div>
              </div>
              <div>
                <label htmlFor="minReviews" className={labelClass}>Minimum reviews</label>
                <div className="relative">
                  <select id="minReviews" value={minReviews} onChange={(e) => { setMinReviews(Number(e.target.value)); setActivePreset(null) }} className={selectClass}>
                    {MIN_REVIEWS_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                  <ChevronIcon />
                </div>
              </div>
              <div>
                <p className={labelClass}>Website</p>
                <div className="flex overflow-hidden rounded-xl border border-sand bg-card text-xs font-medium">
                  {(['any', 'has', 'none'] as WebsiteFilter[]).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => { setWebsiteFilter(opt); setActivePreset(null) }}
                      className={cn(
                        'flex-1 px-2 py-2 transition-colors',
                        websiteFilter === opt ? 'bg-signal text-white' : 'text-stone hover:bg-paper'
                      )}
                    >
                      {opt === 'any' ? 'Any' : opt === 'has' ? 'Has one' : 'No site'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-3 sm:col-span-2 lg:col-span-4 lg:flex lg:items-center lg:gap-8 lg:space-y-0">
                <Toggle checked={hasPhone} onChange={setHasPhone} label="Only leads with a phone" />
                <Toggle checked={excludeSaved} onChange={setExcludeSaved} label="Hide leads already saved" />
              </div>
            </div>
          )}
        </div>
      </div>
    </form>
  )
}

function ChevronIcon() {
  return (
    <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
      <svg className="h-4 w-4 text-stone" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  )
}
