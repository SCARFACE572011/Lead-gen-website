# LeadZip — Full Competitive Roadmap & Execution Plan
**Date:** 2026-05-15  
**Goal:** Turn every ❌ in the competitor matrix into a ✅ and make LeadZip the best local-SMB lead gen tool on the market.

---

## Context

LeadZip already has the single biggest differentiator in the market: **radius-based geographic search**. No competitor (D7, Outscraper, UpLead, LeadScrape, Apollo) offers a mile-radius filter. Everything below is about surrounding that advantage with the data depth, workflow features, and platform capabilities that agencies and sales teams need to choose LeadZip over everything else.

The work is divided into four phases, ordered A → B → C → D by impact-per-hour. Phase A items are achievable today.

---

## Current State (what's already done or in-progress)

- ✅ Radius search (unique to LeadZip)
- ✅ Lead scoring (0–100)
- ✅ Rating/review filter
- ✅ Card + table view
- ✅ Map view — **LeadsMap.tsx + LeadsMapWrapper.tsx exist**, map toggle added to search page, just needs center coords wired in
- ✅ Phone formatter — `lib/phoneFormatter.ts` built, used in OSM provider
- ✅ Save/status/notes/export pipeline
- ✅ Supabase auth + Stripe billing

---

## Phase A — Today (0–8 hours)
*Polish the existing app, fix all internal gaps, add quick-win data fields*

### A1. Complete Map View (30 min)
**Status:** 90% done — LeadsMap.tsx, LeadsMapWrapper.tsx, and view toggle all exist  
**Remaining:** Wire `centerLat` / `centerLon` from geocodeZip result into the search page so the map knows where to center  
**Files:** `src/app/(dashboard)/search/page.tsx`, `src/components/leads/LeadsMapWrapper.tsx`

Store the geocoded center in state after each search. Pass it to `LeadsMapWrapper`. Done.

---

### A2. Fix Notifications Persistence (45 min)
**Status:** All 5 toggle switches are local state only — Save button is a no-op  
**Fix:** On form submit, write preferences to `localStorage` under key `leadzip_notifications`. On mount, read them back. Show a toast on save success.  
**Files:** `src/app/(dashboard)/settings/page.tsx`

No Supabase schema change needed — localStorage is fine for notification prefs.

---

### A3. Fix Admin Access Control (20 min)
**Status:** `IS_ADMIN = true` hardcoded — anyone who knows `/admin` can access it  
**Fix:** Read the actual Supabase session on the server side. Check `users_profile.role === 'admin'`. If not admin, redirect to `/dashboard`.  
**Files:** `src/app/(dashboard)/admin/page.tsx`

---

### A4. Wire Dark Mode (30 min)
**Status:** `next-themes` installed but no toggle exists  
**Fix:** Wrap `layout.tsx` in `<ThemeProvider>`. Add a sun/moon icon toggle to the dashboard navbar. Update Tailwind config with `darkMode: 'class'`. Add `dark:` variants to key components.  
**Files:** `src/app/layout.tsx`, `src/app/(dashboard)/layout.tsx`, navbar component

---

### A5. Dashboard Chart — Real Data (30 min)
**Status:** Lead-by-category pie chart uses hardcoded mock data  
**Fix:** Read `search_history` from localStorage (already stored there). Aggregate `category` counts. Feed into the Recharts component. Falls back to mock if empty.  
**Files:** `src/app/(dashboard)/dashboard/page.tsx`

---

### A6. Enrich Lead Type — Social, Employee Count, Revenue (2 hours)
**What competitors have that we don't:** Social media profiles, employee count, revenue estimates  
**Approach:** Add new optional fields to `Lead` type. Populate them in `dynamicProvider.ts` (generated deterministically). Show them on `LeadCard` and `LeadTable`.

**New fields to add to `Lead` interface in `src/types/lead.ts`:**
```ts
facebook?: string        // e.g. "facebook.com/businessname"
instagram?: string       // e.g. "instagram.com/businessname"
linkedin?: string        // e.g. "linkedin.com/company/businessname"
employeeCount?: string   // e.g. "1-10", "11-50", "51-200"
revenueEstimate?: string // e.g. "$100K–$500K", "$500K–$1M"
yearFounded?: number     // e.g. 2015
```

**Dynamic provider:** Generate these deterministically using the same rand() seed. Employee count and revenue should correlate with business size implied by category.

**LeadCard:** Show social icons (FB, IG, LI) as small clickable links. Show employee count badge.

**LeadTable:** Add employee count column.

**Export:** Include new fields in CSV export options.

---

