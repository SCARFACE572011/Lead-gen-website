# B4 Saved Searches + Alert Digest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users save a search (ZIP + radius + category + keyword) and receive a daily plain-text email digest when new businesses appear, with alerts gated to paid plans.

**Architecture:** Single `saved_searches` Supabase table stores search params + last result snapshot (`last_place_ids text[]`). Five REST routes handle CRUD and alert toggling. A Vercel cron route runs daily at 9 AM UTC, re-runs each active search via `searchLeadsCombined`, diffs against the snapshot, sends a plain-text email if new leads are found, then updates the snapshot. Free users can save up to 8 searches; paid users get unlimited saves and alert emails.

**Tech Stack:** Next.js 15 App Router, TypeScript, Tailwind CSS, Supabase (postgres + RLS + service role), nodemailer/Gmail SMTP, lucide-react, Vercel cron.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `supabase/migrations/20260519_saved_searches.sql` | Create | Schema + RLS |
| `src/types/saved-search.ts` | Create | `SavedSearch` interface |
| `src/app/api/saved-searches/route.ts` | Create | GET list + POST create |
| `src/app/api/saved-searches/[id]/route.ts` | Create | PATCH toggle alert + DELETE |
| `src/components/SaveSearchModal.tsx` | Create | Modal for naming + saving a search |
| `src/app/(dashboard)/saved-searches/page.tsx` | Create | Management table page |
| `src/app/(dashboard)/search/page.tsx` | Modify | Add save button + modal state |
| `src/app/(dashboard)/layout.tsx` | Modify | Add "Saved Searches" nav item |
| `src/app/api/cron/alert-digest/route.ts` | Create | Daily cron — diff + email |
| `vercel.json` | Modify | Add 9 AM UTC cron schedule |

---

## Task 1: Schema migration + TypeScript type

