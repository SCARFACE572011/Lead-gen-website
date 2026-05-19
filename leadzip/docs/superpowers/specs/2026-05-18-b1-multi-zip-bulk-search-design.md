# B1 — Multi-ZIP Bulk Search Design

**Date:** 2026-05-18
**Status:** Approved

---

## Context

LeadZip currently supports one ZIP code per search. Every major competitor (D7, Outscraper, UpLead, LeadScrape, Apollo) supports multi-territory search. This is table-stakes for agency users who cover multiple ZIP codes for a single client or campaign.

---

## Approach

Client-side fan-out: the search page fires one `POST /api/leads/search` per ZIP in parallel, merges and deduplicates results client-side, and renders them with a ZIP source badge on each lead. No new API routes. No schema changes. The existing search infrastructure is unchanged.

---

## UI

### Mode Toggle

A toggle at the top of the search filter panel switches between two modes:

```
[ Single ZIP ]  [ Bulk Search ]
```

In **Single ZIP** mode: everything is unchanged from today.

In **Bulk Search** mode: the ZIP code input is replaced by a tag/chip input.

### Tag/Chip ZIP Input

- Type a 5-digit ZIP and press Enter or comma to add it as a chip
- Each chip shows the ZIP code with an × button to remove it
- A counter below the input shows `3 / 10 ZIPs` (based on plan limit)
- Adding beyond the plan limit is blocked; the chip input shows a tooltip: *"Upgrade to Agency for up to 25 ZIPs"*
- All other filters (radius, category, keyword, rating, hasWebsite, hasPhone) apply across all ZIPs

### Pre-Search Warning

Before the user hits Search, a muted notice shows:
> *"This will use 5 of your remaining 12 searches."*

(Count = number of ZIP chips × 1 search each)

### Results

- Summary bar above results: *"247 results across 5 ZIP codes"*
- If any ZIPs returned zero results, a warning chip: *"No results for: 90210"*
- Each LeadCard shows a small ZIP badge in the top-right corner
- LeadTable gains a **ZIP** column
- Sorting, saving, bulk export all work identically to single-ZIP mode
- Card / Table / Map view toggle unchanged

### Loading State

While requests are in flight:
> *"Searching 5 ZIPs... (3/5 complete)"*

Results are not shown until all ZIPs resolve (no partial renders).

---

## Plan Limits

Enforced client-side. Current plan is available from the user session — no additional API calls.

| Plan | Max ZIPs |
|------|----------|
| Free | 3 |
| Pro | 10 |
| Agency | 25 |

---

## Data Flow

1. User enters ZIPs via chip input and hits **Search**
2. Page fires `Promise.all(zips.map(zip => POST /api/leads/search { ...params, zipCode: zip }))`
3. Progress counter increments as each promise settles
4. On all resolved:
   - Merge all result arrays into one flat list
   - Deduplicate by `businessName + address` (lowercased, trimmed) — keep the entry with the shorter `distanceMiles` when duplicates are found
   - Attach `sourceZip` field to each lead for badge display
   - Sort by `leadScore` descending
5. Render merged results

**Usage counting:** Each ZIP search counts as 1 search against the user's monthly limit. A 5-ZIP search costs 5 searches. Enforced by the existing `/api/leads/search` route — no change needed.

---

## Files Changed

| File | Change |
|------|--------|
| `src/app/(dashboard)/search/page.tsx` | Mode toggle state, bulk ZIP state, `Promise.all` fan-out, merge + dedup logic, progress UI, ZIP badge on results, summary bar, pre-search cost warning |
| `src/components/leads/SearchFilters.tsx` | Mode toggle UI, tag/chip ZIP input in bulk mode |
| `src/components/leads/LeadCard.tsx` | Optional `sourceZip` badge (top-right corner) |
| `src/components/leads/LeadTable.tsx` | Optional ZIP source column |
| `src/types/lead.ts` | Add `sourceZip?: string` field |

**No new pages. No new API routes. No database schema changes.**

---

## Out of Scope

- Saving bulk searches for re-run (covered by B4 — Saved Searches)
- Per-ZIP result tabs or grouped views (flat merged list only)
- CSV export changes (sourceZip column will be included naturally since it's on the lead object)
