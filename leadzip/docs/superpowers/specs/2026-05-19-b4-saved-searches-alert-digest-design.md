# B4 — Saved Searches + Alert Digest Design

**Date:** 2026-05-19
**Status:** Approved

---

## Context

Competitors Apollo and UpLead offer saved search alerts; D7, Outscraper, and LeadScrape do not. B4 lets users save a search (ZIP + radius + category + keyword) and receive a daily email digest when new businesses appear. Low-digital-presence agencies and active prospectors are the primary audience — they run the same searches repeatedly and need to know when new targets show up.

---

## Approach

Snapshot-based, single-table architecture. One `saved_searches` row stores both the search params and the last result snapshot (`last_place_ids text[]`). A daily Vercel cron re-runs each active search, diffs against the snapshot, sends a plain-text email if new leads are found, then updates the snapshot.

No second "history" table. No per-lead storage of alert results. State is minimal and decays gracefully — if a cron run fails, the snapshot isn't updated and the same leads appear again next run (safe retry behavior).

---

## Plan Gating

| Plan | Saved searches | Alert emails |
|------|---------------|-------------|
| Free | Up to 8 | ✗ (toggle locked) |
| Paid | Unlimited | ✓ |

Limit enforced in the API route (count query before insert), not at the database level. Alert toggle shows a lock icon with "Upgrade to enable alerts" tooltip for free users.

---

## Schema

**File:** `supabase/migrations/20260519_saved_searches.sql`

```sql
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

No new env vars. No additional Supabase tables.

---

## API Routes

### `GET /api/saved-searches`
Returns all saved searches for the authenticated user, ordered by `created_at DESC`.

Auth: Supabase session required (401 if unauthenticated).

Response: `{ searches: SavedSearch[] }`

---

### `POST /api/saved-searches`
Creates a new saved search.

Auth: Supabase session required.

**Free plan limit:** Query `users_profile.plan` for the authenticated user. If `plan = 'free'`, count existing rows for that user. If `count >= 8`, return `{ error: 'limit_reached' }` with HTTP 403.

Request body:
```typescript
{
  name: string
  zip: string
  radius: number
  category: string
  keyword?: string
}
```

Creates row with `alert_enabled = false`, `last_place_ids = []`.

Response: `{ search: SavedSearch }`

---

### `PATCH /api/saved-searches/[id]`
Toggles `alert_enabled` for a saved search.

Auth: Supabase session required. RLS ensures user owns the row.

**Paid check:** If `alert_enabled` is being set to `true`, query `users_profile.plan` for the authenticated user. If `plan = 'free'`, return `{ error: 'upgrade_required' }` with HTTP 403.

Request body: `{ alertEnabled: boolean }`

Response: `{ search: SavedSearch }`

---

### `DELETE /api/saved-searches/[id]`
Deletes a saved search. RLS ensures user owns the row.

Auth: Supabase session required.

Response: HTTP 204.

---

### `POST /api/cron/alert-digest`
Vercel cron route. Runs daily at 9 AM UTC.

**Auth:** Vercel sets `Authorization: Bearer <CRON_SECRET>` on cron invocations. Route returns 401 if header is missing or doesn't match `process.env.CRON_SECRET`.

**Behavior:**
1. Fetch all `saved_searches` rows where `alert_enabled = true` (across all users). For each, also fetch the user's `email` and `full_name` from `users_profile` (join on `user_id`).
2. For each row, sequentially (not parallel — avoids Places API rate limits):
   a. Re-run the Google Places Nearby Search using `zip`, `radius`, `category`, `keyword` via a shared `runPlacesSearch({ zip, radius, category, keyword })` helper extracted from the search route (not an HTTP call to the route itself)
   b. Collect `place_id` and `name` from each result — names come from the search response, no extra API calls needed
   c. Diff: `newPlaceIds = newResults.filter(r => !last_place_ids.includes(r.place_id))`
   d. If `newPlaceIds.length > 0`: send plain-text email to `users_profile.email` addressed as `full_name.split(' ')[0] ?? 'there'`
   e. Update row: `last_place_ids = allNewIds`, `last_run_at = now()` — regardless of whether new leads were found
   f. **Exception:** If email send fails, do NOT update `last_place_ids` — leads will re-appear next run (safe retry)
3. Return HTTP 200 with summary `{ processed: N, emailed: M }`

**`vercel.json`:**
```json
{
  "crons": [
    { "path": "/api/cron/alert-digest", "schedule": "0 9 * * *" }
  ]
}
```

---

## Email Format

Sent via existing nodemailer/Gmail SMTP setup (same transport as password reset emails). Plain text only — no HTML.

**Subject:** `{N} new lead{s} — "{Search Name}"`

**Body:**
```
Hey {first name or "there"},