**Files:**
- Create: `supabase/migrations/20260519_saved_searches.sql`
- Create: `src/types/saved-search.ts`

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/migrations/20260519_saved_searches.sql
CREATE TABLE saved_searches (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name          text        NOT NULL,
  zip           text        NOT NULL,
  radius        integer     NOT NULL,
  category      text        NOT NULL,
  keyword       text,
  alert_enabled boolean     DEFAULT false NOT NULL,
  last_place_ids text[]     DEFAULT '{}' NOT NULL,
  last_run_at   timestamptz,
  created_at    timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own saved searches"
  ON saved_searches FOR ALL
  USING (auth.uid() = user_id);
```

- [ ] **Step 2: Apply the migration**

Option A — Supabase CLI (preferred):
```bash
cd "/Users/ramifakhuri/Projects/Lead gen. website /leadzip"
npx supabase db push
```

Option B — Supabase dashboard: paste the SQL into the SQL editor and run it.

Verify: in the Supabase dashboard, the `saved_searches` table appears under Table Editor with the correct columns.

- [ ] **Step 3: Write the TypeScript type**

```typescript
// src/types/saved-search.ts
export interface SavedSearch {
  id: string
  userId: string
  name: string
  zip: string
  radius: number
  category: string
  keyword?: string
  alertEnabled: boolean
  lastPlaceIds: string[]
  lastRunAt?: string
  createdAt: string
}
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260519_saved_searches.sql src/types/saved-search.ts
git commit -m "feat: add saved_searches schema + SavedSearch type"
```

---

## Task 2: GET + POST /api/saved-searches

**Files:**
- Create: `src/app/api/saved-searches/route.ts`

**Context:** Auth pattern is `createClient` from `@/lib/supabase/server` → `supabase.auth.getUser()` → 401 if no user. Plan check reads `users_profile.plan` (values: `'free' | 'pro' | 'agency'`). Free users are limited to 8 saved searches total.

- [ ] **Step 1: Create the route file**

```typescript
// src/app/api/saved-searches/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { SavedSearch } from '@/types/saved-search'

function toSavedSearch(row: Record<string, unknown>): SavedSearch {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    name: row.name as string,
    zip: row.zip as string,
    radius: row.radius as number,
    category: row.category as string,
    keyword: (row.keyword as string | null) ?? undefined,
    alertEnabled: row.alert_enabled as boolean,
    lastPlaceIds: row.last_place_ids as string[],
    lastRunAt: (row.last_run_at as string | null) ?? undefined,
    createdAt: row.created_at as string,
  }
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('saved_searches')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch saved searches' }, { status: 500 })
  }

  return NextResponse.json({ searches: (data ?? []).map(toSavedSearch) })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json() as {
    name: string
    zip: string
    radius: number
    category: string
    keyword?: string
  }

  if (!body.name?.trim() || !body.zip || !body.radius || !body.category) {
    return NextResponse.json(
      { error: 'name, zip, radius, and category are required' },
      { status: 400 }
    )
  }

  const { data: profile } = await supabase
    .from('users_profile')
    .select('plan')
    .eq('id', user.id)
    .maybeSingle()

  if ((profile?.plan ?? 'free') === 'free') {
    const { count } = await supabase
      .from('saved_searches')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)

    if ((count ?? 0) >= 8) {
      return NextResponse.json({ error: 'limit_reached' }, { status: 403 })
    }
  }

  const { data, error } = await supabase
    .from('saved_searches')
    .insert({
      user_id: user.id,
      name: body.name.trim(),
      zip: body.zip,
      radius: body.radius,
      category: body.category,
      keyword: body.keyword ?? null,
      alert_enabled: false,
      last_place_ids: [],
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to save search' }, { status: 500 })
  }

  return NextResponse.json({ search: toSavedSearch(data as Record<string, unknown>) }, { status: 201 })
}
```

- [ ] **Step 2: Test GET (empty list)**

Start the dev server: `cd "/Users/ramifakhuri/Projects/Lead gen. website /leadzip" && npm run dev`

In the browser, open DevTools → Network. Navigate to `/search`, log in if needed, then run in console:
```javascript
fetch('/api/saved-searches').then(r => r.json()).then(console.log)
```
Expected: `{ searches: [] }`

- [ ] **Step 3: Test POST (create a saved search)**

In browser DevTools console:
```javascript
fetch('/api/saved-searches', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Test Search', zip: '90210', radius: 10, category: 'hvac' })
}).then(r => r.json()).then(console.log)
```
Expected: `{ search: { id: '...', name: 'Test Search', zip: '90210', ... } }` with HTTP 201.

- [ ] **Step 4: Test limit enforcement**

Create 8 searches in the Supabase dashboard (or loop via console). Then POST a 9th:
```javascript
fetch('/api/saved-searches', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Ninth', zip: '10001', radius: 5, category: 'plumbers' })
}).then(r => r.json()).then(console.log)
```
Expected: `{ error: 'limit_reached' }` with HTTP 403 (for free plan users).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/saved-searches/route.ts
git commit -m "feat: GET + POST /api/saved-searches"
```

---

## Task 3: PATCH + DELETE /api/saved-searches/[id]

**Files:**
- Create: `src/app/api/saved-searches/[id]/route.ts`

**Context:** `params` in Next.js 15 App Router is a `Promise` — must be awaited. RLS ensures users can only touch their own rows (`.eq('user_id', user.id)` is redundant safety on top of RLS). Alert enable is blocked for free users.

- [ ] **Step 1: Create the route file**

```typescript
// src/app/api/saved-searches/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { SavedSearch } from '@/types/saved-search'

function toSavedSearch(row: Record<string, unknown>): SavedSearch {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    name: row.name as string,
    zip: row.zip as string,
    radius: row.radius as number,
    category: row.category as string,
    keyword: (row.keyword as string | null) ?? undefined,
    alertEnabled: row.alert_enabled as boolean,
    lastPlaceIds: row.last_place_ids as string[],
    lastRunAt: (row.last_run_at as string | null) ?? undefined,
    createdAt: row.created_at as string,
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json() as { alertEnabled: boolean }

  if (body.alertEnabled) {
    const { data: profile } = await supabase
      .from('users_profile')
      .select('plan')
      .eq('id', user.id)
      .maybeSingle()

    if ((profile?.plan ?? 'free') === 'free') {
      return NextResponse.json({ error: 'upgrade_required' }, { status: 403 })
    }
  }

  const { data, error } = await supabase
    .from('saved_searches')
    .update({ alert_enabled: body.alertEnabled })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to update saved search' }, { status: 500 })
  }

  return NextResponse.json({ search: toSavedSearch(data as Record<string, unknown>) })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { error } = await supabase
    .from('saved_searches')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: 'Failed to delete saved search' }, { status: 500 })
  }

  return new NextResponse(null, { status: 204 })
}
```

