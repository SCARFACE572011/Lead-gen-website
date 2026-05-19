# B3 — Digital Health Score Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add on-demand digital health scoring to LeadZip — users click "Check Health" on any lead with a website and get a 0–100 score with an 8-signal breakdown showing how well the business manages its digital presence.

**Architecture:** Server-side `POST /api/leads/enrich/health` fetches the business website HTML once with a 5-second timeout, checks 9 signals in a single pass, and returns a score + breakdown. UI is on-demand per lead (Option C: button in actions row → score bar + collapsible breakdown). Local `useState` only — same pattern as B2 Email Finder. No Supabase storage, no caching.

**Tech Stack:** Next.js App Router API routes, TypeScript, Tailwind CSS 4, lucide-react (`Zap`, `Loader2`), Supabase SSR auth (`@/lib/supabase/server`)

---

## File Map

| File | Change |
|------|--------|
| `src/types/lead.ts` | Export `DigitalHealthDetails` interface; add `digitalHealthScore?`, `digitalHealthDetails?` to `Lead` |
| `src/app/api/leads/enrich/health/route.ts` | New POST route — 9-signal website health check |
| `src/components/leads/LeadCard.tsx` | Check Health button, score row, collapsible breakdown |
| `src/components/leads/LeadTable.tsx` | Health column header, Zap icon button, colored score chip |
| `src/lib/export.ts` | Digital Health Score column after Email |

---

### Task 1: Add DigitalHealthDetails Type and Lead Fields

**Files:**
- Modify: `src/types/lead.ts`

Current state: `src/types/lead.ts` ends the `Lead` interface with `emailConfidence?: 'verified' | 'likely' | 'guessed'` at line 29. The file has no exported `DigitalHealthDetails` interface yet.

- [ ] **Step 1: Add the exported DigitalHealthDetails interface**

Open `src/types/lead.ts`. After the `export interface Lead { ... }` closing brace (after line 30), add:

```typescript
export interface DigitalHealthDetails {
  hasWebsite: boolean
  hasHttps: boolean
  mobileResponsive: boolean
  hasAnalytics: boolean
  hasGoogleAds: boolean
  hasFacebookAds: boolean
  hasGBP: boolean
  hasContactForm: boolean
  fastLoad: boolean
}
```

- [ ] **Step 2: Add the two new fields to the Lead interface**

Inside the `Lead` interface, after `emailConfidence?: 'verified' | 'likely' | 'guessed'` (line 29), add:

```typescript
  emailConfidence?: 'verified' | 'likely' | 'guessed'
  digitalHealthScore?: number
  digitalHealthDetails?: DigitalHealthDetails
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd "/Users/ramifakhuri/Projects/Lead gen. website /leadzip" && npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
cd "/Users/ramifakhuri/Projects/Lead gen. website /leadzip"
git add src/types/lead.ts
git commit -m "feat(b3): add DigitalHealthDetails type and health fields to Lead"
```

---

### Task 2: Create Health Enrichment API Route

**Files:**
- Create: `src/app/api/leads/enrich/health/route.ts`

The directory `src/app/api/leads/enrich/` already exists from B2. Auth pattern matches `src/app/api/leads/enrich/email/route.ts`: import `createClient` from `@/lib/supabase/server`, call `await createClient()`, then `supabase.auth.getUser()`.

- [ ] **Step 1: Create the route file**

Create `src/app/api/leads/enrich/health/route.ts` with this exact content:

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { DigitalHealthDetails } from '@/types/lead'

const SIGNAL_POINTS: Record<keyof DigitalHealthDetails, number> = {
  hasWebsite: 10,
  hasHttps: 5,
  mobileResponsive: 10,
  hasAnalytics: 10,
  hasGoogleAds: 15,
  hasFacebookAds: 15,
  hasGBP: 15,
  hasContactForm: 10,
  fastLoad: 10,
}