Your saved search "{name}" found {N} new business{es} since yesterday.

→ View in LeadZip: https://leadzip.vercel.app/search?zip={zip}&radius={radius}&category={category}

────
{Business Name 1}
{Business Name 2}
{Business Name 3}

Manage your saved searches:
https://leadzip.vercel.app/saved-searches

— LeadZip
```

If no new leads are found for a search, no email is sent. The snapshot and `last_run_at` are still updated.

---

## UI

### "Save this search" button

Added to `src/app/(dashboard)/search/page.tsx` in the results toolbar area. Only rendered when results have loaded (results array is non-empty). Clicking it opens `SaveSearchModal`.

---

### Save Search Modal (`src/components/SaveSearchModal.tsx`)

Simple dialog with:
- Name input, pre-filled with `"{category} · {zip}"` (e.g. "HVAC contractors · 90210")
- "Save" button
- For free users: muted note showing "X of 8 searches used"
- On success: modal closes, toast appears: "Saved! Turn on alerts from Saved Searches."
- On `limit_reached` 403: show inline error "You've reached the 8 search limit on the free plan."

---

### Saved Searches page (`src/app/(dashboard)/saved-searches/page.tsx`)

New dashboard page. New sidebar nav item: **"Saved Searches"** added to `src/app/(dashboard)/layout.tsx` between "Search Leads" and "Saved Leads".

**Table columns:**

| Name | Location | Category | Alerts | Last run | |
|------|----------|----------|--------|----------|---|
| HVAC near 90210 | 90210 · 10 mi | HVAC | Toggle | Yesterday | 🗑 |

- **Alerts column:** toggle switch. For paid users: functional. For free users: rendered disabled with a tooltip "Upgrade to enable alerts".
- **Last run:** relative time (e.g. "2 hours ago") or "Never" if `last_run_at` is null.
- **Delete:** icon button. Calls DELETE route immediately with optimistic removal from the list (no confirm dialog).
- Empty state: "No saved searches yet. Run a search and click 'Save this search' to get started."

---

## Type

**File:** `src/types/saved-search.ts` (new file)

```typescript
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

---

## Files Changed

| File | Change |
|------|--------|
| `supabase/migrations/20260519_saved_searches.sql` | New migration — `saved_searches` table + RLS |
| `src/types/saved-search.ts` | New — `SavedSearch` interface |
| `src/app/api/saved-searches/route.ts` | New — GET + POST |
| `src/app/api/saved-searches/[id]/route.ts` | New — PATCH + DELETE |
| `src/app/api/cron/alert-digest/route.ts` | New — daily cron job |
| `src/app/(dashboard)/saved-searches/page.tsx` | New — management page |
| `src/components/SaveSearchModal.tsx` | New — save search modal |
| `src/app/(dashboard)/search/page.tsx` | Modify — add "Save this search" button |
| `src/app/(dashboard)/layout.tsx` | Modify — add "Saved Searches" nav item |
| `vercel.json` | Modify — add cron schedule |

**New env var required:** `CRON_SECRET` — used to authenticate the Vercel cron invocation. Add to Vercel environment variables (Production + Preview).

**No new Supabase tables beyond** `saved_searches`. No new third-party services.

---

## Out of Scope

- Configurable alert frequency (daily/weekly per search) — fixed daily for v1
- In-app notifications (bell icon, unread count)
- Rich HTML email digest
- "Run now" manual trigger per saved search
- Bulk alert toggle
- Search history integration (showing saved searches in past searches)
- Alert for zero results (search that used to return results now returns none)
