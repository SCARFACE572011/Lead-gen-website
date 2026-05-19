# B1 — Multi-ZIP Bulk Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Bulk Search mode to the /search page that lets users enter multiple ZIP codes as chips, fires parallel searches per ZIP, merges and deduplicates results, and shows each lead's source ZIP as a badge.

**Architecture:** Client-side fan-out using `Promise.all` — the search page fires one `/api/leads/search` call per ZIP in parallel, then merges and deduplicates results client-side. No new API routes. No schema changes. All existing filtering, sorting, save, and export flows are unchanged.

**Tech Stack:** React, Next.js 16 App Router, TypeScript, Tailwind CSS 4, Supabase JS client (`@/lib/supabase/client`) for reading user plan.

---

## File Map

| File | Change |
|------|--------|
| `src/types/lead.ts` | Add `sourceZip?: string` to `Lead` interface |
| `src/components/leads/LeadCard.tsx` | Render ZIP badge below category when `lead.sourceZip` is set |
| `src/components/leads/LeadTable.tsx` | Add ZIP column (shown only when any lead has `sourceZip`) |
| `src/components/leads/SearchFilters.tsx` | Add mode toggle, chip ZIP input for bulk mode, `onBulkSearch` callback |
| `src/app/(dashboard)/search/page.tsx` | Add mode state, plan fetch, bulk fan-out handler, progress UI, summary bar |

---

## Task 1: Add `sourceZip` to Lead type

**Files:**
- Modify: `src/types/lead.ts`

- [ ] **Step 1: Add field to Lead interface**

In `src/types/lead.ts`, add `sourceZip?: string` after `linkedinUrl`:

```typescript
export interface Lead {
  id: string
  businessName: string
  category: string
  address: string
  city: string
  state: string
  zipCode: string
  phone: string
  website: string
  rating: number | null
  reviewCount: number | null
  latitude: number | null
  longitude: number | null
  distanceMiles: number | null
  leadScore: number
  status: LeadStatus
  notes: string
  savedAt?: string
  createdAt?: string
  userId?: string
  employeeCount?: number | null
  revenueEstimate?: string | null
  facebookUrl?: string | null
  instagramUrl?: string | null
  linkedinUrl?: string | null
  sourceZip?: string
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "/Users/ramifakhuri/Projects/Lead gen. website /leadzip" && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors (or only pre-existing errors unrelated to `sourceZip`).

- [ ] **Step 3: Commit**

```bash
cd "/Users/ramifakhuri/Projects/Lead gen. website /leadzip" && git add src/types/lead.ts && git commit -m "feat(types): add sourceZip field to Lead for bulk search"
```

---

## Task 2: ZIP badge on LeadCard

**Files:**
- Modify: `src/components/leads/LeadCard.tsx`

- [ ] **Step 1: Add ZIP badge next to category badge**

In `src/components/leads/LeadCard.tsx`, find the category badge block (around line 106) and replace:

```tsx
          <span className="mt-0.5 inline-block rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
            {lead.category}
          </span>
```

With:

```tsx
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            <span className="inline-block rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
              {lead.category}
            </span>
            {lead.sourceZip && (
              <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                {lead.sourceZip}
              </span>
            )}
          </div>
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "/Users/ramifakhuri/Projects/Lead gen. website /leadzip" && npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
cd "/Users/ramifakhuri/Projects/Lead gen. website /leadzip" && git add src/components/leads/LeadCard.tsx && git commit -m "feat(ui): show sourceZip badge on LeadCard for bulk search results"
```

---

## Task 3: ZIP column on LeadTable

**Files:**
- Modify: `src/components/leads/LeadTable.tsx`

- [ ] **Step 1: Derive `showZipColumn` from leads array**

In `src/components/leads/LeadTable.tsx`, add this line inside `LeadTable` after the `sorted` declaration (around line 73):

```typescript
  const showZipColumn = leads.some((l) => Boolean(l.sourceZip))
```

- [ ] **Step 2: Add ZIP column header**

After the Location `<th>` (around line 113), add:

```tsx
            {showZipColumn && (
              <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                ZIP
              </th>
            )}
```

- [ ] **Step 3: Add ZIP column cell in each row**

After the Location `<td>` (around line 154), inside the `sorted.map` row, add:

```tsx
                {showZipColumn && (
                  <td className="px-4 py-3">
                    {lead.sourceZip ? (
                      <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                        {lead.sourceZip}
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs">—</span>
                    )}
                  </td>
                )}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd "/Users/ramifakhuri/Projects/Lead gen. website /leadzip" && npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
