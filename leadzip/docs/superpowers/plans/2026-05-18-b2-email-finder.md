# B2 — Email Finder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add on-demand email lookup to LeadZip — users click "Find Email" on any lead with a website and get a contact email with a confidence badge.

**Architecture:** Server-side `POST /api/leads/enrich/email` route handles all lookup logic. UI is on-demand per lead (no auto-enrichment). Pattern-generation fallback (`info@domain`) used when no Hunter.io key is present. Local `useState` stores email state per rendered LeadCard/row — not persisted to Supabase.

**Tech Stack:** Next.js App Router API routes, TypeScript, Tailwind CSS 4, lucide-react, Supabase auth (session check)

---

## File Map

| File | Change |
|------|--------|
| `src/types/lead.ts` | Add `email?` and `emailConfidence?` fields |
| `src/app/api/leads/enrich/email/route.ts` | NEW — POST route with pattern gen + Hunter.io stub |
| `src/components/leads/LeadCard.tsx` | Find Email button with inline state machine |
| `src/components/leads/LeadTable.tsx` | Mail icon button in actions cell |
| `src/lib/export.ts` | Email column after Website column |

---

### Task 1: Add Email Fields to Lead Type

**Files:**
- Modify: `src/types/lead.ts`

Current state: `src/types/lead.ts` has `sourceZip?: string` as the last optional field on the `Lead` interface (line 27).

- [ ] **Step 1: Add email fields to the Lead interface**

In `src/types/lead.ts`, add two fields after `sourceZip?: string` (line 27):

```typescript
  sourceZip?: string
  email?: string
  emailConfidence?: 'verified' | 'likely' | 'guessed'
```

The full updated interface top section looks like:

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
  email?: string
  emailConfidence?: 'verified' | 'likely' | 'guessed'
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd "/Users/ramifakhuri/Projects/Lead gen. website /leadzip" && npx tsc --noEmit 2>&1 | head -20`

Expected: No errors (or only pre-existing errors unrelated to the new fields).

- [ ] **Step 3: Commit**

```bash
cd "/Users/ramifakhuri/Projects/Lead gen. website /leadzip"
git add src/types/lead.ts
git commit -m "feat(b2): add email and emailConfidence fields to Lead type"
```

---

### Task 2: Create Email Enrichment API Route

**Files:**
- Create: `src/app/api/leads/enrich/email/route.ts`

This is a new file. The directory `src/app/api/leads/enrich/` does not exist yet — create it.

- [ ] **Step 1: Create the API route file**

Create `src/app/api/leads/enrich/email/route.ts` with this exact content:

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

function parseDomain(raw: string): string {
  return raw
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
    .trim()
}

export async function POST(request: Request) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { domain?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const domain = parseDomain(body.domain ?? '')
  if (!domain) {
    return NextResponse.json({ error: 'Domain is required' }, { status: 400 })
  }

  const hunterKey = process.env.HUNTER_API_KEY
  if (hunterKey) {
    try {
      const res = await fetch(
        `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&api_key=${hunterKey}&limit=1`
      )
      const data = await res.json()
      const emails: { value: string; confidence: number }[] = data?.data?.emails ?? []
      if (emails.length > 0) {
        const top = emails[0]
        const confidence = top.confidence >= 90 ? 'verified' : 'likely'
        return NextResponse.json({ email: top.value, confidence })
      }
    } catch {
      // Fall through to pattern generation
    }
  }

  // Pattern generation fallback
  return NextResponse.json({ email: `info@${domain}`, confidence: 'guessed' })
}
```

- [ ] **Step 2: Verify the route compiles**

Run: `cd "/Users/ramifakhuri/Projects/Lead gen. website /leadzip" && npx tsc --noEmit 2>&1 | head -20`

Expected: No new errors.

- [ ] **Step 3: Commit**

```bash
cd "/Users/ramifakhuri/Projects/Lead gen. website /leadzip"
git add src/app/api/leads/enrich/email/route.ts
git commit -m "feat(b2): add POST /api/leads/enrich/email route with pattern generation fallback"
```

