# B3 — Digital Health Score Design

**Date:** 2026-05-19
**Status:** Approved

---

## Context

No competitor offers a comprehensive digital health score for local SMBs. D7 detects ad pixels; LeadScrape has basic SEO scoring. B3 wraps pixel detection inside a broader 9-signal health score that gives agencies a clear picture of a business's digital gaps — and a ready-made pitch.

The score is framed as a **lead opportunity signal**: low score = high opportunity for an agency to pitch digital services.

---

## Approach

On-demand per lead. User clicks "Check Health" on any LeadCard or LeadTable row that has a website. A server-side API route fetches the website HTML once, checks all 8 visible signals in a single pass, and returns the score and signal breakdown. No caching. No Supabase storage. State lives in local `useState` for the lifetime of the rendered result — same pattern as B2 Email Finder.

---

## API Route

**File:** `src/app/api/leads/enrich/health/route.ts`

**Method:** `POST`

**Request body:** `{ website: string }`

**Auth:** Requires valid Supabase session. Returns 401 if unauthenticated.

**Fetch behavior:** Server fetches the website URL with a 5-second timeout (`AbortController`). If the site is unreachable, times out, or returns a non-200 status, returns `{ error: 'unreachable' }` with HTTP 200.

**Signal detection** (checked in a single pass over the fetched HTML string and response metadata):

| Signal | Key | Points | Detection Method |
|--------|-----|--------|-----------------|
| Has website | `hasWebsite` | 10 | Always true when this route is called — baked into the score floor, not shown in the UI breakdown |
| SSL / HTTPS | `hasHttps` | 5 | Website URL starts with `https://` |
| Mobile-friendly | `mobileResponsive` | 10 | `<meta name="viewport"` present in HTML |
| Google Analytics | `hasAnalytics` | 10 | Any of: `gtag.js`, `analytics.js`, `'G-'`, `"G-"`, `'UA-'`, `"UA-"`, `_ga` in HTML |
| Google Ads | `hasGoogleAds` | 15 | `googleadservices.com`, `'AW-'`, or `"AW-"` in HTML |
| Facebook / Meta Ads | `hasFacebookAds` | 15 | `connect.facebook.net/en_US/fbevents.js` in HTML |
| Google Business Profile | `hasGBP` | 15 | `maps.google.com` or `google.com/maps` in HTML (best-effort — detects only if linked on the page) |
| Contact form or email | `hasContactForm` | 10 | `<form` tag or email regex (`[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}`) in HTML |
| Fast server response (<3s) | `fastLoad` | 10 | Time from fetch start to response end < 3000ms |

**Score computation:** Sum of points for all passing signals. Max 100. `hasWebsite` is always awarded (floor of 10) and is not shown in the UI breakdown since it can never fail for leads with a website.

**Response (success):**
```typescript
{
  score: number,
  details: {
    hasWebsite: boolean      // always true — not shown in UI breakdown
    hasHttps: boolean
    mobileResponsive: boolean
    hasAnalytics: boolean
    hasGoogleAds: boolean
    hasFacebookAds: boolean
    hasGBP: boolean
    hasContactForm: boolean
    fastLoad: boolean
  }
}
```