cd "/Users/ramifakhuri/Projects/Lead gen. website /leadzip" && git add src/components/leads/LeadTable.tsx && git commit -m "feat(ui): add ZIP source column to LeadTable for bulk search results"
```

---

## Task 4: Bulk mode in SearchFilters

**Files:**
- Modify: `src/components/leads/SearchFilters.tsx`

This is the largest change. Replace the entire file with the version below, which adds:
- Mode toggle in the header
- Chip-based bulk ZIP input (bulk mode only)
- `onBulkSearch` callback
- Backspace-to-remove-last-chip behavior

- [ ] **Step 1: Replace SearchFilters.tsx**

Replace the full contents of `src/components/leads/SearchFilters.tsx` with:

```tsx
'use client'

import { useState } from 'react'
import { Search, Loader2, SlidersHorizontal, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SearchParams, LEAD_CATEGORIES } from '@/types/lead'

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

export function SearchFilters({
  onSearch,
  onBulkSearch,
  isLoading,
  initialValues,
  searchMode,
  onSearchModeChange,
  maxBulkZips,
}: SearchFiltersProps) {
  // Single mode state
  const [zipCode, setZipCode] = useState(initialValues?.zipCode ?? '')
  const [zipError, setZipError] = useState('')

  // Bulk mode state
  const [bulkZips, setBulkZips] = useState<string[]>([])
  const [bulkInput, setBulkInput] = useState('')
  const [bulkZipError, setBulkZipError] = useState('')

  // Shared filter state
  const [city, setCity] = useState(initialValues?.city ?? '')
  const [radiusMiles, setRadiusMiles] = useState(initialValues?.radiusMiles ?? 25)
  const [category, setCategory] = useState(initialValues?.category ?? '')
  const [keyword, setKeyword] = useState(initialValues?.keyword ?? '')
  const [minRating, setMinRating] = useState(initialValues?.minRating ?? 0)
  const [hasWebsite, setHasWebsite] = useState(false)
  const [hasPhone, setHasPhone] = useState(false)
  const [excludeSaved, setExcludeSaved] = useState(false)

  function addBulkZip() {
    const zip = bulkInput.trim()
    if (!zip) return
    if (!/^\d{5}$/.test(zip)) {
      setBulkZipError('Enter a valid 5-digit ZIP code')
      return
    }
    if (bulkZips.includes(zip)) {
      setBulkZipError('ZIP already added')
      return
    }
    if (bulkZips.length >= maxBulkZips) {
      setBulkZipError(`Your plan allows up to ${maxBulkZips} ZIPs`)
      return
    }
    setBulkZips((prev) => [...prev, zip])
    setBulkInput('')
    setBulkZipError('')
  }

  function removeBulkZip(zip: string) {
    setBulkZips((prev) => prev.filter((z) => z !== zip))
  }

  function handleBulkKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addBulkZip()
    } else if (e.key === 'Backspace' && bulkInput === '' && bulkZips.length > 0) {
      removeBulkZip(bulkZips[bulkZips.length - 1])
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (searchMode === 'bulk') {
      if (bulkZips.length === 0) {
        setBulkZipError('Add at least one ZIP code')
        return
      }
      const baseParams: Omit<SearchParams, 'zipCode'> = {
        city: city.trim() || undefined,
        radiusMiles,
        category,
        keyword: keyword.trim() || undefined,
        minRating: minRating > 0 ? minRating : undefined,
        hasWebsite: hasWebsite || undefined,
        hasPhone: hasPhone || undefined,
        excludeSaved: excludeSaved || undefined,
      }
      onBulkSearch?.(baseParams, bulkZips)
      return
    }

    // Single mode
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
        {/* Header with mode toggle */}
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
          <SlidersHorizontal className="h-4 w-4 text-blue-600 shrink-0" />
          <span className="text-sm font-semibold text-slate-800">Search Filters</span>
          <div className="ml-auto flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            <button
              type="button"
              onClick={() => onSearchModeChange('single')}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-medium transition-all',
                searchMode === 'single'
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              )}
            >
              Single ZIP
            </button>
            <button
              type="button"
              onClick={() => onSearchModeChange('bulk')}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-medium transition-all',
                searchMode === 'bulk'
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              )}
            >
              Bulk Search
            </button>
          </div>
        </div>

        <div className="p-4 space-y-5">
          {searchMode === 'single' ? (
            /* Single ZIP input */
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
          ) : (
            /* Bulk ZIP chip input */
            <div>
              <label className={labelClass}>
                ZIP Codes <span className="text-red-500">*</span>
              </label>
              <div
                className={cn(
                  'flex min-h-[72px] flex-wrap gap-1.5 rounded-lg border bg-white p-2 cursor-text',
                  'focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20',
                  bulkZipError ? 'border-red-400 ring-2 ring-red-400/20' : 'border-slate-200'
                )}
                onClick={() => {
                  const input = document.getElementById('bulkZipInput') as HTMLInputElement
                  input?.focus()
                }}
              >
                {bulkZips.map((zip) => (
                  <span
                    key={zip}
                    className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800"
                  >
                    {zip}
                    <button
                      type="button"
                      onClick={() => removeBulkZip(zip)}
                      aria-label={`Remove ${zip}`}
                      className="hover:text-blue-600 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                <input
                  id="bulkZipInput"
                  type="text"
                  inputMode="numeric"
                  value={bulkInput}
                  onChange={(e) => {
                    setBulkInput(e.target.value.replace(/[^\d]/g, '').slice(0, 5))
                    if (bulkZipError) setBulkZipError('')
                  }}
                  onKeyDown={handleBulkKeyDown}
                  onBlur={() => { if (bulkInput.length === 5) addBulkZip() }}
                  placeholder={bulkZips.length === 0 ? 'Type a ZIP, press Enter to add' : ''}
                  className="flex-1 min-w-[140px] border-none bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                />
              </div>
              <p className="mt-1 text-xs text-slate-400">
                {bulkZips.length} / {maxBulkZips} ZIPs — same filters apply to all
              </p>
              {bulkZipError && (
                <p role="alert" className="mt-1 text-xs text-red-600">
                  {bulkZipError}
                </p>
              )}
            </div>
          )}

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
                {searchMode === 'bulk'
                  ? `Search ${bulkZips.length > 0 ? bulkZips.length + ' ' : ''}ZIP${bulkZips.length !== 1 ? 's' : ''}`
                  : 'Search Leads'}
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "/Users/ramifakhuri/Projects/Lead gen. website /leadzip" && npx tsc --noEmit 2>&1 | head -30
```

Expected: TypeScript errors on `search/page.tsx` because it's not yet passing the new required props (`searchMode`, `onSearchModeChange`, `maxBulkZips`). That is expected — Task 5 fixes it.

- [ ] **Step 3: Commit**

```bash
cd "/Users/ramifakhuri/Projects/Lead gen. website /leadzip" && git add src/components/leads/SearchFilters.tsx && git commit -m "feat(ui): add bulk mode chip input and mode toggle to SearchFilters"
```

---

## Task 5: Bulk fan-out in search/page.tsx

**Files:**
- Modify: `src/app/(dashboard)/search/page.tsx`

This task wires up the new SearchFilters props, adds bulk state, fetches the user's plan from Supabase, and implements `handleBulkSearch`.

- [ ] **Step 1: Add new imports and constants**

At the top of `src/app/(dashboard)/search/page.tsx`, add `Loader2` to the lucide-react import and add the supabase client import. Replace the existing imports block with:

```typescript
'use client'

import { useState, useCallback, useEffect, useMemo, Suspense } from 'react'
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
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Lead, SearchParams, SearchHistory } from '@/types/lead'
import { exportToCSV, exportToHubSpot, exportToSalesforce } from '@/lib/export'
import { SearchFilters } from '@/components/leads/SearchFilters'
import { LeadCard } from '@/components/leads/LeadCard'
import { LeadTable } from '@/components/leads/LeadTable'
import { LeadsMapWrapper } from '@/components/leads/LeadsMapWrapper'
import { createClient } from '@/lib/supabase/client'
```

After the existing constants (`SAVED_IDS_KEY`, `SAVED_LEADS_KEY`, `HISTORY_KEY`), add:

```typescript
const MAX_BULK_ZIPS: Record<string, number> = { free: 3, pro: 10, agency: 25 }
```

- [ ] **Step 2: Add new state variables to SearchPageInner**

Inside `SearchPageInner`, after the existing `useState` declarations (after `const [totalFound, ...]`), add:

```typescript
  const [searchMode, setSearchMode] = useState<'single' | 'bulk'>('single')
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null)
  const [noResultZips, setNoResultZips] = useState<string[]>([])
  const [userPlan, setUserPlan] = useState<'free' | 'pro' | 'agency'>('free')
  const [searchedZipCount, setSearchedZipCount] = useState(0)
```

- [ ] **Step 3: Fetch user plan on mount**

After the existing `useEffect` that loads saved lead IDs, add:

```typescript
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
```

- [ ] **Step 4: Add `handleBulkSearch` function**

After the existing `handleSearch` function, add:

```typescript
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

      // Track ZIPs with no results
      const emptyZips = results.filter((r) => r.leads.length === 0).map((r) => r.zip)
      setNoResultZips(emptyZips)

      // Use the first result center for the map
      const firstCenter = results.find((r) => r.center)?.center
      if (firstCenter) setMapCenter(firstCenter)

      // Merge all leads, attach sourceZip
      const allLeads = results.flatMap((r) =>
        r.leads.map((l) => ({ ...l, sourceZip: r.zip }))
      )

      // Deduplicate by businessName + address — keep the entry with shorter distanceMiles
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

      // Sort by leadScore descending
      const merged = [...seen.values()].sort((a, b) => b.leadScore - a.leadScore)

      const filtered = baseParams.excludeSaved
        ? merged.filter((l) => !savedLeadIds.has(l.id))
        : merged

      setLeads(filtered)
      setTotalFound(filtered.length)

      // Append to search history in localStorage (one entry per ZIP)
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
```

- [ ] **Step 5: Compute maxBulkZips and update both SearchFilters usages**

Add this line after the `sortedLeads` declaration:

```typescript
  const maxBulkZips = MAX_BULK_ZIPS[userPlan] ?? 3
```

Find the desktop `<SearchFilters>` (inside `<aside>`) and replace it:

```tsx
          <SearchFilters
            onSearch={handleSearch}
            onBulkSearch={handleBulkSearch}
            isLoading={isLoading}
            initialValues={initialValues}
            searchMode={searchMode}
            onSearchModeChange={setSearchMode}
            maxBulkZips={maxBulkZips}
          />
```

Find the mobile `<SearchFilters>` (inside `<div className="lg:hidden">`) and replace it the same way:

```tsx
          <SearchFilters
            onSearch={handleSearch}
            onBulkSearch={handleBulkSearch}
            isLoading={isLoading}
            initialValues={initialValues}
            searchMode={searchMode}
            onSearchModeChange={setSearchMode}
            maxBulkZips={maxBulkZips}
          />
```

- [ ] **Step 6: Add bulk progress indicator and summary bar**

Find the results toolbar section (the `{(hasSearched || leads.length > 0) && (` block). Replace the loading count placeholder (`<span className="inline-block h-4 w-32...`) block:

```tsx
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
                  {noResultZips.length > 0 && (
                    <span className="ml-2 inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                      No results for: {noResultZips.join(', ')}
                    </span>
                  )}
                </>
              )}
```

- [ ] **Step 7: Verify TypeScript compiles with no errors**

```bash
cd "/Users/ramifakhuri/Projects/Lead gen. website /leadzip" && npx tsc --noEmit 2>&1
```

Expected: zero errors.

- [ ] **Step 8: Commit**

```bash
cd "/Users/ramifakhuri/Projects/Lead gen. website /leadzip" && git add src/app/\(dashboard\)/search/page.tsx && git commit -m "feat(search): add bulk ZIP fan-out, progress UI, and summary bar"
```

---

## Task 6: Manual verification

- [ ] **Step 1: Start the dev server**

```bash
cd "/Users/ramifakhuri/Projects/Lead gen. website /leadzip" && npm run dev
```

Expected: starts on http://localhost:3000 with no compile errors.

- [ ] **Step 2: Test mode toggle**

Open http://localhost:3000/search. Verify:
- The "Search Filters" panel header now shows `[ Single ZIP ] [ Bulk Search ]` toggle in the top right
- Clicking "Bulk Search" replaces the ZIP input with the chip input
- Clicking "Single ZIP" restores the normal ZIP input

- [ ] **Step 3: Test chip input**

In Bulk Search mode:
- Type `10001` and press Enter → chip appears, input clears
- Type `90210` and press Enter → second chip appears; counter shows `2 / 3 ZIPs` (free plan)
- Click × on first chip → it's removed; counter shows `1 / 3 ZIPs`
- Type `10001` again → error: "ZIP already added"
- Type `abc12` → error: "Enter a valid 5-digit ZIP code"
- Add chips up to the plan limit → adding one more shows "Your plan allows up to N ZIPs"

- [ ] **Step 4: Test bulk search**

Add 2 ZIP codes (e.g. `10001` and `90210`), select a category, hit Search:
- Loading state shows "Searching 2 ZIPs… (0/2 complete)" then "(1/2 complete)" then "(2/2 complete)"
- Results appear with ZIP badges on each card
- Summary bar shows "X results across 2 ZIP codes"
- Switch to Table view — ZIP column is visible

- [ ] **Step 5: Test zero-result ZIP warning**

Add a ZIP that is not in the dynamic provider's database alongside a valid one. The summary should show "No results for: XXXXX".

- [ ] **Step 6: Verify single mode is unchanged**

Switch back to "Single ZIP", enter a ZIP, search — behavior is identical to before this feature.

- [ ] **Step 7: Final commit (if any fixes made during verification)**

```bash
cd "/Users/ramifakhuri/Projects/Lead gen. website /leadzip" && git add -p && git commit -m "fix(search): bulk search verification fixes"
```

Only run if fixes were needed. Skip if all verification passed cleanly.