- [ ] **Step 2: Test PATCH (toggle alert on free plan — should fail)**

Use the `id` from the search created in Task 2. In browser console:
```javascript
const id = '<paste-id-from-task-2>'
fetch(`/api/saved-searches/${id}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ alertEnabled: true })
}).then(r => r.json()).then(console.log)
```
Expected: `{ error: 'upgrade_required' }` with HTTP 403 (for free plan users).

- [ ] **Step 3: Test DELETE**

```javascript
fetch(`/api/saved-searches/${id}`, { method: 'DELETE' }).then(r => console.log(r.status))
```
Expected: `204`. Verify in Supabase dashboard that the row is gone.

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/saved-searches/[id]/route.ts"
git commit -m "feat: PATCH + DELETE /api/saved-searches/[id]"
```

---

## Task 4: SaveSearchModal component

**Files:**
- Create: `src/components/SaveSearchModal.tsx`

**Context:** Modal receives search params from parent. On save it calls `POST /api/saved-searches`, shows errors inline, and calls `onSaved(search)` on success so the parent can update state. No router navigation — the user stays on the search page.

- [ ] **Step 1: Create the component**

```typescript
// src/components/SaveSearchModal.tsx
'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import type { SavedSearch } from '@/types/saved-search'

interface SaveSearchModalProps {
  isOpen: boolean
  onClose: () => void
  defaultName: string
  zip: string
  radius: number
  category: string
  keyword?: string
  savedCount: number
  isPaidUser: boolean
  onSaved: (search: SavedSearch) => void
}

export function SaveSearchModal({
  isOpen,
  onClose,
  defaultName,
  zip,
  radius,
  category,
  keyword,
  savedCount,
  isPaidUser,
  onSaved,
}: SaveSearchModalProps) {
  const [name, setName] = useState(defaultName)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Sync name when defaultName changes (new search performed)
  useEffect(() => {
    setName(defaultName)
    setError(null)
  }, [defaultName])

  if (!isOpen) return null

  const atLimit = !isPaidUser && savedCount >= 8

  async function handleSave() {
    if (atLimit || !name.trim()) return
    setIsSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/saved-searches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), zip, radius, category, keyword }),
      })
      const data = await res.json() as { search?: SavedSearch; error?: string }
      if (!res.ok) {
        if (data.error === 'limit_reached') {
          setError("You've reached the 8 search limit on the free plan.")
        } else {
          setError('Failed to save search. Please try again.')
        }
        return
      }
      onSaved(data.search!)
      onClose()
    } catch {
      setError('Failed to save search. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-900">Save this search</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="h-4 w-4 shrink-0" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="save-search-name"
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              Name
            </label>
            <input
              id="save-search-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="e.g. HVAC contractors near 90210"
            />
          </div>

          {!isPaidUser && (
            <p className="text-xs text-slate-400">
              {savedCount} of 8 searches used on free plan
            </p>
          )}

          {error && (
            <p className="text-xs text-red-600">{error}</p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !name.trim() || atLimit}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Saving…' : 'Save search'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/SaveSearchModal.tsx
git commit -m "feat: SaveSearchModal component"
```

---

## Task 5: Add "Save this search" button to search page + nav item

**Files:**
- Modify: `src/app/(dashboard)/search/page.tsx`
- Modify: `src/app/(dashboard)/layout.tsx`

**Context:**
- The search page already tracks `userPlan` state (values: `'free' | 'pro' | 'agency'`).
- `handleSearch` is the callback that fires on each search — add `setLastSearchParams(params)` inside it after results load.
- The results toolbar is inside `{(hasSearched || leads.length > 0) && (…)}` around line 490.
- The "Save this search" button should only appear when `leads.length > 0 && !isLoading && searchMode === 'single'`.
- Layout `NAV_ITEMS` array is at line 26; add the new item between "Search Leads" and "Saved Leads".