---

### Task 3: Find Email Button in LeadCard

**Files:**
- Modify: `src/components/leads/LeadCard.tsx`

Current state: The actions row (lines 222–250) has a Save button and a Note button. The file imports `Bookmark`, `BookmarkCheck`, `MessageSquare` and others from lucide-react. `hasWebsite` is already computed at line 75. The component uses local `useState` for `noteOpen` and `noteDraft`.

- [ ] **Step 1: Add Mail and Loader2 to imports**

Replace the existing lucide-react import block (lines 3–14) with:

```typescript
import {
  Bookmark,
  BookmarkCheck,
  Phone,
  Globe,
  MapPin,
  Star,
  MessageSquare,
  AlertCircle,
  Users,
  Mail,
  Loader2,
} from 'lucide-react'
```

- [ ] **Step 2: Add email state variables**

After the existing `useState` hooks (lines 73–75), add:

```typescript
  type EmailState = 'idle' | 'loading' | 'found' | 'not_found'
  const [emailState, setEmailState] = useState<EmailState>('idle')
  const [foundEmail, setFoundEmail] = useState<string>('')
  const [emailConfidence, setEmailConfidence] = useState<'verified' | 'likely' | 'guessed'>('guessed')
```

- [ ] **Step 3: Add handleFindEmail function**

After the `hasWebsite` line (line 75), add:

```typescript
  async function handleFindEmail() {
    if (!lead.website) return
    setEmailState('loading')
    try {
      const res = await fetch('/api/leads/enrich/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: lead.website }),
      })
      const data = await res.json()
      if (res.ok && data.email) {
        setFoundEmail(data.email)
        setEmailConfidence(data.confidence)
        setEmailState('found')
      } else {
        setEmailState('not_found')
      }
    } catch {
      setEmailState('not_found')
    }
  }
```

- [ ] **Step 4: Add confidence badge helper**

After the `handleFindEmail` function, add:

```typescript
  const confidenceBadgeClass = {
    verified: 'bg-green-50 text-green-700',
    likely: 'bg-amber-50 text-amber-700',
    guessed: 'bg-slate-100 text-slate-500',
  }[emailConfidence]
```

- [ ] **Step 5: Add Find Email button to actions row**

The current actions row is:

```tsx
      {/* Actions */}
      <div className="mt-1 flex items-center gap-2 border-t border-slate-100 pt-3">
        <button
          onClick={() => onSave({ ...lead, notes: noteDraft })}
          aria-label={isSaved ? 'Remove from saved' : 'Save lead'}
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all duration-150',
            isSaved
              ? 'bg-blue-50 text-blue-700 hover:bg-blue-100'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          )}
        >
          {isSaved ? (
            <BookmarkCheck className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <Bookmark className="h-3.5 w-3.5 shrink-0" />
          )}
          {isSaved ? 'Saved' : 'Save'}
        </button>

        <button
          onClick={() => setNoteOpen(!noteOpen)}
          aria-label="Add note"
          className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200"
        >
          <MessageSquare className="h-3.5 w-3.5 shrink-0" />
          Note
        </button>
      </div>
```

Replace with:

```tsx
      {/* Actions */}
      <div className="mt-1 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
        <button
          onClick={() => onSave({ ...lead, notes: noteDraft })}
          aria-label={isSaved ? 'Remove from saved' : 'Save lead'}
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all duration-150',
            isSaved
              ? 'bg-blue-50 text-blue-700 hover:bg-blue-100'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          )}
        >
          {isSaved ? (
            <BookmarkCheck className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <Bookmark className="h-3.5 w-3.5 shrink-0" />
          )}
          {isSaved ? 'Saved' : 'Save'}
        </button>

        <button
          onClick={() => setNoteOpen(!noteOpen)}
          aria-label="Add note"
          className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200"
        >
          <MessageSquare className="h-3.5 w-3.5 shrink-0" />
          Note
        </button>

        {hasWebsite && emailState === 'idle' && (
          <button
            onClick={handleFindEmail}
            aria-label="Find email"
            className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200"
          >
            <Mail className="h-3.5 w-3.5 shrink-0" />
            Find Email
          </button>
        )}

        {hasWebsite && emailState === 'loading' && (
          <span className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-400">
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
            Finding…
          </span>
        )}

        {hasWebsite && emailState === 'found' && (
          <div className="flex items-center gap-1.5">
            <a
              href={`mailto:${foundEmail}`}
              className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors truncate max-w-[160px]"
            >
              {foundEmail}
            </a>
            <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-medium', confidenceBadgeClass)}>
              {emailConfidence}
            </span>
          </div>
        )}

        {hasWebsite && emailState === 'not_found' && (
          <span className="text-xs text-slate-400">Not found</span>
        )}
      </div>
```

