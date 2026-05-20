# Mobile Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make LeadZip fully usable on mobile phones — polished drawer navigation, bottom sheet filters, compact lead cards, and an inline ZIP search hero.

**Architecture:** All changes are Tailwind responsive-class driven (no JavaScript media query hooks) to avoid flash-of-wrong-layout on SSR. The drawer uses CSS transforms for smooth GPU-composited animation. No new libraries required.

**Tech Stack:** Next.js 16, Tailwind CSS, React, TypeScript

---

## File Map

| File | Change |
|------|--------|
| `src/components/layout/Sidebar.tsx` | Animate drawer with CSS transforms; add swipe-to-close; add body scroll lock |
| `src/app/(dashboard)/search/page.tsx` | Add bottom sheet filter panel; hide table view toggle on mobile |
| `src/components/leads/LeadCard.tsx` | Add compact mobile layout using `lg:hidden` / `hidden lg:flex` |
| `src/components/landing/HeroSearchWidget.tsx` | New client component — inline ZIP + category search form |
| `src/app/page.tsx` | Import HeroSearchWidget; show on mobile, hide CTA buttons on mobile |
| `src/app/layout.tsx` | Add `overflow-x-hidden` to body |

---

### Task 1: Sidebar Drawer — Smooth Animation + Swipe-to-Close + Scroll Lock

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Add `useRef` and `useEffect` imports**

The file already imports `useState` and `useEffect`. Add `useRef` to the import:

```tsx
import { useState, useEffect, useRef } from 'react'
```

- [ ] **Step 2: Replace the conditional mobile drawer with always-rendered, transform-animated version**

Find this block (lines 246–274):
```tsx
{/* Mobile Sidebar — drawer overlay */}
{mobileOpen && (
  <>
    {/* Backdrop */}
    <div
      className="lg:hidden fixed inset-0 bg-black/30 backdrop-blur-sm z-40 transition-opacity"
      onClick={onMobileClose}
      aria-hidden="true"
    />

    {/* Drawer */}
    <aside className="lg:hidden fixed left-0 top-0 bottom-0 w-72 bg-white z-50 shadow-2xl">
      {/* Close Button */}
      <button
        onClick={onMobileClose}
        className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors z-10"
        aria-label="Close sidebar"
      >
        <X className="w-4 h-4" />
      </button>

      <SidebarContent
        currentPath={currentPath}
        user={user}
        onLinkClick={onMobileClose}
      />
    </aside>
  </>
)}
```

Replace it entirely with:
```tsx
{/* Mobile Sidebar — always in DOM, animated with CSS transforms */}
<>
  {/* Backdrop */}
  <div
    className={cn(
      'lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300',
      mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
    )}
    onClick={onMobileClose}
    aria-hidden="true"
  />

  {/* Drawer */}
  <aside
    className={cn(
      'lg:hidden fixed left-0 top-0 bottom-0 w-72 bg-white z-50 shadow-2xl',
      'transition-transform duration-300 ease-in-out will-change-transform',
      mobileOpen ? 'translate-x-0' : '-translate-x-full'
    )}
    onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX }}
    onTouchMove={(e) => { touchCurrentX.current = e.touches[0].clientX }}
    onTouchEnd={() => {
      const delta = touchStartX.current - touchCurrentX.current
      if (delta > 60 && onMobileClose) onMobileClose()
      touchStartX.current = 0
      touchCurrentX.current = 0
    }}
  >
    <button
      onClick={onMobileClose}
      className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors z-10 min-h-[44px] min-w-[44px]"
      aria-label="Close sidebar"
    >
      <X className="w-4 h-4" />
    </button>

    <SidebarContent
      currentPath={currentPath}
      user={user}
      onLinkClick={onMobileClose}
    />
  </aside>
</>
```

- [ ] **Step 3: Add touch tracking refs and body scroll lock inside `Sidebar` component**

Directly above the `return (` in `Sidebar` (after the props destructure), add:

```tsx
const touchStartX = useRef(0)
const touchCurrentX = useRef(0)

useEffect(() => {
  if (mobileOpen) {
    document.body.style.overflow = 'hidden'
  } else {
    document.body.style.overflow = ''
  }
  return () => { document.body.style.overflow = '' }
}, [mobileOpen])
```

- [ ] **Step 4: Run TypeScript check**

```bash
cd "/Users/ramifakhuri/Projects/Lead gen. website /leadzip" && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
cd "/Users/ramifakhuri/Projects/Lead gen. website /leadzip"
git add src/components/layout/Sidebar.tsx
git commit -m "feat(mobile): animate sidebar drawer with CSS transforms + swipe-to-close"
```