**Response (error):** `{ error: 'unreachable' }` with HTTP 200 (not a server error — the route worked, the site didn't respond).

---

## UI — LeadCard

**Trigger:** "Check Health" button in the actions row. Only shown when `lead.website` is non-empty. Uses the same `flex-wrap` actions row introduced in B2.

**Button styling:** `bg-green-50 text-green-700` — visually distinct from Save (slate), Note (slate), and Find Email (slate).

**States:**

| State | Display |
|-------|---------|
| Idle | `Zap` icon + "Check Health" label, green tint |
| Loading | `Loader2` spin + "Checking…" label, disabled, slate |
| Found | Button removed; score row appears below actions row |
| Unreachable | Button removed; "⚠ Couldn't reach site" muted text |

**Score row (found state):**

```
[score/100]  [progress bar]  [opportunity tag?]  [▾ breakdown]
```

- Score label color: red (`text-red-700`) for 0–30, amber (`text-amber-700`) for 31–60, green (`text-green-700`) for 61–100
- Progress bar track: `bg-slate-200`, fill: `bg-red-500` / `bg-amber-400` / `bg-green-500` based on score
- "High opportunity" tag (`bg-orange-50 text-orange-700`): shown only when score ≤ 30
- "▾ breakdown" link toggles the breakdown panel

**Breakdown panel (always collapsed by default, regardless of score):**

Small `bg-slate-50` panel below the score row. Shows 8 rows — one per visible signal (`hasWebsite` is excluded). Each row:

```
[Signal name]  [+pts]    [✓ or ✗]
```

| Visible signal | Display name |
|----------------|-------------|
| `hasHttps` | SSL / HTTPS |
| `mobileResponsive` | Mobile-friendly |
| `hasAnalytics` | Google Analytics |
| `hasGoogleAds` | Google Ads |
| `hasFacebookAds` | Facebook Ads |
| `hasGBP` | Google Business Profile |
| `hasContactForm` | Contact form / email |
| `fastLoad` | Fast server response |

- Pass: green checkmark (`text-green-700`)
- Fail: red cross (`text-red-500`)
- Point values shown in muted text (`text-slate-400`)
- GBP row includes a `(detected from site)` caveat in muted italic
- `fastLoad` row label is "Fast server response" (not "website load speed")

**State storage:** Local `useState` in LeadCard. Not persisted to Supabase or localStorage.

---

## UI — LeadTable

**Actions cell:** `Zap` icon button added to the right of the Save and Mail buttons.

**States:**

| State | Display |
|-------|---------|
| Idle | `Zap` icon button, slate color |
| Loading | `Loader2` spin, disabled |
| Found | Colored score chip (e.g. `25` in red, `80` in green) |
| Unreachable | `—` |

No breakdown in table view — score chip only. Color thresholds same as LeadCard.

**State storage:** `Record<string, HealthState>` in LeadTable component via `useState`, keyed by `lead.id`. Same pattern as B2 email state in table.

---

## CSV Export

Add `Digital Health Score` column after the `Email` column in `src/lib/export.ts`.

Field: `l.digitalHealthScore ?? ''`

Since health state is stored in local component `useState` (not persisted to Supabase or attached back to the lead object), this column will always be empty for search-result exports. The column is included for forward compatibility — same pattern as the `Email` column from B2.

---

## Type Changes

**File:** `src/types/lead.ts`

Add after `emailConfidence?`:

```typescript
digitalHealthScore?: number
digitalHealthDetails?: {
  hasWebsite: boolean      // always true — not rendered in UI breakdown
  hasHttps: boolean
  mobileResponsive: boolean
  hasAnalytics: boolean
  hasGoogleAds: boolean
  hasFacebookAds: boolean
  hasGBP: boolean
  hasContactForm: boolean
  fastLoad: boolean        // true = server responded in < 3s
}
```

---

## Score Thresholds

| Range | Color | Label |
|-------|-------|-------|
| 0–30 | Red | "High opportunity" tag shown |
| 31–60 | Amber | No tag |
| 61–100 | Green | No tag |

---

## Files Changed

| File | Change |
|------|--------|
| `src/types/lead.ts` | Add `digitalHealthScore?`, `digitalHealthDetails?` |
| `src/app/api/leads/enrich/health/route.ts` | New route — 9-signal health check |
| `src/components/leads/LeadCard.tsx` | Check Health button + score row + breakdown panel |
| `src/components/leads/LeadTable.tsx` | Zap icon button + colored score chip |
| `src/lib/export.ts` | Digital Health Score column |

**No new Supabase tables. No schema migrations. No new env vars required.**

**Note on signal count:** 9 signals are computed server-side; 8 are displayed in the UI breakdown (`hasWebsite` is always true and excluded from the breakdown to avoid noise).

---

## Out of Scope

- Storing health results in Supabase
- Auto-running health checks on all search results
- Bulk "Check All" action
- PageSpeed Insights API integration (fetch time proxy is sufficient for v1)
- GBP verification via Google Places API