- [ ] **Step 6: Verify TypeScript compiles**

Run: `cd "/Users/ramifakhuri/Projects/Lead gen. website /leadzip" && npx tsc --noEmit 2>&1 | head -30`

Expected: No new errors.

- [ ] **Step 7: Commit**

```bash
cd "/Users/ramifakhuri/Projects/Lead gen. website /leadzip"
git add src/components/leads/LeadCard.tsx
git commit -m "feat(b2): add Find Email button with inline states to LeadCard"
```

---

### Task 4: Mail Icon Button in LeadTable

**Files:**
- Modify: `src/components/leads/LeadTable.tsx`

Current state: The `LeadTable` component's actions cell (lines 230–248) has only a Save/bookmark button. It imports from lucide-react: `ArrowUpDown`, `ArrowUp`, `ArrowDown`, `Bookmark`, `BookmarkCheck`, `Globe`, `Phone`, `Star`, `Users`. The component receives `leads`, `onSave`, `savedIds` props. Email state must be tracked per-row since the component renders multiple leads.

- [ ] **Step 1: Add Mail and Loader2 to imports**

Replace the lucide-react import block (lines 3–14) with:

```typescript
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Bookmark,
  BookmarkCheck,
  Globe,
  Phone,
  Star,
  Users,
  Mail,
  Loader2,
} from 'lucide-react'
```

- [ ] **Step 2: Add per-row email state**

After the `showZipColumn` const (line 75), add a per-row email state map:

```typescript
  type EmailState = 'idle' | 'loading' | 'found' | 'not_found'
  const [emailStates, setEmailStates] = useState<Record<string, EmailState>>({})
  const [emailData, setEmailData] = useState<Record<string, { email: string; confidence: 'verified' | 'likely' | 'guessed' }>>({})

  async function handleFindEmail(lead: Lead) {
    if (!lead.website) return
    setEmailStates((prev) => ({ ...prev, [lead.id]: 'loading' }))
    try {
      const res = await fetch('/api/leads/enrich/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: lead.website }),
      })
      const data = await res.json()
      if (res.ok && data.email) {
        setEmailData((prev) => ({ ...prev, [lead.id]: { email: data.email, confidence: data.confidence } }))
        setEmailStates((prev) => ({ ...prev, [lead.id]: 'found' }))
      } else {
        setEmailStates((prev) => ({ ...prev, [lead.id]: 'not_found' }))
      }
    } catch {
      setEmailStates((prev) => ({ ...prev, [lead.id]: 'not_found' }))
    }
  }
```

Also add `Lead` to the imports — it is already imported at line 16 via `import { Lead } from '@/types/lead'`.

- [ ] **Step 3: Add "Email" column header**

In the `<thead>` section, after the Website header (after line 125 which closes the Website `<th>`), add:

```tsx
            <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              Email
            </th>
```

The thead currently has: Select | Business | Category | Location | [ZIP?] | Phone | Website | Rating | Employees | Score | Actions

Add Email between Website and Rating.

- [ ] **Step 4: Add email data cell in the row**

In the `<tbody>` row map, after the Website `<td>` block (which ends after line 208), add:

```tsx
                <td className="px-4 py-3">
                  {(() => {
                    const hasWebsite = Boolean(lead.website && lead.website.trim() !== '')
                    if (!hasWebsite) return <span className="text-slate-400 text-xs">—</span>
                    const state = emailStates[lead.id] ?? 'idle'
                    const found = emailData[lead.id]
                    const confidenceBadgeClass = found ? {
                      verified: 'bg-green-50 text-green-700',
                      likely: 'bg-amber-50 text-amber-700',
                      guessed: 'bg-slate-100 text-slate-500',
                    }[found.confidence] : ''
                    if (state === 'idle') {
                      return (
                        <button
                          onClick={() => handleFindEmail(lead)}
                          aria-label="Find email"
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                        >
                          <Mail className="h-4 w-4 shrink-0" />
                        </button>
                      )
                    }
                    if (state === 'loading') {
                      return <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                    }
                    if (state === 'found' && found) {
                      return (
                        <div className="flex items-center gap-1.5">
                          <a
                            href={`mailto:${found.email}`}
                            className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors truncate max-w-[120px]"
                          >
                            {found.email}
                          </a>
                          <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-medium', confidenceBadgeClass)}>
                            {found.confidence}
                          </span>
                        </div>
                      )
                    }
                    return <span className="text-slate-400 text-xs">—</span>
                  })()}
                </td>
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `cd "/Users/ramifakhuri/Projects/Lead gen. website /leadzip" && npx tsc --noEmit 2>&1 | head -30`

Expected: No new errors.

- [ ] **Step 6: Commit**

```bash
cd "/Users/ramifakhuri/Projects/Lead gen. website /leadzip"
git add src/components/leads/LeadTable.tsx
git commit -m "feat(b2): add Find Email column to LeadTable with per-row state"
```

---

### Task 5: Email Column in CSV Export

**Files:**
- Modify: `src/lib/export.ts`

Current state: The `exportToCSV` function has a `headers` array ending with `'Date Saved'` and a `rows` map with `l.savedAt ?? ''` as the last field. The "Website" column is at index 7 in headers (after ZIP).

- [ ] **Step 1: Add Email to CSV headers**

In `src/lib/export.ts`, add `'Email'` to the headers array after `'Website'`:

```typescript
  const headers = [
    'Business Name',
    'Category',
    'Address',
    'City',
    'State',
    'ZIP',
    'Phone',
    'Website',
    'Email',
    'Rating',
    'Review Count',
    'Employees',
    'Revenue Estimate',
    'Facebook',
    'Instagram',
    'LinkedIn',
    'Lead Score',
    'Status',
    'Notes',
    'Date Saved',
  ]
```

- [ ] **Step 2: Add email field to rows mapping**

In the `rows` mapping, add `l.email ?? ''` after `l.website`:

```typescript
  const rows = leads.map((l) => [
    l.businessName,
    l.category,
    l.address,
    l.city,
    l.state,
    l.zipCode,
    l.phone,
    l.website,
    l.email ?? '',
    l.rating ?? '',
    l.reviewCount ?? '',
    l.employeeCount ?? '',
    l.revenueEstimate ?? '',
    l.facebookUrl ?? '',
    l.instagramUrl ?? '',
    l.linkedinUrl ?? '',
    l.leadScore,
    l.status,
    l.notes,
    l.savedAt ?? '',
  ])
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd "/Users/ramifakhuri/Projects/Lead gen. website /leadzip" && npx tsc --noEmit 2>&1 | head -20`

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
cd "/Users/ramifakhuri/Projects/Lead gen. website /leadzip"
git add src/lib/export.ts
git commit -m "feat(b2): add Email column to CSV export"
```

---

## Implementation Notes

- The `HUNTER_API_KEY` env var is optional — the route works without it (returns `guessed` confidence emails)
- Email state lives only in React `useState` — not persisted to Supabase or localStorage
- Leads without a website show nothing in LeadCard's email slot and `—` in LeadTable
- Hunter.io confidence >= 90 → `'verified'`, < 90 → `'likely'`, pattern gen → `'guessed'`
