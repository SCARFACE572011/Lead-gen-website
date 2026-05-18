# LeadZip Owner Portal — Standalone App Design

**Date:** 2026-05-18  
**Status:** Approved

---

## Context

The LeadZip owner needs a dedicated, standalone web app to oversee and manage the entire LeadZip SaaS business. This is separate from LeadZip itself — it lives at its own URL, has its own Vercel deployment, and is only accessible to the owner. It connects to the same Supabase database and Stripe account as LeadZip.

The existing `/admin` page inside LeadZip will be repurposed in a future task as a user-facing billing/team management page for LeadZip customers. That is out of scope here.

---

## App Identity

| Field | Value |
|-------|-------|
| Folder | `leadzip-owner/` (sibling of `leadzip/` in the same repo) |
| Framework | Next.js 16 (App Router), TypeScript, Tailwind CSS 4, shadcn/ui |
| Visual style | Identical to LeadZip — same colors (#0369A1, #0F172A), same component patterns |
| Auth | Same Supabase project — login with admin email + password |
| Database | Same Supabase project (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) |
| Payments | Same Stripe account (`STRIPE_SECRET_KEY`) |
| Deployment | Separate Vercel project — `leadzipowner.vercel.app` or custom domain |

---

## Routes

| Route | Description |
|-------|-------------|
| `/` | Redirects to `/dashboard` if authenticated, else `/login` |
| `/login` | Owner sign-in form — same design as LeadZip login page |
| `/dashboard` | Full tabbed owner portal (protected) |

---

## Security

Middleware on every request enforces two checks:
1. User must have a valid Supabase session (authenticated)
2. User must have `users_profile.role = 'admin'`

If either check fails: sign out the session and redirect to `/login?denied=true` with an "Access Denied" notice.

No LeadZip user — regardless of plan — can ever access this app. Even if they know the URL.

---

## Dashboard Tabs

### 1. Overview

**Metric cards (top row):**
- Total Users + growth % vs last month
- MRR — live from Stripe API
- ARR (MRR × 12)
- Active Subscribers (Pro + Agency)
- Churn Rate (cancellations last 30 days / active subs)
- New signups today

**Alert Feed:**
A live list of accounts that need attention, grouped by severity:
- 🔴 Past-due (payment failed) — count + link to At-Risk tab
- 🟡 Trials expiring in ≤7 days
- 🟠 Cancelled in last 24 hours
- 🟢 New paid conversions today (positive signal)

**Subscription breakdown:**
- Bar showing Free / Pro / Agency distribution with percentages

**Signup trend chart:**
- Line chart — new signups per day, last 30 days (from `users_profile.created_at`)

---

### 2. Users

**Toolbar:**
- Debounced search (email or name)
- Filter: Plan (All / Free / Pro / Agency)
- Filter: Status (All / Active / Deactivated)
- Export to CSV button (downloads all filtered results)
- Refresh button

**Table columns (sortable):**
- User (avatar initials + email + name)
- Plan badge
- Status badge (Active / Deactivated)
- Searches this month
- Saved leads
- Joined date
- View button → opens slide-over

**Pagination:** 25 per page, Prev/Next

**User Detail Slide-over:**

Profile section:
- Name, email, company, role, plan, status, join date

Usage section:
- Searches / saved leads / exports vs plan limits (progress bars)

Subscription section:
- Stripe plan, status badge, billing period
- Stripe Customer ID — copy button + link to `dashboard.stripe.com/customers/{id}`
- Stripe Subscription ID — copy button

Notes section:
- Free-text notes field, auto-saved on blur
- Stored in a new `admin_notes` column on `users_profile`

Quick Actions:
- Change plan (Select dropdown — Free / Pro / Agency)
- Reset monthly usage (with confirm step)
- Deactivate / Reactivate account (disabled on own account)
- Send email (opens pre-filled mailto link with user's email)

---

### 3. Billing & Revenue

**Summary cards:**
- MRR (live Stripe)
- ARR
- New MRR this month (new paid subs)
- Churned MRR this month (cancelled subs × plan price)
- ARPU (average revenue per user = MRR / total paid subscribers)
- Conversion rate (paid / total users %)

**Revenue chart:**
- Line chart — MRR over last 12 months
- Data source: count of active paid subscriptions per month from `subscriptions` table grouped by `created_at` month

**Subscriptions table:**

Columns:
- User email + name
- Plan badge
- Stripe Status badge (active / trialing / past_due / cancelled)
- Billing period (start → end)
- Renewal date
- Stripe Customer ID (copy + Stripe link)
- Created date

Filter by Stripe status. One-click **Deactivate** button for past_due rows.

---

### 4. At-Risk

Three sections, each a card with a table:

**Past Due (🔴)**
- Users whose Stripe subscription `status = 'past_due'`
- Columns: email, plan, days overdue (calculated from `current_period_end`), Stripe link, Deactivate button
- "Deactivate All Past Due" bulk action button

**Trials Ending (🟡)**
- Users whose Stripe subscription `status = 'trialing'` AND `current_period_end` within 7 days
- Columns: email, plan, trial ends (date), days remaining
- Purpose: these are conversion targets — you can reach out proactively

**Inactive Paid Users (⚫)**
- Paid users (Pro or Agency) who have run zero searches in last 30 days
- Columns: email, plan, last search date (from `search_history`), searches this month
- Purpose: churn risk — identify before they cancel

---

### 5. Analytics

**Growth charts (last 30 days):**
- New signups per day (line chart)
- Search volume per day (line chart)

**Revenue trend (last 12 months):**
- MRR per month (line chart) — derived from subscriptions table

**Plan distribution:**
- Pie chart — Free / Pro / Agency

**Top activity:**
- Top 10 most searched ZIP codes (bar chart)
- Top 8 most searched business categories (bar chart)

**Power users:**
- Table: top 10 users by total all-time searches
- Columns: email, plan, total searches, searches this month, joined date

---

## Auto-Deactivation (Stripe Webhook Enhancement)

**File to modify:** `leadzip/src/app/api/stripe/webhook/route.ts`

Add handler for `invoice.payment_failed` event:
- After Stripe's built-in retry period (configurable in Stripe — typically 3 attempts over ~1 week), Stripe fires `customer.subscription.deleted`
- We already handle `customer.subscription.deleted` — enhance it to also set `users_profile.status = 'deactivated'`
- This means: when a paying user's subscription ends (cancelled OR expired after failed payment), they are automatically locked out of LeadZip

Also add handler for `customer.subscription.updated` when `status` changes to `past_due`:
- Do NOT auto-deactivate on `past_due` — Stripe is still retrying
- Do set `subscriptions.status = 'past_due'` (already done) so the At-Risk tab shows them
- Owner can manually deactivate from the portal if desired

**Result:** Zero manual work required for lapsed payments. The portal's At-Risk tab lets the owner monitor and take action; the webhook handles the eventual auto-deactivation when Stripe gives up.

---

## Data Requirements

### New column needed (in LeadZip Supabase)

```sql
ALTER TABLE public.users_profile
  ADD COLUMN IF NOT EXISTS admin_notes text DEFAULT '';
```

(Applied as a migration via Supabase MCP)

### API Routes (in leadzip-owner app)

All routes verify `role = 'admin'` using the service role key before executing.

| Route | Method | Description |
|-------|--------|-------------|
| `/api/stats` | GET | Overview metrics + alert feed |
| `/api/users` | GET | Paginated user list with filters |
| `/api/users/[id]` | PATCH | set_status / set_plan / reset_usage / update_notes |
| `/api/users/export` | GET | CSV export of filtered users |
| `/api/billing` | GET | Stripe subscription list + revenue summary |
| `/api/billing/mrr-history` | GET | MRR per month for last 12 months |
| `/api/at-risk` | GET | Past-due, trial-ending, inactive paid users |
| `/api/analytics` | GET | Trend data — signups, searches, plan distribution, top ZIPs/categories, power users |

### Stripe API usage (direct calls, not just DB)
- `GET /v1/subscriptions` — for live MRR and subscription status
- MRR calculated as: sum of active subscription amounts from Stripe (accurate to cent)
- MRR history: derived from `subscriptions` table in Supabase (grouped by month)

---

## File Structure

```
leadzip-owner/
├── src/
│   ├── app/
│   │   ├── layout.tsx          ← root layout (fonts, metadata)
│   │   ├── page.tsx            ← redirects to /dashboard or /login
│   │   ├── login/
│   │   │   └── page.tsx        ← owner login form
│   │   ├── dashboard/
│   │   │   ├── layout.tsx      ← auth guard + outer shell
│   │   │   └── page.tsx        ← tabbed portal (Overview/Users/Billing/At-Risk/Analytics)
│   │   └── api/
│   │       ├── stats/route.ts
│   │       ├── users/route.ts
│   │       ├── users/[id]/route.ts
│   │       ├── users/export/route.ts
│   │       ├── billing/route.ts
│   │       ├── billing/mrr-history/route.ts
│   │       ├── at-risk/route.ts
│   │       └── analytics/route.ts
│   ├── components/
│   │   ├── ui/                 ← shadcn components (button, badge, tabs, sheet, select, table, input)
│   │   ├── UserDetailSheet.tsx
│   │   └── StatCard.tsx
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts
│   │   │   └── server.ts
│   │   ├── stripe.ts           ← Stripe client init
│   │   └── utils.ts
│   ├── middleware.ts            ← auth + role enforcement
│   └── types/
│       └── index.ts            ← UserRow, BillingSubscription, AtRiskUser, etc.
├── package.json
├── next.config.ts
├── tailwind.config.ts
└── .env.local                  ← (gitignored) same Supabase + Stripe keys as LeadZip
```

---

## Shared Environment Variables

The owner portal uses the **exact same** env var values as LeadZip:

```
NEXT_PUBLIC_SUPABASE_URL=         (same as leadzip)
NEXT_PUBLIC_SUPABASE_ANON_KEY=    (same as leadzip)
SUPABASE_SERVICE_ROLE_KEY=        (same as leadzip)
STRIPE_SECRET_KEY=                (same as leadzip)
NEXT_PUBLIC_SITE_URL=             (this app's own URL)
```

---

## LeadZip Webhook Enhancement

**File:** `leadzip/src/app/api/stripe/webhook/route.ts`

Modify the `customer.subscription.deleted` handler to also deactivate the user:

```typescript
// After updating subscriptions table and users_profile.plan → 'free':
await db
  .from('users_profile')
  .update({ status: 'deactivated', updated_at: now })
  .eq('id', userId)
```

This means cancelled/lapsed subscribers are automatically locked out of LeadZip.

---

## Verification Checklist

1. `npm run dev` in `leadzip-owner/` starts on a different port from LeadZip
2. `/login` accepts the admin email + password and redirects to `/dashboard`
3. Logging in with a non-admin LeadZip account shows "Access Denied"
4. Overview tab loads metric cards and alert feed
5. Users tab shows all users, search/filter/sort works, slide-over opens
6. Export CSV downloads a valid file with all columns
7. Deactivating a user from the portal immediately locks them out of LeadZip
8. Billing tab shows Stripe subscriptions with live status
9. At-Risk tab shows past-due accounts with a deactivate button
10. Analytics tab renders all charts without errors
11. Stripe webhook: cancel a test subscription → user auto-deactivated in DB