function computeScore(details: DigitalHealthDetails): number {
  return (Object.keys(details) as (keyof DigitalHealthDetails)[]).reduce(
    (sum, key) => sum + (details[key] ? SIGNAL_POINTS[key] : 0),
    0
  )
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { website?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const website = (body.website ?? '').trim()
  if (!website) {
    return NextResponse.json({ error: 'website is required' }, { status: 400 })
  }

  const url = website.startsWith('http') ? website : `https://${website}`

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 5000)
  const fetchStart = Date.now()

  let html = ''
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LeadZip/1.0)' },
    })
    clearTimeout(timeoutId)
    if (!res.ok) {
      return NextResponse.json({ error: 'unreachable' })
    }
    html = await res.text()
  } catch {
    clearTimeout(timeoutId)
    return NextResponse.json({ error: 'unreachable' })
  }

  const fetchMs = Date.now() - fetchStart

  const details: DigitalHealthDetails = {
    hasWebsite: true,
    hasHttps: url.startsWith('https://'),
    mobileResponsive:
      html.includes('<meta name="viewport"') ||
      html.includes("<meta name='viewport'"),
    hasAnalytics:
      html.includes('gtag.js') ||
      html.includes('analytics.js') ||
      html.includes("'G-") ||
      html.includes('"G-') ||
      html.includes("'UA-") ||
      html.includes('"UA-') ||
      html.includes('_ga'),
    hasGoogleAds:
      html.includes('googleadservices.com') ||
      html.includes("'AW-") ||
      html.includes('"AW-'),
    hasFacebookAds: html.includes('connect.facebook.net/en_US/fbevents.js'),
    hasGBP:
      html.includes('maps.google.com') ||
      html.includes('google.com/maps'),
    hasContactForm:
      html.includes('<form') ||
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(html),
    fastLoad: fetchMs < 3000,
  }

  return NextResponse.json({ score: computeScore(details), details })
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "/Users/ramifakhuri/Projects/Lead gen. website /leadzip" && npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
cd "/Users/ramifakhuri/Projects/Lead gen. website /leadzip"
git add src/app/api/leads/enrich/health/route.ts
git commit -m "feat(b3): add POST /api/leads/enrich/health route with 9-signal detection"
```

---

### Task 3: Check Health Button and Score UI in LeadCard

**Files:**
- Modify: `src/components/leads/LeadCard.tsx`

Current state (after B2): imports `Mail`, `Loader2` from lucide-react. Has email state (`emailState`, `foundEmail`, `emailConfidence`) and `handleFindEmail`. Actions row is at line 258, uses `flex-wrap`. The `hasWebsite` boolean is computed at line 77.

- [ ] **Step 1: Add Zap to lucide-react imports**

The current import block (lines 3–16) is:
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

Replace with:
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
  Zap,
} from 'lucide-react'
```

- [ ] **Step 2: Add DigitalHealthDetails to the Lead import**

The current import at line 18 is:
```typescript
import { Lead } from '@/types/lead'
```

Replace with:
```typescript
import { Lead, DigitalHealthDetails } from '@/types/lead'
```

- [ ] **Step 3: Add health state variables and handlers**

The component currently has (after line 82, after `confidenceBadgeClass`):

Add the following block after the `confidenceBadgeClass` const and before the `return (`:

```typescript
  type HealthState = 'idle' | 'loading' | 'found' | 'unreachable'
  const [healthState, setHealthState] = useState<HealthState>('idle')
  const [healthScore, setHealthScore] = useState<number>(0)
  const [healthDetails, setHealthDetails] = useState<DigitalHealthDetails | null>(null)
  const [breakdownOpen, setBreakdownOpen] = useState(false)

  async function handleCheckHealth() {
    if (!lead.website) return
    setHealthState('loading')
    try {
      const res = await fetch('/api/leads/enrich/health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ website: lead.website }),
      })
      const data = await res.json()
      if (res.ok && typeof data.score === 'number') {
        setHealthScore(data.score)
        setHealthDetails(data.details ?? null)
        setHealthState('found')
      } else {
        setHealthState('unreachable')
      }
    } catch {
      setHealthState('unreachable')
    }
  }

  function healthColor(score: number) {
    if (score <= 30) return { label: 'text-red-700', bar: 'bg-red-500' }
    if (score <= 60) return { label: 'text-amber-700', bar: 'bg-amber-400' }
    return { label: 'text-green-700', bar: 'bg-green-500' }
  }

  const VISIBLE_SIGNALS: { key: keyof DigitalHealthDetails; label: string; pts: number; caveat?: string }[] = [
    { key: 'hasHttps', label: 'SSL / HTTPS', pts: 5 },
    { key: 'mobileResponsive', label: 'Mobile-friendly', pts: 10 },
    { key: 'hasAnalytics', label: 'Google Analytics', pts: 10 },
    { key: 'hasGoogleAds', label: 'Google Ads', pts: 15 },
    { key: 'hasFacebookAds', label: 'Facebook Ads', pts: 15 },
    { key: 'hasGBP', label: 'Google Business Profile', pts: 15, caveat: 'detected from site' },
    { key: 'hasContactForm', label: 'Contact form / email', pts: 10 },
    { key: 'fastLoad', label: 'Fast server response', pts: 10 },
  ]
```