- [ ] **Step 1: Add imports to search page**

At the top of `src/app/(dashboard)/search/page.tsx`, add to the existing lucide-react import:
```typescript
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
  Bell,  // ← add this
} from 'lucide-react'
```

And add these two new imports after the existing import block:
```typescript
import { SaveSearchModal } from '@/components/SaveSearchModal'
import type { SavedSearch } from '@/types/saved-search'
```

- [ ] **Step 2: Add state inside SearchPageInner**

Add these four new `useState` declarations alongside the existing ones (after `searchedZipCount`):

```typescript
const [lastSearchParams, setLastSearchParams] = useState<SearchParams | null>(null)
const [saveModalOpen, setSaveModalOpen] = useState(false)
const [savedSearchCount, setSavedSearchCount] = useState(0)
const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([])
```

- [ ] **Step 3: Fetch saved search count on mount**

Add a new `useEffect` after the existing `userPlan` useEffect:

```typescript
useEffect(() => {
  fetch('/api/saved-searches')
    .then((r) => r.ok ? r.json() : { searches: [] })
    .then((data: { searches: SavedSearch[] }) => {
      setSavedSearches(data.searches)
      setSavedSearchCount(data.searches.length)
    })
    .catch(() => {})
}, [])
```

- [ ] **Step 4: Update handleSearch to capture last params**

Inside the `handleSearch` callback, right before `setLeads(filteredLeads)`, add:
```typescript
setLastSearchParams(params)
```

The modified section should look like:
```typescript
const result = await res.json() as { leads: Lead[]; total: number; center?: { lat: number; lon: number } }
const filteredLeads = params.excludeSaved
  ? result.leads.filter((l) => !savedLeadIds.has(l.id))
  : result.leads
setLastSearchParams(params)   // ← add this line
setLeads(filteredLeads)
setTotalFound(filteredLeads.length)
```

- [ ] **Step 5: Add "Save this search" button to the results toolbar**

Find the `<div className="flex items-center gap-2">` inside the results toolbar (it contains the Sort dropdown and view toggle buttons). Add the save button as the **first** child of that div:

```typescript
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
```

- [ ] **Step 6: Render the SaveSearchModal**

At the very end of the `SearchPageInner` return statement, just before the closing `</div>`, add:

```typescript
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
```

- [ ] **Step 7: Add nav item to layout**

In `src/app/(dashboard)/layout.tsx`, add `Bell` to the lucide-react import:

```typescript
import {
  MapPin,
  LayoutDashboard,
  Search,
  Bookmark,
  Clock,
  Download,
  Settings,
  Wrench,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Sun,
  Moon,
  Bell,   // ← add this
} from 'lucide-react'
```

Then update `NAV_ITEMS` to add the new entry between "Search Leads" and "Saved Leads":

```typescript
const NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Search Leads', href: '/search', icon: Search },
  { label: 'Saved Searches', href: '/saved-searches', icon: Bell },  // ← add this
  { label: 'Saved Leads', href: '/saved', icon: Bookmark },
  { label: 'Search History', href: '/history', icon: Clock },
  { label: 'Exports', href: '/exports', icon: Download },
  { label: 'Settings', href: '/settings', icon: Settings },
]
```

- [ ] **Step 8: Verify in browser**

1. Run a search with results — the "Save search" button should appear in the toolbar.
2. Click it — the modal opens, pre-filled with e.g. "hvac · 90210".
3. Edit the name and click "Save search" — modal closes, toast is not implemented yet (count updates silently).
4. Check the sidebar — "Saved Searches" nav item appears.
5. Run a bulk search — "Save search" button should NOT appear.

- [ ] **Step 9: Commit**

```bash
git add src/app/(dashboard)/search/page.tsx src/app/(dashboard)/layout.tsx
git commit -m "feat: add Save Search button to search page and nav item"
```

---

## Task 6: Saved Searches management page