---

### Task 2: Body Overflow Fix

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Add `overflow-x-hidden` to the body element**

In `src/app/layout.tsx`, find:
```tsx
<body className="min-h-full flex flex-col font-sans">
```

Replace with:
```tsx
<body className="min-h-full flex flex-col font-sans overflow-x-hidden">
```

- [ ] **Step 2: Commit**

```bash
cd "/Users/ramifakhuri/Projects/Lead gen. website /leadzip"
git add src/app/layout.tsx
git commit -m "fix(mobile): prevent horizontal overflow scroll on all pages"
```

---

### Task 3: Bottom Sheet Filter Panel on Search Page

**Files:**
- Modify: `src/app/(dashboard)/search/page.tsx`

- [ ] **Step 1: Add `filterSheetOpen` state and `SlidersHorizontal` icon import**

At the top of the file, the imports already include many lucide icons. Add `SlidersHorizontal` and `Filter` to the lucide import:

```tsx
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
  SlidersHorizontal,   // add this
} from 'lucide-react'
```

- [ ] **Step 2: Add `filterSheetOpen` state inside `SearchPageInner`**

Find where other `useState` calls are declared inside `SearchPageInner` and add:

```tsx
const [filterSheetOpen, setFilterSheetOpen] = useState(false)
```

- [ ] **Step 3: Replace the mobile filter area with a bottom sheet trigger + sheet**

Find the existing mobile filter section. It will look something like this (search for `lg:hidden` near `SearchFilters`):

```tsx
{/* Mobile filters */}
<div className="lg:hidden mb-4">
  ...existing mobile filter UI...
</div>
```

Replace the entire mobile filter section with:

```tsx
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
```

Note: adjust `params`, `onChange`, `onSearch`, `loading`, `userPlan` prop names to match the actual props passed to `SearchFilters` in the desktop sidebar section of the file.

- [ ] **Step 4: Add the slide-up animation to `globals.css`**

In `src/app/globals.css`, add at the end:

```css
@keyframes slide-up {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}
.animate-slide-up {
  animation: slide-up 0.3s ease-out forwards;
}
```

- [ ] **Step 5: Hide the Table view mode button on mobile**

Find the view mode toggle buttons (they render `LayoutGrid`, `List`, `MapIcon` icons). Wrap the Table button with `hidden lg:flex`:

```tsx
{/* Hide table view on mobile — doesn't render well on narrow screens */}
<button
  onClick={() => setViewMode('table')}
  className={cn(
    'hidden lg:flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors',
    viewMode === 'table'
      ? 'bg-slate-900 text-white'
      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
  )}
>
  <List className="h-3.5 w-3.5" />
  <span className="hidden sm:inline">Table</span>
</button>
```

- [ ] **Step 6: TypeScript check**

