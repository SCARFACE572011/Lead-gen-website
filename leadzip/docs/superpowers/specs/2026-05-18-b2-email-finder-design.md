# B2 — Email Finder Design

**Date:** 2026-05-18
**Status:** Approved

---

## Context

LeadZip currently has no contact email data. D7, UpLead, and LeadScrape all include email finding. This is the biggest data gap vs. competitors. B2 closes it with on-demand email lookup — users click "Find Email" on any lead with a website and get a contact email with a confidence indicator.

---

## Approach

Server-side API route (`POST /api/leads/enrich/email`) that:
- Uses Hunter.io Domain Search API when `HUNTER_API_KEY` is set in env
- Falls back to pattern generation (`info@`, `hello@`, `contact@`, `admin@`) when no key is present

UI is on-demand: the user clicks "Find Email" per lead. Found email replaces the button inline. No auto-enrichment on search results.

---

## API Route

**File:** `src/app/api/leads/enrich/email/route.ts`

**Method:** `POST`

**Request body:** `{ domain: string }`

**Auth:** Requires valid Supabase session. Returns 401 if unauthenticated.

**Domain parsing:** Strip `https://`, `http://`, `www.`, and trailing slashes from the input before processing. Return 400 if domain is empty after stripping.

**Logic:**

```
if HUNTER_API_KEY present:
  GET https://api.hunter.io/v2/domain-search?domain={domain}&api_key={key}&limit=1
  if result found: return { email: result.emails[0].value, confidence: 'verified' | 'likely' }
  if no result: fall through to pattern generation

else (no key):
  generate patterns: ['info', 'hello', 'contact', 'admin']
  return { email: `info@{domain}`, confidence: 'guessed' }
```

**Response (success):** `{ email: string, confidence: 'verified' | 'likely' | 'guessed' }`

**Response (error):** `{ error: string }` with appropriate HTTP status

**Hunter.io confidence mapping:**
- Hunter.io `confidence >= 90` → `'verified'`
- Hunter.io `confidence < 90` → `'likely'`
- Pattern generation → `'guessed'`

---

## UI — LeadCard

**Current actions row:** Save button + Note button

**Change:** Add a third "Find Email" button with a `Mail` icon.

**States:**

| State | Display |
|-------|---------|
| Idle | `Mail` icon + "Find Email" label, slate styling |
| Loading | `Loader2` spin icon + "Finding…" label, disabled |
| Found | `mailto:` link showing email address + confidence badge |
| Not found | Muted "Not found" text, non-interactive |

**Confidence badge colors:**
- `guessed` → grey (`bg-slate-100 text-slate-500`)
- `likely` → amber (`bg-amber-50 text-amber-700`)
- `verified` → green (`bg-green-50 text-green-700`)

**State storage:** Local `useState` in LeadCard — persists for the lifetime of the rendered result, not saved to Supabase or localStorage.

**Only shown when:** `lead.website` is non-empty. Leads without a website show nothing in this slot.

---

## UI — LeadTable

**Current actions cell:** Save/bookmark icon button only

**Change:** Add a `Mail` icon button to the right of the Save button.

**States:**

| State | Display |
|-------|---------|
| Idle | `Mail` icon button, slate color |
| Loading | `Loader2` spin icon, disabled |
| Found | Truncated email as `mailto:` link + inline confidence badge |
| Not found | `—` |

**Only shown when:** `lead.website` is non-empty.

---

## CSV Export

Add an "Email" column to the CSV export after the "Website" column.

- If `lead.email` is set: output the email address
- If not set: output empty string

**File:** `src/lib/export.ts` — add `'Email'` to headers array and `l.email ?? ''` to the row mapping.

---

## Type Changes

**File:** `src/types/lead.ts`

Add to `Lead` interface after `linkedinUrl`:

```typescript
email?: string
emailConfidence?: 'verified' | 'likely' | 'guessed'
```

---

## Files Changed

| File | Change |
|------|--------|
| `src/types/lead.ts` | Add `email?`, `emailConfidence?` fields |
| `src/app/api/leads/enrich/email/route.ts` | New route — pattern gen + Hunter.io stub |
| `src/components/leads/LeadCard.tsx` | Find Email button with inline email display |
| `src/components/leads/LeadTable.tsx` | Mail icon button in actions cell |
| `src/lib/export.ts` | Email column in CSV export |

**No new Supabase tables. No schema migrations. No new env vars required to ship** (Hunter.io is optional).

---

## Hunter.io Upgrade Path

When a Hunter.io key is available:
1. Add `HUNTER_API_KEY` to Vercel environment variables (Production + Preview + Development)
2. The API route automatically uses it — no UI changes needed

---

## Out of Scope

- Email verification (sending a test email to confirm deliverability)
- Storing found emails in Supabase
- Auto-enriching all search results
- Bulk "Find All Emails" action