**Files:**
- Create: `src/app/(dashboard)/saved-searches/page.tsx`

**Context:** Fetches saved searches from `GET /api/saved-searches`. Reads `users_profile.plan` via Supabase client to determine whether alert toggles are active. Alert toggle calls `PATCH /api/saved-searches/[id]`. Delete is optimistic (row removed from state immediately, API called in background).

- [ ] **Step 1: Create the page**

```typescript
// src/app/(dashboard)/saved-searches/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { Bell, Trash2, Search } from 'lucide-react'
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
  const [isPaidUser, setIsPaidUser] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
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
        if (res.ok) {
          const data = await res.json() as { searches: SavedSearch[] }
          setSearches(data.searches)
        }
      } catch { /* non-fatal */ } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

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
      await fetch(`/api/saved-searches/${id}`, { method: 'DELETE' })
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
          <h1 className="text-2xl font-bold text-slate-900">Saved Searches</h1>
          <p className="mt-1 text-sm text-slate-500">Get daily email alerts when new businesses match your search</p>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Saved Searches</h1>
        <p className="mt-1 text-sm text-slate-500">
          Get daily email alerts when new businesses match your search
        </p>
      </div>

      {searches.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-slate-200 bg-white py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50">
            <Bell className="h-7 w-7 text-blue-400" aria-hidden="true" />
          </div>
          <div>
            <p className="text-base font-semibold text-slate-700">No saved searches yet</p>
            <p className="mt-1 text-sm text-slate-400 max-w-xs">
              Run a search and click &ldquo;Save search&rdquo; to get started
            </p>
          </div>
          <a
            href="/search"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
          >
            <Search className="h-4 w-4 shrink-0" />
            Search Leads
          </a>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left">
                <th className="px-4 py-3 font-medium text-slate-500">Name</th>
                <th className="hidden px-4 py-3 font-medium text-slate-500 sm:table-cell">Location</th>
                <th className="hidden px-4 py-3 font-medium text-slate-500 md:table-cell">Category</th>
                <th className="px-4 py-3 text-center font-medium text-slate-500">Alerts</th>
                <th className="hidden px-4 py-3 font-medium text-slate-500 lg:table-cell">Last run</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {searches.map((search) => (
                <tr key={search.id} className="transition-colors hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{search.name}</td>
                  <td className="hidden px-4 py-3 text-slate-500 sm:table-cell">
                    {search.zip} · {search.radius} mi
                  </td>
                  <td className="hidden px-4 py-3 capitalize text-slate-500 md:table-cell">
                    {search.category}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {isPaidUser ? (
                      <button
                        onClick={() => handleToggleAlert(search)}
                        disabled={togglingId === search.id}
                        aria-label={search.alertEnabled ? 'Disable alert' : 'Enable alert'}
                        className={`inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                          search.alertEnabled ? 'bg-blue-600' : 'bg-slate-200'
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
                          className="inline-flex h-6 w-11 cursor-not-allowed items-center rounded-full bg-slate-200 opacity-50"
                        >
                          <span className="inline-block h-4 w-4 translate-x-1 transform rounded-full bg-white shadow" />
                        </button>
                        <div className="absolute bottom-full left-1/2 z-10 mb-1 hidden w-40 -translate-x-1/2 rounded-lg bg-slate-800 px-2 py-1.5 text-center text-xs text-white shadow-lg group-hover:block">
                          Upgrade to enable alerts
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="hidden px-4 py-3 text-xs text-slate-400 lg:table-cell">
                    {search.lastRunAt ? formatRelativeTime(search.lastRunAt) : 'Never'}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleDelete(search.id)}
                      disabled={deletingId === search.id}
                      aria-label="Delete saved search"
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5 shrink-0" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!isPaidUser && (
            <div className="border-t border-slate-100 px-4 py-3">
              <p className="text-xs text-slate-400">
                {searches.length} of 8 searches used on free plan ·{' '}
                <a href="/settings" className="text-blue-600 hover:underline">
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
```

- [ ] **Step 2: Verify in browser**

Navigate to `/saved-searches`.

Empty state: "No saved searches yet" message with a link to Search Leads.

After saving a search from the search page: reload `/saved-searches` — the row appears with Name, Location, Category, Alerts toggle (locked for free users), Last run = "Never", and a delete button.

Click delete — the row disappears immediately.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(dashboard)/saved-searches/page.tsx"
git commit -m "feat: Saved Searches management page"
```