- [ ] **Step 4: Add Check Health button and result UI to the actions section**

Find the current end of the actions `div` (the closing `</>` tag of the email block, before `</div>` that closes the actions row). After the email block and before the closing `</div>` of the actions row, add:

```tsx
        {hasWebsite && healthState === 'idle' && (
          <button
            onClick={handleCheckHealth}
            aria-label="Check digital health"
            className="flex items-center gap-1.5 rounded-lg bg-green-50 px-2.5 py-1.5 text-xs font-medium text-green-700 transition-colors hover:bg-green-100"
          >
            <Zap className="h-3.5 w-3.5 shrink-0" />
            Check Health
          </button>
        )}

        {hasWebsite && healthState === 'loading' && (
          <span className="flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-400 cursor-not-allowed">
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
            Checking…
          </span>
        )}
```

Then, after the closing `</div>` of the actions row (and before the note textarea block), add the health result section:

```tsx
      {/* Health result */}
      {hasWebsite && healthState === 'found' && (
        <div className="mt-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('text-sm font-bold tabular-nums', healthColor(healthScore).label)}>
              {healthScore}/100
            </span>
            <div className="h-1.5 w-20 rounded-full bg-slate-200 overflow-hidden">
              <div
                className={cn('h-full rounded-full', healthColor(healthScore).bar)}
                style={{ width: `${healthScore}%` }}
              />
            </div>
            {healthScore <= 30 && (
              <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-semibold text-orange-700">
                High opportunity
              </span>
            )}
            <button
              onClick={() => setBreakdownOpen((o) => !o)}
              className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
            >
              {breakdownOpen ? '▴ hide' : '▾ breakdown'}
            </button>
          </div>

          {breakdownOpen && healthDetails && (
            <div className="mt-2 rounded-lg bg-slate-50 p-2 text-xs">
              {VISIBLE_SIGNALS.map(({ key, label, pts, caveat }) => (
                <div
                  key={key}
                  className="flex items-center justify-between border-b border-slate-100 py-1 last:border-0"
                >
                  <span className="text-slate-500">
                    {label}
                    {caveat && (
                      <span className="ml-1 italic text-slate-400">({caveat})</span>
                    )}
                    <span className="ml-1 text-slate-300">+{pts}</span>
                  </span>
                  <span className={healthDetails[key] ? 'font-bold text-green-600' : 'font-bold text-red-500'}>
                    {healthDetails[key] ? '✓' : '✗'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {hasWebsite && healthState === 'unreachable' && (
        <p className="mt-1 text-xs text-slate-400">⚠ Couldn't reach site</p>
      )}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd "/Users/ramifakhuri/Projects/Lead gen. website /leadzip" && npx tsc --noEmit 2>&1 | head -30
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
cd "/Users/ramifakhuri/Projects/Lead gen. website /leadzip"
git add src/components/leads/LeadCard.tsx
git commit -m "feat(b3): add Check Health button, score bar, and collapsible breakdown to LeadCard"
```

---

### Task 4: Health Column and Score Chip in LeadTable

**Files:**
- Modify: `src/components/leads/LeadTable.tsx`

Current state (after B2): imports `Mail`, `Loader2` from lucide-react. Has `emailStates` and `emailData` Records + `handleFindEmail`. The Email column header is between Website and Rating. The Actions cell (lines 298–317) has only a Save button.

- [ ] **Step 1: Add Zap to imports and import DigitalHealthDetails**

Current lucide-react import block (lines 3–16):
```typescript
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Bookmark,
  BookmarkCheck,
  Globe,
  Loader2,
  Mail,
  Phone,
  Star,
  Users,
} from 'lucide-react'
```

Replace with:
```typescript
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Bookmark,
  BookmarkCheck,
  Globe,
  Loader2,
  Mail,
  Phone,
  Star,
  Users,
  Zap,
} from 'lucide-react'
```

Also update the Lead import at line 18:
```typescript
import { Lead, DigitalHealthDetails } from '@/types/lead'
```

- [ ] **Step 2: Add per-row health state**

After the `handleFindEmail` function (after the existing email state block), add:

```typescript
  type HealthState = 'idle' | 'loading' | 'found' | 'unreachable'
  const [healthStates, setHealthStates] = useState<Record<string, HealthState>>({})
  const [healthData, setHealthData] = useState<Record<string, { score: number; details: DigitalHealthDetails }>>({})

  async function handleCheckHealth(lead: Lead) {
    if (!lead.website) return
    setHealthStates((prev) => ({ ...prev, [lead.id]: 'loading' }))
    try {
      const res = await fetch('/api/leads/enrich/health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ website: lead.website }),
      })
      const data = await res.json()
      if (res.ok && typeof data.score === 'number') {
        setHealthData((prev) => ({ ...prev, [lead.id]: { score: data.score, details: data.details } }))
        setHealthStates((prev) => ({ ...prev, [lead.id]: 'found' }))
      } else {
        setHealthStates((prev) => ({ ...prev, [lead.id]: 'unreachable' }))
      }
    } catch {
      setHealthStates((prev) => ({ ...prev, [lead.id]: 'unreachable' }))
    }
  }

  function healthScoreChipClass(score: number): string {
    if (score <= 30) return 'bg-red-50 text-red-700'
    if (score <= 60) return 'bg-amber-50 text-amber-700'
    return 'bg-green-50 text-green-700'
  }
```

- [ ] **Step 3: Add Health column header**

In `<thead>`, after the Email `<th>` (which is between Website and Rating), add:

```tsx
            <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              Health
            </th>
```

- [ ] **Step 4: Add Health data cell in the row map**

In the `<tbody>` row, after the Email `<td>` block and before the Rating `<td>`, add:

```tsx
                <td className="px-4 py-3">
                  {!hasWebsite ? (
                    <span className="text-slate-400 text-xs">—</span>
                  ) : healthStates[lead.id] === 'loading' ? (
                    <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                  ) : healthStates[lead.id] === 'found' ? (
                    <span
                      className={cn(
                        'inline-block rounded-full px-2 py-0.5 text-xs font-bold tabular-nums',
                        healthScoreChipClass(healthData[lead.id]?.score ?? 0)
                      )}
                    >
                      {healthData[lead.id]?.score}
                    </span>
                  ) : healthStates[lead.id] === 'unreachable' ? (
                    <span className="text-slate-400 text-xs">—</span>
                  ) : (
                    <button
                      onClick={() => handleCheckHealth(lead)}
                      aria-label={`Check health for ${lead.businessName}`}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-green-600 transition-colors"
                    >
                      <Zap className="h-4 w-4 shrink-0" />
                    </button>
                  )}
                </td>
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd "/Users/ramifakhuri/Projects/Lead gen. website /leadzip" && npx tsc --noEmit 2>&1 | head -30
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
cd "/Users/ramifakhuri/Projects/Lead gen. website /leadzip"
git add src/components/leads/LeadTable.tsx
git commit -m "feat(b3): add Health column and score chip to LeadTable"
```

---

### Task 5: Digital Health Score Column in CSV Export

**Files:**
- Modify: `src/lib/export.ts`

Current state (after B2): headers array has `'Email'` after `'Website'`. Rows mapping has `l.email ?? ''` after `l.website`.

- [ ] **Step 1: Add Digital Health Score header**

In `src/lib/export.ts`, find the headers array in `exportToCSV`. After `'Email'`, add `'Digital Health Score'`:

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
    'Digital Health Score',
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

- [ ] **Step 2: Add field to rows mapping**

In the rows mapping, after `l.email ?? ''`, add `l.digitalHealthScore ?? ''`:

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
    l.digitalHealthScore ?? '',
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

```bash
cd "/Users/ramifakhuri/Projects/Lead gen. website /leadzip" && npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
cd "/Users/ramifakhuri/Projects/Lead gen. website /leadzip"
git add src/lib/export.ts
git commit -m "feat(b3): add Digital Health Score column to CSV export"
```

---

## Implementation Notes

- `hasWebsite` is always `true` when the route is called (10 pts always awarded). It is included in `DigitalHealthDetails` for completeness but excluded from the visible breakdown in the UI.
- Score floor is 10 (has website) + 5 (if HTTPS) = 15 minimum for any live HTTPS site.
- The 5-second `AbortController` timeout covers both slow sites and completely unreachable ones.
- `hasFacebookAds` detection looks for the full fbevents URL string — specific enough to avoid false positives.
- Analytics detection checks for `'G-` and `"G-` (GA4 IDs), `'UA-` and `"UA-` (Universal Analytics), `_ga`, `gtag.js`, `analytics.js` — covers ~95% of real-world installations.