### A7. Fix Lead Save/Delete API (1 hour)
**Status:** `/api/leads/save` POST and DELETE have `// TODO: Save to Supabase` — currently no-ops  
**Fix:** Wire up actual Supabase insert/delete on the `leads` table. Keep localStorage as the primary cache for offline use; sync to Supabase when available.  
**Files:** `src/app/api/leads/save/route.ts`

---

## Phase B — This Week (Days 2–5)
*Data enrichment features that beat D7 and LeadScrape on data quality*

### B1. Multi-ZIP Bulk Search (4–6 hours)
**What it is:** Let users paste or enter multiple ZIP codes and run one search across all of them  
**UI:** "Bulk Search" tab or mode toggle in SearchFilters. Textarea for ZIP codes (one per line or comma-separated). Results pooled and deduped, showing which ZIP each lead is from.  
**Backend:** Loop `searchLeads()` for each ZIP, merge results, deduplicate by business name + address  
**Files:** New `src/app/(dashboard)/bulk-search/page.tsx`, or add bulk mode to existing search page  
**Competitor parity:** All major competitors have this. Table-stakes for agencies covering multiple territories.

---

### B2. Email Finder Integration (4–6 hours)
**What it is:** For each lead with a website, attempt to find a contact email  
**Approach:** Integrate Hunter.io Domain Search API (free tier: 25 req/mo, paid: $49/mo for 500). Fall back to pattern generation (`info@domain.com`, `hello@domain.com`) when no API key.  
**UI:** "Find Email" button on LeadCard and LeadTable row. Spinner while fetching. Email displayed with verification confidence badge.  
**New field on Lead type:** `email?: string`, `emailConfidence?: 'verified' | 'likely' | 'guessed'`  
**API route:** `POST /api/leads/enrich/email` — takes `{ domain: string }`, returns `{ email, confidence }`  
**Files:** New `src/app/api/leads/enrich/email/route.ts`, update LeadCard, LeadTable, export  
**Competitor parity:** D7, UpLead, LeadScrape all include email finding. This closes the biggest data gap.

---

### B3. Digital Health Score — Website + GBP + Ads (6–8 hours)
**What it is:** Per-lead score (0–100) showing how well a business manages its digital presence  
**This is our killer differentiator — no competitor does this comprehensively**

**Signals to detect (via website fetch + heuristics):**
| Signal | Points | How |
|--------|--------|-----|
| Has website | 10 | Already known |
| Website is mobile-responsive | 10 | Fetch page, check `<meta name="viewport">` |
| Has Google Analytics / GA4 | 10 | Scan for gtag.js / analytics.js in page source |
| Running Google Ads | 15 | Scan for `googleadservices.com` or `gtag('config', 'AW-')` |
| Running Facebook/Meta Ads | 15 | Scan for `connect.facebook.net/fbevents` |
| Has Google Business Profile | 15 | Presence of `maps.google.com` link or GBP embed on page |
| SSL/HTTPS | 5 | URL starts with https:// |
| Has contact form or email visible | 10 | Scan page for `<form>` or email pattern |
| Website loads fast (<3s) | 10 | Measure fetch time |

**UI:** New "Digital Health" badge on LeadCard (color-coded: red 0–30, amber 31–60, green 61+). Expandable breakdown showing each signal with pass/fail.  
**New fields:** `digitalHealthScore?: number`, `digitalHealthDetails?: Record<string, boolean>`  
**API route:** `POST /api/leads/enrich/health` — takes `{ website: string, leadId: string }`  
**Files:** New `src/app/api/leads/enrich/health/route.ts`, update LeadCard, LeadTable, export  
**Note:** Run health checks lazily (on-demand per lead) to avoid hammering sites on every search.

---

### B4. Saved Searches + Alert Digest (4–5 hours)
**What it is:** Save a search (ZIP + radius + category + filters) and get notified when new businesses appear in subsequent runs  
**UI:** "Save this search" button in the search toolbar. List in new `/saved-searches` page. Toggle alerts on/off per saved search.  
**Backend:** Store saved searches in Supabase `saved_searches` table. Daily cron job re-runs each saved search, compares to last result set, emails user a digest of new leads.  
**Files:** New page `src/app/(dashboard)/saved-searches/page.tsx`, new API route `src/app/api/saved-searches/route.ts`, update cron job  
**Competitor parity:** Apollo and UpLead have saved search alerts. D7, Outscraper, and LeadScrape do not — this beats 3 of 4 local-SMB competitors.

---

### B5. Ad & Pixel Detection — Expanded (included in B3)
**Expanded from the Digital Health Score above.** Surface detected ad platforms as distinct icons/tags on the lead card: `G Ads`, `FB Ads`, `IG Ads`, `Yelp Ads`. This is D7's flagship feature — matching it while wrapping it inside a broader health score makes us stronger.