---

## Task 7: Alert digest cron route + vercel.json

**Files:**
- Create: `src/app/api/cron/alert-digest/route.ts`
- Modify: `vercel.json`

**Context:**
- Uses `createClient` from `@supabase/supabase-js` with service role key to bypass RLS and access all users' rows. This pattern is identical to `src/app/api/auth/send-reset-email/route.ts`.
- Email sent via nodemailer/Gmail SMTP — same `GMAIL_USER` + `GMAIL_APP_PASSWORD` env vars as the password reset route.
- `searchLeadsCombined` is imported directly (not via HTTP) — same pattern as `src/app/api/cron/prefetch-leads/route.ts`.
- Snapshot update happens **after** email send. If email throws, the catch block skips the update — leads re-appear next run (safe retry).
- Existing `vercel.json` already has one cron (`/api/cron/prefetch-leads` at `0 3 * * *`). Append the new entry; do not replace.
- The cron route uses `POST` (not `GET` like the prefetch route) to match Vercel's recommended cron invocation pattern for data-mutating jobs.

- [ ] **Step 1: Create the cron route**

```typescript
// src/app/api/cron/alert-digest/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'
import { searchLeadsCombined } from '@/lib/providers/combinedProvider'
import type { SearchParams } from '@/types/lead'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://leadzip.vercel.app'

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
})

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Fetch all alert-enabled saved searches
  const { data: savedSearches, error: fetchError } = await supabase
    .from('saved_searches')
    .select('*')
    .eq('alert_enabled', true)

  if (fetchError) {
    console.error('alert-digest: failed to fetch saved searches', fetchError)
    return NextResponse.json({ error: 'Failed to fetch saved searches' }, { status: 500 })
  }

  if (!savedSearches || savedSearches.length === 0) {
    return NextResponse.json({ processed: 0, emailed: 0 })
  }

  // Batch-fetch user profiles for all unique user IDs
  const userIds = [...new Set(savedSearches.map((s) => s.user_id as string))]
  const { data: profiles } = await supabase
    .from('users_profile')
    .select('id, email, full_name')
    .in('id', userIds)

  const profileMap = new Map<string, { email: string; full_name?: string }>(
    (profiles ?? []).map((p) => [p.id as string, { email: p.email as string, full_name: p.full_name as string | undefined }])
  )

  let processed = 0
  let emailed = 0

  for (const row of savedSearches) {
    try {
      const params: SearchParams = {
        zipCode: row.zip as string,
        radiusMiles: row.radius as number,
        category: row.category as string,
        keyword: (row.keyword as string | null) ?? undefined,
      }

      const result = await searchLeadsCombined(params)
      const newIds = result.leads.map((l) => l.id)
      const lastIds: string[] = (row.last_place_ids as string[]) ?? []
      const newLeads = result.leads.filter((l) => !lastIds.includes(l.id))

      if (newLeads.length > 0) {
        const profile = profileMap.get(row.user_id as string)
        if (profile) {
          const firstName = profile.full_name?.split(' ')[0] ?? 'there'
          const n = newLeads.length
          const searchUrl = [
            `${siteUrl}/search`,
            `?zip=${encodeURIComponent(row.zip as string)}`,
            `&radius=${row.radius}`,
            `&category=${encodeURIComponent(row.category as string)}`,
            row.keyword ? `&keyword=${encodeURIComponent(row.keyword as string)}` : '',
          ].join('')

          const subject = `${n} new lead${n === 1 ? '' : 's'} — "${row.name}"`
          const businessList = newLeads.map((l) => l.businessName).join('\n')
          const text = [
            `Hey ${firstName},`,
            '',
            `Your saved search "${row.name}" found ${n} new business${n === 1 ? '' : 'es'} since yesterday.`,
            '',
            `→ View in LeadZip: ${searchUrl}`,
            '',
            '────',
            businessList,
            '',
            `Manage your saved searches:\n${siteUrl}/saved-searches`,
            '',
            '— LeadZip',
          ].join('\n')

          await transporter.sendMail({
            from: `"LeadZip" <${process.env.GMAIL_USER}>`,
            to: profile.email,
            subject,
            text,
          })

          emailed++
        }
      }

      // Update snapshot — only reached if email sent successfully (or no new leads)
      await supabase
        .from('saved_searches')
        .update({
          last_place_ids: newIds,
          last_run_at: new Date().toISOString(),
        })
        .eq('id', row.id as string)

      processed++
    } catch (err) {
      console.error(`alert-digest: failed for saved search ${row.id}`, err)
    }
  }

  return NextResponse.json({ processed, emailed })
}
```

