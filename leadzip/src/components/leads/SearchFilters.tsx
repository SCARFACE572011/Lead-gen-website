'use client'

import { useState } from 'react'
import { Search, Loader2, SlidersHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SearchParams, LEAD_CATEGORIES } from '@/types/lead'

interface SearchFiltersProps {
  onSearch: (params: SearchParams) => void
  isLoading: boolean
}

const RADIUS_OPTIONS = [
  { value: 5, label: '5 miles' },
  { value: 10, label: '10 miles' },
  { value: 25, label: '25 miles' },
  { value: 50, label: '50 miles' },
  { value: 100, label: '100 miles' },
]

const MIN_RATING_OPTIONS = [
  { value: 0, label: 'Any Rating' },
  { value: 3.0, label: '3.0+' },
  { value: 3.5, label: '3.5+' },
  { value: 4.0, label: '4.0+' },
  { value: 4.5, label: '4.5+' },
]

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all'

const selectClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all appearance-none cursor-pointer'

const labelClass = 'block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5'

interface ToggleProps {
  checked: boolean
  onChange: (val: boolean) => void
  label: string
}

function Toggle({ checked, onChange, label }: ToggleProps) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 select-none">
      <span className="text-sm text-slate-700">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
          checked ? 'bg-blue-600' : 'bg-slate-200'
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

export function SearchFilters({ onSearch, isLoading }: SearchFiltersProps) {
  const [zipCode, setZipCode] = useState('')
  const [city, setCity] = useState('')
  const [radiusMiles, setRadiusMiles] = useState(25)
  const [category, setCategory] = useState('')
  const [keyword, setKeyword] = useState('')
  const [minRating, setMinRating] = useState(0)
  const [hasWebsite, setHasWebsite] = useState(false)
  const [hasPhone, setHasPhone] = useState(false)
  const [excludeSaved, setExcludeSaved] = useState(false)
  const [zipError, setZipError] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!zipCode.trim()) {
      setZipError('ZIP code is required')
      return
    }
    if (!/^\d{5}(-\d{4})?$/.test(zipCode.trim())) {
      setZipError('Enter a valid 5-digit ZIP code')
      return
    }

    setZipError('')

    const params: SearchParams = {
      zipCode: zipCode.trim(),
      city: city.trim() || undefined,
      radiusMiles,
      category,
      keyword: keyword.trim() || undefined,
      minRating: minRating > 0 ? minRating : undefined,
      hasWebsite: hasWebsite || undefined,
      hasPhone: hasPhone || undefined,
      excludeSaved: excludeSaved || undefined,
    }

    onSearch(params)
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
          <SlidersHorizontal className="h-4 w-4 text-blue-600 shrink-0" />
          <span className="text-sm font-semibold text-slate-800">Search Filters</span>
        </div>

        <div className="p-4 space-y-5">
          {/* ZIP Code */}
          <div>
            <label htmlFor="zipCode" className={labelClass}>
              ZIP Code <span className="text-red-500">*</span>
            </label>
            <input
              id="zipCode"
              type="text"
              inputMode="numeric"
              value={zipCode}
              onChange={(e) => {
                setZipCode(e.target.value)
                if (zipError) setZipError('')
              }}
              placeholder="e.g. 90210"
              maxLength={10}
              aria-required="true"
              aria-invalid={!!zipError}
              aria-describedby={zipError ? 'zip-error' : undefined}
              className={cn(inputClass, zipError && 'border-red-400 ring-2 ring-red-400/20')}
            />
            {zipError && (
              <p id="zip-error" role="alert" className="mt-1 text-xs text-red-600">
                {zipError}
              </p>
            )}
          </div>

          {/* City / State */}
          <div>
            <label htmlFor="city" className={labelClass}>
              City / State <span className="text-slate-400 font-normal normal-case">(optional)</span>
            </label>
            <input
              id="city"
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. Los Angeles, CA"
              className={inputClass}
            />
          </div>

          {/* Radius */}
          <div>
            <label htmlFor="radius" className={labelClass}>
              Search Radius
            </label>
            <div className="relative">
              <select
                id="radius"
                value={radiusMiles}
                onChange={(e) => setRadiusMiles(Number(e.target.value))}
                className={selectClass}
              >
                {RADIUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          {/* Category */}
          <div>
            <label htmlFor="category" className={labelClass}>
              Category
            </label>
            <div className="relative">
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className={selectClass}
              >
                <option value="">All Categories</option>
                {LEAD_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          {/* Keyword */}
          <div>
            <label htmlFor="keyword" className={labelClass}>
              Keyword <span className="text-slate-400 font-normal normal-case">(optional)</span>
            </label>
            <input
              id="keyword"
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="e.g. pizza, roofing..."
              className={inputClass}
            />
          </div>

          {/* Min Rating */}
          <div>
            <label htmlFor="minRating" className={labelClass}>
              Min. Rating
            </label>
            <div className="relative">
              <select
                id="minRating"
                value={minRating}
                onChange={(e) => setMinRating(Number(e.target.value))}
                className={selectClass}
              >
                {MIN_RATING_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-slate-100" />

          {/* Toggles */}
          <div className="space-y-3">
            <p className={labelClass}>Filters</p>
            <Toggle checked={hasWebsite} onChange={setHasWebsite} label="Has Website" />
            <Toggle checked={hasPhone} onChange={setHasPhone} label="Has Phone" />
            <Toggle checked={excludeSaved} onChange={setExcludeSaved} label="Exclude Saved" />
          </div>
        </div>

        {/* Submit */}
        <div className="border-t border-slate-100 px-4 py-4">
          <button
            type="submit"
            disabled={isLoading}
            className={cn(
              'flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-all duration-200',
              'bg-blue-600 hover:bg-blue-700 active:bg-blue-800',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
              'disabled:cursor-not-allowed disabled:opacity-60'
            )}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                Searching...
              </>
            ) : (
              <>
                <Search className="h-4 w-4 shrink-0" />
                Search Leads
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  )
}