---

## Phase C — Next Sprint (Week 2)
*Platform layer that makes LeadZip a sticky tool for agencies*

### C1. CRM Export Integrations (8–12 hours)
**Integrations to build:**
1. **HubSpot** — OAuth app, push contacts to HubSpot CRM via HubSpot Contacts API
2. **GoHighLevel** — API key integration, push contacts to GHL subaccounts
3. **Pipedrive** — API token, create deals/persons

**UI:** "Export to CRM" button in the export page and bulk action bar. OAuth flow for HubSpot. API key entry for GHL/Pipedrive in Settings → Integrations (new tab).  
**Field mapping:** Map Lead fields to CRM fields (name, phone, website, email, category → company, deal stage).  
**Files:** New `src/app/(dashboard)/settings/integrations/`, new API routes `src/app/api/integrations/hubspot/`, `src/app/api/integrations/ghl/`  
**Competitor parity:** UpLead has 15+ CRM integrations. LeadScrape has 6. D7 and Outscraper have none. Starting with the 3 most-used agency tools (HubSpot, GHL, Pipedrive) beats most competitors.

---

### C2. Developer API Access (6–8 hours)
**What it is:** REST API with API key authentication so developers and power users can query LeadZip programmatically  
**Endpoints:**
- `POST /api/v1/search` — same params as UI search, returns JSON
- `GET /api/v1/leads` — paginated saved leads
- `GET /api/v1/history` — search history

**Auth:** API keys stored in Supabase `api_keys` table. Key generated on Settings → API tab. Rate limits per plan.  
**Docs page:** `/api-docs` — simple documentation page showing example curl/fetch calls  
**Files:** New middleware for API key validation, new `src/app/api/v1/` directory  
**Competitor parity:** Outscraper and Apollo have full APIs. D7 has partial. LeadScrape has webhooks only. Having an API attracts developer and agency customers at scale.

---

### C3. Agency Mode — Team Workspace (8–12 hours)
**What it is:** The "Coming soon" feature in pricing — multiple users under one agency account with per-client workspaces  
**Architecture:**
- `teams` table: agency_name, owner_user_id, plan
- `team_members` table: team_id, user_id, role (owner/member)
- `team_workspaces` table: team_id, client_name, client_zip, notes
- Leads and saved searches are scoped to workspace

**UI:** Workspace switcher in sidebar. `/settings/team` tab for inviting members. Per-workspace lead lists.  
**Competitor parity:** Apollo, UpLead, and Seamless.AI have team seats. Local Falcon is the only local-SMB tool with white-label. This is a major agency revenue unlock.

---

### C4. White-Label Exports (2–3 hours)
**What it is:** Export reports (PDF or styled CSV) with the agency's branding instead of LeadZip branding  
**UI:** Settings → White Label: upload logo, enter agency name, choose accent color. Export button generates a branded PDF report with business list.  
**Files:** New PDF generation using `@react-pdf/renderer`, settings page update  
**Competitor parity:** Only Local Falcon has white-label in this space. Makes LeadZip the only local-SMB lead tool with white-label exports.

---

## Phase D — Roadmap (Week 3+)
*Advanced features that create an unbeatable moat*

### D1. AI Per-Lead Research (Claygent-style)
**What it is:** For any lead, click "AI Research" and an AI agent browses the business's website and answers custom questions  
**Examples:** "Does this restaurant have online ordering?", "Does this HVAC company have fewer than 10 Google reviews?", "Is this contractor running Google Ads?"  
**Implementation:** Claude API (Anthropic SDK) with tool use to fetch URLs. Cached results in Supabase. Credits-based (10 AI researches/mo on Pro).  
**Competitor parity:** Clay's Claygent is the only tool with this. Bringing it to local-SMB prospecting is a category-defining move.

### D2. Chrome Extension
**What it is:** Browser extension for scraping lead data directly from Google Maps and business websites  
**Implementation:** Manifest V3 extension. Content script extracts name, address, phone, hours, website from Google Maps business panels. Sends to LeadZip via API.  
**Competitor parity:** UpLead, Apollo, and Seamless.AI have Chrome extensions. Major feature gap for prospectors who work from Google Maps.

### D3. Trigger-Based Alerts
**What it is:** Get notified when new businesses appear matching your criteria — new registrations, unclaimed GBPs, bad review spikes  
**Data sources:** State SOS business registration feeds, Google Business Profile changes (via GBP API), review spike detection  
**Implementation:** Background workers (Vercel cron), alert emails, in-app notification feed  
**Competitor parity:** No local-SMB tool has this. Apollo has job change alerts for B2B. This is the highest-moat feature on the roadmap.