- [ ] **Step 2: Update vercel.json**

The current `vercel.json` content:
```json
{
  "crons": [
    {
      "path": "/api/cron/prefetch-leads",
      "schedule": "0 3 * * *"
    }
  ]
}
```

Replace with:
```json
{
  "crons": [
    {
      "path": "/api/cron/prefetch-leads",
      "schedule": "0 3 * * *"
    },
    {
      "path": "/api/cron/alert-digest",
      "schedule": "0 9 * * *"
    }
  ]
}
```

- [ ] **Step 3: Manually trigger the cron route to verify**

With the dev server running, trigger it from a new terminal tab:
```bash
curl -s -X POST http://localhost:3000/api/cron/alert-digest \
  -H "Authorization: Bearer $(grep CRON_SECRET '/Users/ramifakhuri/Projects/Lead gen. website /leadzip/.env.local' | cut -d= -f2)" \
  | jq .
```

Expected: `{ "processed": 0, "emailed": 0 }` (no active alert searches yet — that's correct).

If `CRON_SECRET` is not set in `.env.local`, the route still runs (the guard only applies if `cronSecret` is truthy). In that case:
```bash
curl -s -X POST http://localhost:3000/api/cron/alert-digest | jq .
```

- [ ] **Step 4: End-to-end smoke test**

1. Save a search from the search page (Task 5).
2. In Supabase dashboard, manually set `alert_enabled = true` for that row (the toggle is locked for free users in the UI — bypass it in the DB directly for this test).
3. Trigger the cron again via curl.
4. Expected: `{ "processed": 1, "emailed": 0 }` if no new leads (all leads were just seen), or `{ "processed": 1, "emailed": 1 }` if new leads are found. Check the terminal for any error logs.
5. Verify `last_run_at` updated in Supabase dashboard.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/cron/alert-digest/route.ts vercel.json
git commit -m "feat: daily alert digest cron + vercel.json schedule"
```

---

## Self-Review Notes

**Spec coverage check:**
- ✅ Saved searches table (Task 1)
- ✅ Free plan: 8 search limit enforced in POST route (Task 2)
- ✅ Paid plan: unlimited + alert toggle (Task 3)
- ✅ SaveSearchModal (Task 4)
- ✅ "Save this search" button — single mode only (Task 5)
- ✅ "Saved Searches" nav item (Task 5)
- ✅ Saved Searches management page with table + delete + toggle (Task 6)
- ✅ Paid-only alert toggle with upgrade tooltip (Task 6)
- ✅ Last run column (Task 6)
- ✅ Cron route with CRON_SECRET auth (Task 7)
- ✅ Service role for cross-user data access (Task 7)
- ✅ Snapshot update after email send (Task 7)
- ✅ Simple plain-text email format (Task 7)
- ✅ vercel.json cron schedule 9 AM UTC (Task 7)

**Type consistency:**
- `SavedSearch` interface defined in Task 1, used consistently in Tasks 2–6
- `toSavedSearch()` helper duplicated in routes/[id]/route.ts — acceptable (no shared util to avoid over-engineering)
- `lastPlaceIds` (camelCase in TypeScript) ↔ `last_place_ids` (snake_case in DB) — consistent throughout

**New env var:** `CRON_SECRET` must be set on Vercel (Production + Preview) for cron security. It's already used by the existing prefetch-leads cron, so it's likely already configured.