```bash
cd "/Users/ramifakhuri/Projects/Lead gen. website /leadzip" && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 7: Commit**

```bash
cd "/Users/ramifakhuri/Projects/Lead gen. website /leadzip"
git add src/app/\(dashboard\)/search/page.tsx src/app/globals.css
git commit -m "feat(mobile): bottom sheet filter panel on search page"
```

---

### Task 4: Compact Lead Card Layout

**Files:**
- Modify: `src/components/leads/LeadCard.tsx`

- [ ] **Step 1: Add compact mobile layout inside the LeadCard return**

The current `LeadCard` returns a single `<div>` with the full layout. Wrap it so mobile shows compact and desktop shows full.

Replace the opening of the `return (`:
```tsx
return (
  <div
    className={cn(
      'group relative flex flex-col gap-3 rounded-xl border bg-white p-4 transition-all duration-200',
```

With a responsive wrapper approach — add a compact section at the very top of the card's inner content, before the header section:

Insert this block right after the opening card `<div>` (after the `{/* Selection checkbox */}` block), wrapped in `lg:hidden`:

```tsx
{/* ── Compact layout (mobile only) ── */}
<div className="lg:hidden">
  <div className="flex items-start justify-between gap-2">
    <div className="flex-1 min-w-0">
      <h3 className="truncate text-sm font-semibold text-slate-900">{lead.businessName}</h3>
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        {lead.rating !== null && (
          <span className="text-xs text-amber-600 font-medium">★ {lead.rating?.toFixed(1)}</span>
        )}
        {lead.distanceMiles !== null && (
          <span className="text-xs text-slate-500">· {lead.distanceMiles?.toFixed(1)} mi</span>
        )}
        {lead.openNow === true && (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">Open</span>
        )}
        {lead.openNow === false && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">Closed</span>
        )}
      </div>
    </div>
    <LeadScore score={lead.leadScore} size="sm" />
  </div>

  <div className="mt-3 flex items-center gap-2">
    <button
      onClick={() => onSave({ ...lead, notes: noteDraft })}
      className={cn(
        'flex-1 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-xs font-semibold min-h-[44px] transition-all duration-150',
        isSaved ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
      )}
    >
      {isSaved ? <BookmarkCheck className="h-4 w-4 shrink-0" /> : <Bookmark className="h-4 w-4 shrink-0" />}
      {isSaved ? 'Saved' : 'Save Lead'}
    </button>
    {lead.phone && (
      <a
        href={`tel:${lead.phone.replace(/\D/g, '')}`}
        className="flex items-center justify-center rounded-lg bg-slate-100 p-2.5 text-slate-600 hover:bg-slate-200 transition-colors min-h-[44px] min-w-[44px]"
        aria-label={`Call ${lead.businessName}`}
      >
        <Phone className="h-4 w-4" />
      </a>
    )}
    {lead.website && (
      <a
        href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center rounded-lg bg-slate-100 p-2.5 text-slate-600 hover:bg-slate-200 transition-colors min-h-[44px] min-w-[44px]"
        aria-label={`Visit ${lead.businessName} website`}
      >
        <Globe className="h-4 w-4" />
      </a>
    )}
  </div>
</div>
```

Then wrap the rest of the existing card content (everything from `{/* Header */}` onward) in `<div className="hidden lg:flex flex-col gap-3">`:

```tsx
{/* ── Full layout (desktop only) ── */}
<div className="hidden lg:flex flex-col gap-3">
  {/* Header */}
  ...existing full layout content...
</div>
```

- [ ] **Step 2: TypeScript check**

```bash
cd "/Users/ramifakhuri/Projects/Lead gen. website /leadzip" && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
cd "/Users/ramifakhuri/Projects/Lead gen. website /leadzip"
git add src/components/leads/LeadCard.tsx
git commit -m "feat(mobile): compact lead card layout on mobile with tap-to-call/website"
```

---

### Task 5: Homepage Inline ZIP Search Widget

**Files:**
- Create: `src/components/landing/HeroSearchWidget.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Create `HeroSearchWidget.tsx`**

Create `src/components/landing/HeroSearchWidget.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MapPin, Search } from 'lucide-react'
import { LEAD_CATEGORIES } from '@/types/lead'

export function HeroSearchWidget() {
  const router = useRouter()
  const [zip, setZip] = useState('')
  const [category, setCategory] = useState('')
  const [zipError, setZipError] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!zip.trim() || zip.trim().length < 5) {
      setZipError('Enter a valid 5-digit ZIP')
      return
    }
    setZipError('')
    const params = new URLSearchParams({ zip: zip.trim() })
    if (category) params.set('category', category)
    router.push(`/search?${params.toString()}`)
  }

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-3">
      <div className="flex flex-col gap-2">
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#0369A1] pointer-events-none" />
          <input
            type="text"
            inputMode="numeric"
            maxLength={5}
            value={zip}
            onChange={(e) => {
              setZip(e.target.value.replace(/\D/g, ''))
              setZipError('')
            }}
            placeholder="Enter ZIP code"
            className="w-full rounded-xl border border-[#E2E8F0] bg-white pl-9 pr-4 py-3 text-[16px] text-slate-900 placeholder:text-slate-400 focus:border-[#0369A1] focus:outline-none focus:ring-2 focus:ring-[#0369A1]/20 min-h-[48px]"
          />
        </div>
        {zipError && <p className="text-xs text-red-500 pl-1">{zipError}</p>}

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full rounded-xl border border-[#E2E8F0] bg-white px-4 py-3 text-[16px] text-slate-900 focus:border-[#0369A1] focus:outline-none focus:ring-2 focus:ring-[#0369A1]/20 min-h-[48px]"
        >
          <option value="">All categories</option>
          {LEAD_CATEGORIES.filter((c) => c !== 'Custom Keyword').map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#0369A1] py-3 text-base font-semibold text-white hover:bg-[#0284C7] transition-colors min-h-[48px]"
      >
        <Search className="h-4 w-4" />
        Find Leads
      </button>

      <p className="text-center text-xs text-slate-400">Free · No credit card required</p>
    </form>
  )
}
```

- [ ] **Step 2: Import `HeroSearchWidget` in `src/app/page.tsx`**

Add the import near the top of `src/app/page.tsx`:

```tsx
import { HeroSearchWidget } from '@/components/landing/HeroSearchWidget'
```

- [ ] **Step 3: Add the widget to the hero section (mobile only)**

Find the CTA button block in the hero (around line 429):
```tsx
<div className="flex flex-col sm:flex-row items-center gap-3 justify-center lg:justify-start">
  <Link href="/signup">
    <Button className="h-12 rounded-xl bg-[#0369A1] px-7 ...">
      Start Searching Free
      <ArrowRight className="ml-1.5 h-4 w-4" />
    </Button>
  </Link>
  <Link href="#demo">
    <Button variant="outline" className="h-12 rounded-xl ...">
      View Demo
    </Button>
  </Link>
</div>
```

Replace with:
```tsx
{/* Mobile: inline search widget */}
<div className="sm:hidden w-full max-w-sm mx-auto">
  <HeroSearchWidget />
</div>

{/* Tablet+: original CTA buttons */}
<div className="hidden sm:flex flex-col sm:flex-row items-center gap-3 justify-center lg:justify-start">
  <Link href="/signup">
    <Button className="h-12 rounded-xl bg-[#0369A1] px-7 text-base font-semibold text-white hover:bg-[#0284C7] shadow-sm transition-all hover:shadow-md hover:-translate-y-px">
      Start Searching Free
      <ArrowRight className="ml-1.5 h-4 w-4" />
    </Button>
  </Link>
  <Link href="#demo">
    <Button
      variant="outline"
      className="h-12 rounded-xl border-[#E2E8F0] px-7 text-base font-semibold text-[#0F172A] hover:bg-[#F8FAFC]"
    >
      View Demo
    </Button>
  </Link>
</div>
```

- [ ] **Step 4: TypeScript check**

```bash
cd "/Users/ramifakhuri/Projects/Lead gen. website /leadzip" && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
cd "/Users/ramifakhuri/Projects/Lead gen. website /leadzip"
git add src/components/landing/HeroSearchWidget.tsx src/app/page.tsx
git commit -m "feat(mobile): inline ZIP search widget in homepage hero for mobile visitors"
```

---

### Task 6: General Mobile Fixes — Touch Targets + Input Zoom Prevention

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Add global input font-size fix to prevent iOS zoom**

In `src/app/globals.css`, add:

```css
/* Prevent iOS auto-zoom on input focus (requires font-size >= 16px) */
@media (max-width: 1023px) {
  input[type="text"],
  input[type="email"],
  input[type="password"],
  input[type="number"],
  input[type="search"],
  input[type="tel"],
  select,
  textarea {
    font-size: 16px !important;
  }
}
```

- [ ] **Step 2: Verify `HeroSearchWidget` and `OnboardingModal` inputs already use `text-[16px]`**

Both were written in previous tasks with `text-[16px]`. No further change needed.

- [ ] **Step 3: TypeScript check + full build check**

```bash
cd "/Users/ramifakhuri/Projects/Lead gen. website /leadzip" && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
cd "/Users/ramifakhuri/Projects/Lead gen. website /leadzip"
git add src/app/globals.css
git commit -m "fix(mobile): prevent iOS input zoom with 16px font-size on all inputs"
```

---

### Task 7: Deploy

- [ ] **Step 1: Final TypeScript check**

```bash
cd "/Users/ramifakhuri/Projects/Lead gen. website /leadzip" && npx tsc --noEmit
```

Expected: no output (clean)

- [ ] **Step 2: Deploy to Vercel production**

```bash
cd "/Users/ramifakhuri/Projects/Lead gen. website /leadzip" && vercel --prod
```

Expected: Build succeeds, deployment URL printed

- [ ] **Step 3: Smoke test on mobile**

Open https://leadzip.vercel.app on a phone (or Chrome DevTools device mode at 390px width) and verify:
- Hamburger button opens the sidebar drawer with smooth slide-in animation
- Swiping left on the drawer closes it
- Backdrop tap closes drawer
- On `/search`, the Filters button opens a bottom sheet from the bottom
- Lead cards show the compact layout (name, rating, distance, Save/call/web buttons)
- Homepage hero shows the ZIP + category search form (not the CTA buttons)
- No horizontal scroll on any page
- Inputs don't zoom on focus (iOS Safari)