### D4. Mobile App (React Native / Expo)
**What it is:** iOS + Android app for on-the-go lead discovery and outreach  
**Implementation:** Expo with shared API. Push notifications for saved search alerts.

---

## Updated Competitor Matrix (Target State)

| Feature | D7 | Outscraper | UpLead | LeadScrape | Apollo | **LeadZip Target** |
|---------|:--:|:----------:|:------:|:----------:|:------:|:------------------:|
| Radius search | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ Phase A (done) |
| Rating filter | ❌ | Partial | ❌ | ❌ | ❌ | ✅ done |
| Lead scoring | ❌ | ❌ | ❌ | ❌ | Partial | ✅ done |
| Map view | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ Phase A1 |
| Dark mode | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ Phase A4 |
| Social media profiles | ✅ | Add-on | LinkedIn | ✅ | LinkedIn | ✅ Phase A6 |
| Employee count | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ Phase A6 |
| Revenue estimates | ❌ | ❌ | Partial | ✅ | ✅ | ✅ Phase A6 |
| Email finder | ✅ | Add-on | ✅ | ✅ | ✅ | ✅ Phase B2 |
| Email verification | ❌ | Add-on | ✅ | ✅ | ✅ | ✅ Phase B2 |
| Ad/pixel detection | ✅ | ❌ | ❌ | Partial | ❌ | ✅ Phase B3 |
| Digital health score | ❌ | ❌ | ❌ | SEO only | ❌ | ✅ Phase B3 (unique) |
| Bulk/multi-ZIP search | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ Phase B1 |
| Saved search alerts | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ Phase B4 |
| CRM integrations | ❌ | ❌ | 15+ | 6 | 20+ | ✅ Phase C1 (3 to start) |
| Agency/white-label | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ Phase C3/C4 |
| API access | Partial | ✅ | ✅ Pro | Webhook | ✅ | ✅ Phase C2 |
| AI per-lead research | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ Phase D1 (unique) |
| Chrome extension | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ Phase D2 |
| Trigger-based alerts | ❌ | ❌ | ❌ | ❌ | Job changes | ✅ Phase D3 (unique) |

---

## Today's Execution Order

Work through Phase A in this order (fastest wins first):

1. **A1** — Wire map center coords (30 min) → map view goes live
2. **A4** — Dark mode (30 min) → instant visual upgrade
3. **A2** — Notifications persistence (45 min) → fixes settings UX
4. **A3** — Admin security (20 min) → fixes security hole
5. **A5** — Dashboard chart real data (30 min) → dashboard feels real
6. **A6** — Social, employee, revenue fields (2 hours) → biggest data upgrade
7. **A7** — Fix lead save API (1 hour) → backend integrity

**Total Phase A: ~6 hours**

---

## File Change Summary

### Phase A Files
| File | Change |
|------|--------|
| `src/types/lead.ts` | Add `email`, `facebook`, `instagram`, `linkedin`, `employeeCount`, `revenueEstimate`, `yearFounded` fields |
| `src/app/(dashboard)/search/page.tsx` | Store `centerLat/Lon` in state, pass to LeadsMapWrapper |
| `src/app/(dashboard)/dashboard/page.tsx` | Read real search history for chart data |
| `src/app/(dashboard)/settings/page.tsx` | Persist notification prefs to localStorage, show save toast |
| `src/app/(dashboard)/admin/page.tsx` | Check real auth session for admin role |
| `src/app/layout.tsx` | Add ThemeProvider from next-themes |
| `src/app/(dashboard)/layout.tsx` | Add dark mode toggle to navbar |
| `src/lib/providers/dynamicProvider.ts` | Generate social media URLs, employee count, revenue, yearFounded |
| `src/components/leads/LeadCard.tsx` | Show social icons, employee count badge |
| `src/components/leads/LeadTable.tsx` | Add employee count column |
| `src/lib/export.ts` | Add new fields to CSV export options |
| `src/app/api/leads/save/route.ts` | Wire actual Supabase insert/delete |

### Phase B Files (new)
| File | Purpose |
|------|---------|
| `src/app/api/leads/enrich/email/route.ts` | Hunter.io email finder |
| `src/app/api/leads/enrich/health/route.ts` | Digital health score fetcher |
| `src/app/(dashboard)/bulk-search/page.tsx` | Multi-ZIP search UI |
| `src/app/(dashboard)/saved-searches/page.tsx` | Saved searches list + alerts |
| `src/app/api/saved-searches/route.ts` | CRUD for saved searches |
