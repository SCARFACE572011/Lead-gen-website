# LeadZipp Paid Ads Launch Plan

Prepared 2026-08-18. Supersedes the launch guidance in `docs/ppc-plan.md`.
That document stays in place as the **economics annex**: its funnel arithmetic, its
negative-keyword research and its assumption register are still the reference. What it
got wrong, and what changed in the code since, is reconciled in section 0 below.

The owner has decided to run ads. This document does not re-argue that decision. It
allocates the money to the places where the math is least bad, bounds the downside with
hard kill criteria, and lists exactly what has to ship before the first dollar moves.

**Every code claim below was verified by reading the file on 2026-08-18. File and line
are cited. Nothing is quoted from the old plan without re-checking it.**

---

## 0. What changed since 2026-08-12

The old plan listed four blockers. Two are fixed, one is half fixed, one is worse than
it looked.

### 0.1 FIXED: the trial CTA now actually starts a trial

The old plan's headline blocker was "every paid click that presses the main CTA creates a
free account". That is no longer true on the pages that matter.

- `src/app/(auth)/signup/page.tsx:108-118` reads `?plan=` and `?billing=` off
  `window.location.search` on mount and preselects Pro or Agency, monthly or annual. It
  deliberately uses `window.location` rather than `useSearchParams` so the page keeps its
  static prerender.
- `src/app/(auth)/signup/page.tsx:192-219` posts to `/api/stripe/checkout` immediately
  after a successful signup when a plan was preselected, and hard-navigates to the Stripe
  URL. On failure it toasts and falls through to `/dashboard` rather than stranding the
  user.
- `src/app/(auth)/signup/page.tsx:282-292` renders an explicit notice before the form is
  filled: "After this step we will take you to Stripe to add a card. You are not charged
  today." That is the disclosure Google's dishonest-pricing policy wants, on the page.
- `src/app/pricing/page.tsx:556-564` catches the 401 from the checkout API and redirects
  to `/signup?plan=X&billing=annual`, carrying the choice instead of dropping it.
- `src/app/leads/[slug]/page.tsx:111,149,393` and `src/app/compare/[slug]/page.tsx:254,371`
  now point at `/signup?plan=pro`.

**Ad-relevant consequence:** an ad can deep-link `/signup?plan=pro&billing=annual` or
`/pricing?billing=annual` (`src/app/pricing/page.tsx:522` reads the billing param and flips
the toggle) and land the visitor on an **annual-first** offer with no new code. Section 1
shows why that single URL parameter is the highest-leverage lever in this entire plan.

**Still leaking to a free account** (bare `/signup`, no plan):
`src/app/leads/page.tsx:86,276`, `src/app/compare/page.tsx:87,207`,
`src/app/web-design-leads/page.tsx:172,347`,
`src/components/marketing/FreeAuditChecker.tsx:257`,
`src/components/marketing/SiteHeader.tsx:73,117`.
Do not point paid traffic at those pages until their CTAs carry a plan. Section C's
landing-page map routes around them.

### 0.2 FIXED, PARTIALLY: attribution captures gclid and nothing else

`persistGclidToProfile` at `src/app/(auth)/signup/page.tsx:24-40` calls `readGclid()` and
writes the value to `users_profile.gclid`, raced against a 2.5 second timeout so a slow
write cannot delay the Stripe redirect. Failure is swallowed on purpose.

The capture chain, verified end to end:

| Step | Where | What it does |
| --- | --- | --- |
| Read from URL | `src/lib/analytics.ts:291-305` `captureGclid()` | Reads `?gclid=`, validates against `/^[A-Za-z0-9._-]{1,512}$/`, writes first-party cookie `lz_gclid`, Max-Age 90 days, SameSite=Lax |
| Fire on every entry | `src/instrumentation-client.ts:21-25` | Runs once per hard navigation, so any landing page captures it with no per-page wiring |
| Persist to profile | `src/app/(auth)/signup/page.tsx:24-40,182` | `users_profile.gclid`, feature-detected against `supabase/migrations/20260812_gclid.sql` |
| Read back at payment | `src/app/api/stripe/webhook/route.ts:57-74` `readProfileGclid()` | Reads the column on `invoice.paid` and `customer.subscription.created` |
| Emit | `src/app/api/stripe/webhook/route.ts:82-108` `logOfflineConversion()` | **`console.log` only.** Emits `[offline-conversion] {kind, dedupe_key, user_id, gclid, amount, currency, reason, timestamp}` |

**What is captured: `gclid` only.** A repository-wide grep for `fbclid`, `msclkid`,
`utm_source` and `utm_campaign` across `src/**/*.ts` and `src/**/*.tsx` returns **zero
matches**. There is no Meta click id, no Microsoft click id, and no UTM persistence
anywhere in the application. Reddit's click id is not captured either.

**Where it lands:** the `lz_gclid` cookie, then the column
`users_profile.gclid` in Supabase, then a Vercel log line. It never reaches Google Ads.
The webhook comment at lines 35-38 says so explicitly: "This emits the structured line. It
does NOT upload anything."

**Two hard blockers inside this otherwise good plumbing:**

1. `captureGclid()` returns `null` immediately unless `hasAnalyticsConsent()` is true
   (`src/lib/analytics.ts:292`). A visitor who ignores the cookie banner is invisible
   forever, including for the offline import.
2. `ad_storage`, `ad_user_data` and `ad_personalization` are hard-coded to `'denied'` in
   **both** the pre-hydration bootstrap (`src/app/layout.tsx:31`) and in
   `setAnalyticsConsent` (`src/lib/analytics.ts:152-156`), with the comment "LeadZipp does
   not use Google advertising storage." They stay denied even when the visitor clicks
   Accept All. Running Google Ads with these denied means conversions arrive modeled or
   not at all, and remarketing audiences will not build. **This is the single most
   important pre-launch code change in this document.**

### 0.3 PARTIAL: analytics exists, is well built, and is missing the events ads need

`track()` at `src/lib/analytics.ts:225-254` is a typed wrapper. It pushes
`{ event, ...props }` onto `window.dataLayer` when `NEXT_PUBLIC_GTM_ID` is set, otherwise
calls `gtag('event', ...)` when `NEXT_PUBLIC_GA4_ID` or `NEXT_PUBLIC_GA` is set. It no-ops
during SSR, never throws, and no-ops without consent. GTM itself is loaded only after an
explicit grant by `src/components/AnalyticsScripts.tsx:41-53`.

**So it is GTM dataLayer, with a direct-GA4 fallback. Not Plausible, not console.**

The event catalog is a closed union at `src/lib/analytics.ts:29-34`. Five events exist.
Every call site in the repository:

| Event | Call site | Status |
| --- | --- | --- |
| `signup_completed` | `src/app/(auth)/signup/page.tsx:174-178` | Live. Carries `trial_selected`, `plan`, `billing`. No PII |
| `trial_started` | `src/app/(dashboard)/dashboard/page.tsx:268` via `TrialStartedTracker` | Live. Deduped on Stripe `session_id` (`src/lib/analytics.ts:417-432`) |
| `checkout_started` | `src/app/pricing/page.tsx:550` | Live **on `/pricing` only** |
| `search_run` | `src/app/(dashboard)/search/page.tsx:353,457` | Live. Bucketed counts, never the raw query |
| `first_territory_request_submitted` | `src/components/marketing/FirstTerritoryForm.tsx:59` | Live |

The exact missing events are enumerated as a checklist in **section F**. The two that
matter most: the signup page's own auto-launch into Stripe at
`src/app/(auth)/signup/page.tsx:200` does **not** fire `checkout_started`, so the primary
paid path to checkout is the one path that is unmeasured; and `/free-audit` has **zero**
tracking of any kind, so pointing paid clicks at it today buys unmeasurable traffic.

### 0.4 WORSE THAN IT LOOKED: the free-audit tool has a sitewide daily ceiling

`/free-audit` is the best cheap-click landing page LeadZipp owns. It is also capped:

| Limiter | Rule | File |
| --- | --- | --- |
| Per visitor, daily | 3 checks / 1 day | `src/lib/ratelimit.ts:259-263` |
| Per visitor, burst | 2 checks / 1 minute | `src/lib/ratelimit.ts:265-269` |
| **Sitewide** | **200 checks / 1 day, fixed window** | `src/lib/ratelimit.ts:276-280` |

All three are `onOutage: 'deny'`. The sitewide 200/day is shared by every visitor from
every source. At $1 Reddit clicks, a $200 day sends enough traffic to exhaust it, after
which **every** visitor including organic and Product Hunt traffic hits a denial. Raise
this cap before any campaign points at `/free-audit`, or cap that ad group's daily budget
so it cannot get there. Section F item 9 and section H week 1 both carry this.

### 0.5 Landing page inventory, recounted today

- **132 location pages.** `src/lib/seoPages.ts` defines 10 categories (`CATEGORIES`,
  line 140), 12 US cities (`US_CITIES`, line 761) and 12 international cities
  (`INTL_CITIES`, line 1002). 10 x 12 = 120 at `/leads/{category}-in-{city}` plus 12 at
  `/leads/{city}-{country}`.
- **4 comparison pages, not 6.** `src/lib/comparePages.ts:525` exports
  `COMPARISONS = [APOLLO, HUNTER, ZOOMINFO, B2BLEADFINDER]`. The `d7-lead-finder` and
  `outscraper` pages the brief expects tonight **do not exist in the working tree yet**.
  Section B's competitor-alternative ad groups are written against them and must not go
  live until `getAllComparisonSlugs()` returns 6.
- `/free-audit`, `/web-design-leads`, `/leads`, `/compare`, `/pricing`, `/` all live and
  in `src/app/sitemap.ts` (lines 60-61 for the first two).
- GSC indexing reported by the owner at roughly 29 of 208. Not independently verifiable
  from the codebase. Treated as an assumption (A12).

---

## A. Executive summary

**Decision: launch, but launch small, warm and measured, and do not start paid until
Product Hunt week is over on 2026-08-31.**

The arithmetic has not changed direction since the annex, only magnitude. At $25/mo billed
monthly, a customer is worth about **$136 of contribution over six months**, and a
three-month payback caps allowable CAC at **$68**. Under base assumptions a blended paid
program lands at roughly **$106 CAC at $300/mo and $162 CAC at $3,000/mo**. Paid does not
clear payback at any tier. It roughly breaks even against lifetime contribution at the
small tier and loses money as it scales, because the two channels whose math actually
works, brand defense and retargeting, are volume-capped and cannot absorb budget.

That is the whole strategy in one sentence: **buy the cheap warm inventory to its ceiling,
buy a bounded amount of cold inventory to measure the one number nobody knows, and route
everything at an annual-first offer, because annual is the only thing that moves the
ceiling.** A 25% annual mix lifts the three-month-payback ceiling from $68 to $103. The
code to do it already exists; it is a URL parameter.

### The three tiers

| | **Tier 1: Test** | **Tier 2: Lean** | **Tier 3: Push** |
| --- | --- | --- | --- |
| Budget | $300, one month | $1,000/mo | $3,000/mo |
| Starts | 2026-09-01 | Only if Tier 1 passes its gate | Only if Tier 2 passes its gate |
| Channels | Brand, Meta retarget, Reddit, Google alternative terms | Adds Microsoft/Bing import, Reddit scale | Same five, all at their volume ceiling |
| Est. clicks | ~264 | ~832 | ~2,093 |
| Blended CPC | ~$1.14 | ~$1.20 | ~$1.43 |
| Trial starts, pessimistic / base / optimistic | 3 / 6 / 11 | 11 / 21 / 37 | 21 / 41 / 72 |
| Paid customers (45% trial-to-paid) | 1 / 3 / 5 | 5 / 10 / 17 | 9 / 19 / 33 |
| Cost per trial start, base | $48 | $47 | $73 |
| Implied CAC, base | **$106** | **$104** | **$162** |
| Verdict vs $68 ceiling | Over. Bounded loss, buys the LP conversion rate | Over. Only run if Tier 1 beat base case | Over, and getting worse. Only run with an annual mix above 25% |

Note what the last row says. **CAC gets worse as you scale, not better.** At Tier 3 the
$60/mo of real brand-search volume and the roughly $250/mo of retargeting inventory are
exhausted, and every additional dollar goes into Reddit and cold search at two to three
times the cost per trial. Any plan that shows improving CAC at higher spend is modeling
channels that do not have the volume.

**What Tier 1 actually buys.** Not customers. It buys a measured landing-page-to-trial
conversion rate, which is assumption A6, the single number the entire economic model is
most sensitive to, and which has never been measured because until 2026-08-18 the trial
CTA did not reach a card form. Budget it as research. One to three customers is the
expected byproduct, not the goal.

### Kill criteria

**Pre-launch gate. All seven must be true or spend $0.** Full detail in section F.

1. `ad_storage`, `ad_user_data` and `ad_personalization` flip to `granted` on Accept All
   (`src/app/layout.tsx:31`, `src/lib/analytics.ts:152-156`).
2. `NEXT_PUBLIC_GTM_ID` confirmed present in the **Vercel Production** environment.
3. A real test card purchase fires `trial_started` and it appears in Google Ads conversion
   diagnostics, not just in GTM preview.
4. `checkout_started` fires on the signup auto-launch path, not only on `/pricing`.
5. `lz_gclid` confirmed writing to `users_profile.gclid` on a live test signup.
6. `/free-audit` sitewide cap raised above 200/day, or its ad group budget capped so it
   cannot reach it.
7. Meta pixel installed and firing, with `fbclid` capture added alongside `gclid`.

**During the run. Any one of these triggers the stated action, no discussion.**

| When | Condition | Action |
| --- | --- | --- |
| Day 7 | Spend > $80 and `trial_started` = 0 across all channels | **Pause everything.** This is a funnel problem. Do not raise budget, do not rewrite ads |
| Day 7 | Any single ad group has spent > $50 with zero conversions of any kind | Pause that ad group only |
| Day 10 | Google search terms report is majority trade-buyer intent (plumbers wanting leads, not agencies wanting plumbers) | Add negatives same day, then reassess at day 14 |
| Day 14 | Cost per `trial_started` > $120 | **Hard stop on cold channels.** Keep brand and retargeting running |
| Day 14 | Reddit CTR < 0.30% | Kill Reddit. The creative is not native enough and a rewrite will not close it |
| Day 30 | Cost per `trial_started` > $90 | **Do not open Tier 2.** Stay at $300 or stop |
| Day 30 | Zero `invoice_paid` lines carrying a non-null `gclid` after $300 spent | **Stop paid search permanently at monthly pricing.** Revisit only behind an annual-first offer or a price change |
| Any time | Owner time on ad management exceeds 4 hours in a week | **Stop.** At $300/mo, four hours a week is the most expensive input in the program. Labor is the binding constraint on a solo founder, not budget |
| Any time | `/free-audit` returns rate-limit denials to organic visitors | Pause the free-audit ad group immediately |

**Day 30 decision table, on cost per `trial_started`:**

| Result | Implied CAC | Decision |
| --- | --- | --- |
| Under $30 | ~$67 | At the ceiling. Open Tier 2. Do not skip to Tier 3 |
| $30 to $60 | $67 to $133 | Hold at $300/mo. Ship the annual-first offer, then re-measure for 30 days |
| $60 to $90 | $133 to $200 | Cut to brand plus retargeting only, roughly $80/mo. That combination is the only one that clears |
| Over $90 | Over $200 | Stop all paid. The annex's conclusion was right and this test proved it for $300 |

---

## A2. The economics, recomputed for the metered plans

The annex computed these against unlimited searches. `src/lib/planPolicy.ts:29-75` now caps
them, which improves the margin and bounds the worst case.

**Contribution per Pro month** (verified: Pro $25, `liveSearchesPerMonth: 100`,
`src/lib/planPolicy.ts:45-47`; Places cost ~$0.10 per live search, PRODUCT.md):

```
Revenue                                          $25.00
Places calls (A1: 40 live searches, cap is 100)  ($4.00)
Stripe (2.9% + $0.30)                            ($1.03)
= Contribution                                   $19.97   ->  $20/mo, 80%
Worst case at the 100-search cap                 $13.97   ->  the cap is the floor
```

**Contribution per Agency month** ($50, 300 pooled searches,
`src/lib/planPolicy.ts:59-73`): $50.00 less $10.00 Places (A1b: 100 searches) less $1.75
Stripe = **$38.25**. At an 85/15 Pro/Agency mix the blended figure is **$22.72/mo**.

| Retention (A4) | Blended contribution LTV |
| --- | --- |
| 4 months | $91 |
| **6 months (midpoint)** | **$136** |
| 8 months | $182 |

```
Payback target:  3 months (bootstrapped, no outside capital)
Hard CAC ceiling  = 3 x $22.72  = $68
Target CAC (3:1)  = $136 / 3    = $45
```

**Required CPC.** Funnel is click -> landing page -> trial start with card -> paid on day 7.
Trial-to-paid held at 45% (A7).

| LP -> trial start | Click -> paid | CPC at $45 target | CPC at $68 ceiling |
| --- | --- | --- | --- |
| 0.8% | 0.36% | $0.16 | $0.25 |
| 1.2% (annex baseline) | 0.54% | $0.25 | $0.37 |
| 2.0% | 0.90% | $0.41 | $0.61 |
| 3.0% | 1.35% | $0.61 | $0.92 |
| 5.0% | 2.25% | $1.02 | $1.53 |

Cold B2B SaaS search clicks do not cost 25 cents. That is why this plan puts most of the
money into warm inventory, where the LP-to-trial rate is 3% or better and the CPC is
around $0.70, which is the only row and column combination in that table that is real.

### The annual lever, and why it is the most important paragraph here

Pro annual bills $240 on day one. Contribution is roughly **$185, banked immediately**,
with zero payback risk because the cash is already collected. Agency annual is $480 and
roughly $340. Blended, an annual customer is worth about **$209 of contribution in year
one, on day one**.

| Annual share of new customers | Blended LTV | 3-month-payback CAC ceiling | Target CAC (3:1) |
| --- | --- | --- | --- |
| 0% (today) | $136 | **$68** | $45 |
| 15% | $147 | **$89** | $49 |
| 25% | $154 | **$103** | $51 |
| 40% | $165 | **$124** | $55 |

Getting one new customer in four onto annual raises the ceiling by 51%, from $68 to $103,
which is the difference between "every tier loses money" and "Tier 1 and Tier 2 are
roughly break-even". Nothing else available moves the number that far.

**And it costs no engineering.** `src/app/pricing/page.tsx:522` reads `?billing=annual`
and flips the toggle. `src/app/(auth)/signup/page.tsx:117` reads it and preselects annual
before handing off to Stripe. Every ad final URL in this plan therefore carries
`?billing=annual` where it points at `/pricing` or `/signup`, and every RSA includes at
least one annual headline. Verified live in code today. The only thing missing is the
decision to lead with it.

**Two things the annual push must not do:** it must not hide the monthly price, which is a
Google dishonest-pricing exposure, and it must not remove the free plan from the page. Say
$25 a month, or $20 a month billed annually. Both numbers, always.

---

## B. Channel sequencing

Ordered by expected contribution per dollar, not by size. Launch them in this order. Do
not start channel N+1 until channel N has run seven days and has not tripped a kill
criterion.

**A note on the CPC numbers below.** LeadZipp has spent $0 on ads and has no account
history, so every CPC here is an estimate. Each row carries a source-quality label:

- **Structural.** Derived from how the auction works for this inventory type. Reliable
  as a range, unreliable as a point estimate.
- **Category benchmark.** A published third-party benchmark for B2B SaaS. Directionally
  useful, routinely 2x off for a specific account.
- **Guess.** No defensible source. Named as a guess so it is not mistaken for a finding.

Treat all of them as hypotheses that the first seven days will replace with facts. The
Keyword Planner will give real local numbers for the search channels before launch and
should overwrite this table.

### B1. Google Search, brand terms only. FIRST, and permanently on.

**Budget: $2/day, $60/mo, capped by search volume rather than by budget.**

| | |
| --- | --- |
| Campaign | `LZ \| Search \| Brand` |
| Keywords | `[leadzipp]`, `[leadzipp.com]`, `[lead zipp]`, `[leadzip]`, `"leadzipp"` |
| Match | Exact plus one phrase, to catch misspellings the exact list misses |
| Bid | Manual CPC, $1.50 cap. Brand terms with a matching landing page usually clear a 9 or 10 Quality Score, so actual CPC lands far below cap |
| Geo | United States, Canada, United Kingdom, Australia. **Presence, not presence-or-interest** |
| Landing page | `/` |
| CPC estimate | **$0.30 to $1.20. Structural.** Brand terms on your own trademark with a perfect-match landing page are the cheapest inventory in Google Ads |
| LP -> trial assumption | 8%. **Guess**, but brand-search intent is the highest that exists |

**Why first.** Product Hunt on 2026-08-26 plus a Reddit organic week plus cold email will
create the first brand searches LeadZipp has ever had. Those searchers already want the
product. Two competitors, b2bleadfinder.io and any aggregator running dynamic search ads,
can bid on "leadzipp" and intercept them for pennies. $60/mo is insurance on the entire
launch, and it is the only line item in this plan whose CAC clears the ceiling with room
to spare.

**Expect it to underspend.** With no brand awareness there may be 20 to 80 brand searches
in the first month. Spending $18 of the $60 is a success, not a failure. Do not raise the
bid to force spend.

### B2. Meta retargeting only. SECOND. Cold Meta is rejected.

**Budget: $60/mo at Tier 1, $190 at Tier 2, capped near $250/mo by audience size.**

| | |
| --- | --- |
| Campaign | `LZ \| Meta \| Retarget` |
| Objective | Sales or Leads with a website conversion event, **not** Traffic. Traffic optimizes for cheap clickers |
| Audience | Website Custom Audience, all visitors, 30 days. Exclude a Custom Audience of `/dashboard` visitors so existing users are not retargeted |
| Frequency cap | 3 impressions per 7 days. A tiny audience burns out fast and frequency above that produces complaints, not conversions |
| Placements | Facebook Feed, Instagram Feed, Instagram Stories. **Turn Audience Network off.** It is where a small B2B budget goes to die |
| Landing page | `/pricing?billing=annual` for the pool that already saw the product, `/free-audit` for pool members who have not |
| CPC estimate | **$0.50 to $1.20. Category benchmark**, discounted because retargeting a warm pool consistently underprices cold B2B interest targeting |
| LP -> trial assumption | 3.0%. **Guess.** Warm traffic converting 2 to 4x cold is the standard finding and is why this line item exists |

**Why second and not first.** It has the best economics in the plan after brand, and it is
the only channel that gets *better* as the organic launch works, because every Product Hunt
and Reddit visitor enlarges the pool for free. But it cannot start before the pool exists.
The pixel must be live before 2026-08-26 so PH week traffic is captured; the ads themselves
should not start until 2026-09-01 when there is an audience to serve.

**On the audience minimum.** The "100 people" figure repeated everywhere online is
blog-sourced and sources contradict each other. Meta's own Business Help Center says to wait
until a website custom audience has **"several hundred people"**
([Meta help](https://en-gb.facebook.com/business/help/237515166435276)), and the Marketing
API only returns an opaque "audience is smaller than it should be" status without naming a
number ([API reference](https://developers.facebook.com/docs/marketing-api/reference/custom-audience/)).
**Plan against several hundred.** If the 30-day pool is below roughly 500 after PH week,
hold this campaign and roll its budget to Reddit for another two weeks.

**On the pixel, because the "pixel is dead" claim is wrong.** The Meta Pixel is still the
install method. What changed is organization: the pixel is now one data source inside a
**dataset** in Events Manager, and the dataset ID *is* the pixel ID. Meta's own Conversions
API docs still instruct you to reuse the existing pixel ID for both browser and server
events ([Meta CAPI Get Started](https://developers.facebook.com/docs/marketing-api/conversions-api/get-started/)).
Install the pixel now; add the Conversions API later, deduplicated on a shared `event_id`.
The genuinely retired thing is the separate Offline Conversions API, which LeadZipp never
used.

**Cold Meta is rejected.** Interest targeting for "small business owners" and "marketing
agency" reaches a population that is overwhelmingly not agency owners with a prospecting
budget, and there is no customer list to build a lookalike from because there are zero
customers. Revisit lookalikes at 50+ paying customers, not before.

### B3. Reddit. THIRD, and the largest cold line item.

**Budget: $150/mo at Tier 1, $350 at Tier 2, up to $1,200 at Tier 3.**
Reddit's published minimum is **$5.00/day**, so $150/mo is the floor, not a choice.
Minimum bids in US/UK/CA are **$0.10 CPC, $3.50 CPM, $0.01 CPV**
([Reddit Ads pricing help](https://business.reddithelp.com/s/article/How-much-do-Reddit-Ads-cost)).

| | |
| --- | --- |
| Campaign | `LZ \| Reddit \| Agency Prospecting` |
| Targeting | **Community targeting** (Reddit's current name for subreddit targeting; it has a BULK ENTRY field for lists) on `r/agency`, `r/webdev`, `r/web_design`, `r/SEO`, `r/juststart`, `r/Entrepreneur`, `r/smallbusiness`. Geo: US, CA, UK, AU. **Turn Audience Expansion OFF** or Reddit will silently add similar communities |
| Buying | CPC, not CPM, until there is conversion data. CPM buying without a conversion signal is a donation |
| Landing page | `/free-audit` for every variant. See section C for why |
| CPC estimate | **$0.80 to $2.00, planning at $1.20. Blog estimate only.** Reddit publishes no benchmark. Circulating ranges of $0.50 to $2.00 general and $1.50 to $3.00 in tech/B2B subreddits all trace to unsourced agency posts. Plan the floor bid at $0.10 and let the auction reveal the real number |
| LP -> trial assumption | 0.8%. **Guess, deliberately pessimistic.** Reddit buys attention, not intent, and a card-required trial is the worst possible ask of a skeptical audience |

**Reddit's real job is not conversions.** At 0.8% direct conversion, Reddit's own CAC is
around $280 and fails badly. It is in the plan because it buys a *qualified site visitor
for about $1*, and every one of those visitors enters the retargeting pool from B2, where
the conversion economics actually work. Judge Reddit on cost per new site visitor and on
whether the retargeting pool grows, not on last-click trials. If you optimize Reddit to
last-click conversions you will kill the channel that feeds the one that works.

**This is also why Reddit points at `/free-audit`.** Asking a Reddit user for a card is a
non-starter. Asking them to score a business with no signup is a fair trade for a click,
and it demonstrates the product in about fifteen seconds.

**Timing.** Reddit paid ads and the Reddit organic launch week collide. Section H delays
paid Reddit until 2026-09-01, after the organic posts on 8/25, 8/27 and 8/28 have run.
Running a paid ad into `r/SideProject` in the same week as an organic self-post reads as
astroturfing to that audience and risks the organic post, which is worth more.

**Read the community rules before targeting.** Several of these subreddits restrict
promotional content, and Reddit's own policy on where ads may serve changes. Verify each
target community is eligible in the Reddit Ads interface at build time rather than
assuming.

### B4. Google Search, comparison and competitor-alternative terms. FOURTH.

**Budget: $80/mo at Tier 1, $250 at Tier 2, up to $1,200 at Tier 3.**

| | |
| --- | --- |
| Campaign | `LZ \| Search \| US \| Alternatives` |
| Match | **Exact only.** No broad match anywhere in this account until there are 30+ conversions in 30 days |
| Bid | Maximize Clicks with a $2.50 max CPC cap. Smart Bidding needs conversion volume this account will not have for months |
| Geo | US, CA, UK, AU. Presence only |
| CPC estimate | **$1.50 to $4.50, planning at $2.50. Weakest number in this plan.** See the source note directly below |
| LP -> trial assumption | 2.5%. **Guess.** Alternative-seekers are mid-funnel and a comparison page is a strong message match |

**Source honesty on that CPC, because this is where plans get made up.** The only real
benchmark study in this category is WordStream/LocaliQ's 2026 Google Ads Benchmarks, built
on 13,474 US search campaigns from April 2025 to March 2026. It reports an
**all-industry average search CPC of $5.42**, and its nearest proxy row to LeadZipp is
**Business Services at $5.87**
([WordStream](https://www.wordstream.com/blog/2026-google-ads-benchmarks),
[LocaliQ](https://localiq.com/blog/search-advertising-benchmarks/). Note these are the same
company, not two sources). **There is no Technology, Software or SaaS row in that study**,
and the "Technology $3.80" figure that circulates attributed to WordStream does not exist on
that page. **There is no published benchmark of any quality for "[competitor] alternative"
keywords or for "lead generation software" head terms.** Every dollar figure you will find
for those is an unsourced agency blog post.

So: $2.50 is a planning assumption based on these being low-volume long-tail modifier
phrases, which normally clear below an all-industry median. If the real number comes back at
$5.42, this ad group's cost per trial doubles to roughly $95 and it fails its day-14 kill
criterion. **Pull real local numbers from Keyword Planner before launch and rebuild this
table.** That is a 20-minute job and it replaces the single weakest input in the plan.

**Ad groups and their landing pages:**

| Ad group | Keywords (exact) | Landing page | Gate |
| --- | --- | --- | --- |
| `AG1 \| D7 Alternative` | `[d7 lead finder alternative]`, `[alternative to d7 lead finder]`, `[d7 lead finder competitors]` | `/compare/leadzipp-vs-d7-lead-finder` | **Blocked until that page ships** |
| `AG2 \| Outscraper Alternative` | `[outscraper alternative]`, `[alternative to outscraper]`, `[outscraper competitors]` | `/compare/leadzipp-vs-outscraper` | **Blocked until that page ships** |
| `AG3 \| B2B Lead Finder Alt` | `[b2b lead finder alternative]`, `[b2bleadfinder alternative]` | `/compare/leadzipp-vs-b2bleadfinder` | Live now |
| `AG4 \| Category Alternative` | `[google maps scraper alternative]`, `[lead scraper alternative]`, `[local lead generation software]` | `/compare` | Live now |
| `AG5 \| Apollo For Local` | `[apollo alternative for local businesses]`, `[apollo alternative for agencies]` | `/compare/leadzipp-vs-apollo` | Live now |

**The trademark warning, stated plainly because it is a real risk and the owner is
deciding, not me.** Bidding a competitor's brand name as a *keyword* is generally permitted
by Google. Google's trademark policy states it does not investigate or restrict trademark
use **as keywords** at all. Trademark use in **ad text** is restricted, and specifically so
when used "by direct competitors" or in a confusing or misleading way. Enforcement is
**complaint-driven**: nothing happens until the trademark owner files, and Google issues a
warning at least 7 days before any suspension
([Google Ads trademark policy](https://support.google.com/adspolicy/answer/6118)).

There is an *informational site* exception for landing pages whose "primary purpose is to
provide informative details about products or services corresponding to the trademark,"
which the `/compare/*` pages arguably satisfy. **Do not rely on it.** LeadZipp is a direct
competitor, which is the exact category the policy names. Google publishes **no** named
policy for "X alternative" ad copy, so there is no safe harbor to point at.

**The rule for this account: competitor trademarks in keywords, never in ad text.** Every
RSA in section D for these ad groups uses "scraper alternative" and "compare local lead
tools" rather than naming anyone. The comparison landing pages may name competitors, because
that is editorial content, and `src/lib/comparePages.ts:1-19` already enforces accuracy
rules on every claim there.

The second risk is not legal. **b2bleadfinder.io, d7 and Outscraper can all retaliate by
bidding on "leadzipp".** They have brand searches to defend and LeadZipp has almost none,
so a brand-bidding war is asymmetric against LeadZipp. B1 exists partly as a hedge against
exactly this. If any of them starts bidding on "leadzipp", the correct response is to raise
the brand campaign's bid and leave the alternative campaign alone, not to escalate.

**Do not bid `[apollo]`, `[hunter io]`, `[zoominfo]` or `[outscraper]` bare.** Those are
head brand terms with large, well-funded defenders and a buyer who is mostly not LeadZipp's
buyer. The modifier is what makes the keyword qualified.

### B5. Microsoft Advertising (Bing). FIFTH, Tier 2 onward.

**Budget: $0 at Tier 1, $150/mo at Tier 2, up to $600 at Tier 3.**

Microsoft Advertising has a built-in Google Ads import tool with three modes (Quick, Smart,
Advanced) and, since May 2026, an Import Center for managing them, so this channel costs
roughly twenty minutes of setup and reuses everything in B1 and B4
([Microsoft Advertising FAQ](https://about.ads.microsoft.com/en/get-started/new-advertiser-faqs),
[Import Center announcement](https://about.ads.microsoft.com/en/blog/post/may-2026/new-import-center-and-other-product-news-for-may-2026)).

**On the "Bing is cheaper" claim: Microsoft publishes no discount figure.** Their only
official language is qualitative: "usually has less competition, which can mean lower costs
and more qualified customers in certain audiences." The 30 to 60% discounts quoted
everywhere online are mutually inconsistent blog estimates with no primary source, and no
B2B-SaaS-specific figure exists at all. Plan for *some* discount and *much* less volume, and
let the first two weeks tell you the number.

CPC estimate: **$0.90 to $2.50, planning at $1.60. Inference**, derived by discounting the
B4 range. Not a benchmark.

**Three things to do on import, every time:**
1. **Turn off the Microsoft Audience Network.** Imported search campaigns are auto-enabled
   onto MSAN, which is native display inventory on MSN and Outlook, not search intent. Path:
   **Ad group → Settings → Other Settings → Ad Distribution → select "Microsoft sites and
   select traffic"**. The old -100% bid-adjustment workaround is no longer available on many
   accounts ([Microsoft Q&A](https://learn.microsoft.com/en-us/answers/questions/2288982/how-to-turn-off-audience-ads)).
2. Re-check location targeting after import. The presence-only setting does not always
   survive.
3. Set the import to manual, not scheduled. An automatic daily sync will quietly re-enable
   things you turned off.

It is fifth rather than second only because it is not worth the setup time until there is a
Google campaign proven worth copying. Once B4 exists, this is the cheapest incremental
volume in the plan.

### B6. LinkedIn. NO.

The targeting is genuinely the best available for reaching agency owners by job title and
company size. It is also the most expensive click in mainstream advertising. The best-disclosed source
available reports a **$5 to $25 range** across 40 campaigns and $8.4M of spend and
deliberately refuses to name a single average
([The Smarketers, June 2026](https://thesmarketers.com/blogs/linkedin-ads-benchmarks-2026/));
LinkedIn itself publishes no official CPC benchmark, and every circulating point estimate
traces to templated benchmark-farm sites. On top of that it has a practical minimum daily
budget that makes a readable test cost several hundred dollars before any learning. Against a $68 CAC ceiling,
one LinkedIn click can cost a fifth of an entire allowable acquisition. **Revisit at a
$99/mo price point or at an annual-only offer, never at $25/mo monthly.**

### B7. X / Twitter. NO.

Clicks are genuinely cheap: a median around $0.18 and an average around $0.87, though the
source carrying those figures labels them 2025 data inside a 2026-titled post, which tells
you how much care went into it. The problem is not price. There is no equivalent to Reddit's
community targeting for reaching agency owners specifically, brand-safety controls are
weaker than the alternatives, and the one concrete comparison available puts X's
visitor-to-lead rate at roughly a quarter of LinkedIn's. All of those figures are
blog-sourced and none should be planned against. There is no argument for it that does
not apply more strongly to Reddit. **Skip.** The founder's own organic X account is a
better use of the same attention, at zero cost.

### B8. Google Display and YouTube. NO, except one exception.

Cold display for a $25/mo B2B tool is the most reliable way to spend a budget on nothing.
The one defensible use is **Google remarketing to site visitors**, which is the same idea
as B2 on Google's inventory. Add it only at Tier 3, only after the Meta retargeting
campaign has produced a measurable conversion, and cap it at $150/mo. Do not run it as a
"Display Expansion" toggle on a search campaign, which is how it usually gets in by
accident. Check that toggle is off on every search campaign.

### B9. The non-paid alternatives that beat all of the above per dollar

Named because a paid plan that does not name them is dishonest, not to stall the launch.

- **Getting the 132 location pages indexed.** GSC reports roughly 29 of 208 indexed. Each
  additional indexed page is a permanent, compounding, zero-CPC asset. Nothing in this
  document has a better return per hour than working the indexing problem.
- **The `/free-audit` tool as a shareable artifact.** An agency that scores a prospect and
  sends them the report is doing LeadZipp's distribution for free. That mechanic is worth
  more than the $300 test if it is instrumented, which today it is not.
- **Honest participation in the same subreddits B3 targets.** Costs nothing, converts
  better, and produces the testimonials that would raise every landing page conversion
  rate in this plan. There are zero customers on record today and no social proof exists;
  three named quotes would do more for LP conversion than any headline in section D.

### B10. Competitor reality check, fetched 2026-08-18

This changes how the comparison ad groups should be written, so it belongs here rather than
in a footnote.

| Competitor | What they charge | What matters for the auction |
| --- | --- | --- |
| **b2bleadfinder.io** | From **$14.99/mo**, annual roughly 30% cheaper. Tier table is JS-rendered and would not resolve; a search snippet reports Starter $14.99 / Pro $49.99, **unverified** | **7-day free trial with no credit card, plus 25 free lead scans.** They also ship a **Digital Health Score and audit reports** feature that is functionally near-identical to `/free-audit` |
| **d7leadfinder.com** | Pricing is JS-rendered behind `/auth/choose-plan/` and would not resolve. Third-party aggregators report $44.99 / $69.99 / $119.99, and their quoted search volumes contradict D7's own live page, so **treat the dollar figures as unconfirmed** | Claims 65,000,000+ leads, up to 1,200 leads per search, results in under 3 minutes. A volume-and-speed pitch, not a scoring pitch |
| **outscraper.com** | **Pay as you go, no monthly fee.** Google Maps Scraper: first 500 businesses free, then **$3 per 1,000 records**. Email and Contacts Scraper priced identically | A developer-shaped, per-record pricing model. Very cheap at low volume |

**Three consequences for the ad copy in section D.**

1. **Never compete on price or volume.** Outscraper gives away the first 500 records and
   charges $3 per thousand after. LeadZipp's $25/mo for 100 live searches loses that
   comparison on raw records and always will. Every comparison ad must lead on **scoring and
   ranking by need**, which is the thing none of the three do.
2. **b2bleadfinder's card-free trial is a real disadvantage in a head-to-head auction.**
   They ask for no card; LeadZipp's trial requires one
   (`src/app/api/stripe/checkout/route.ts:294-296`). Against that offer, LeadZipp's stronger
   asset is the **free plan**: 25 live searches a month with no card
   (`src/lib/planPolicy.ts:31`) plus the no-signup `/free-audit` tool, which beats a
   card-required trial as a first ask. **On competitor-alternative ad groups, lead with the
   free plan and the free audit, not with the trial.** That is a real change from the annex,
   which put the trial first everywhere.
3. **b2bleadfinder shipping its own Digital Health Score means "we score them" is no longer
   a unique claim against that competitor specifically.** It still differentiates against
   D7 and Outscraper. Against b2bleadfinder, the honest differentiators are live search-time
   data and the scored-plus-live-plus-self-serve combination named in PRODUCT.md, not the
   score alone. Do not write a headline claiming LeadZipp is the only tool that scores.

---

## C. Landing page mapping

Message match is the cheapest Quality Score win available and LeadZipp owns 138+ pages that
most competitors do not have. But three of the site's pages are traps for paid traffic, and
the obvious mapping is wrong for two of them.

### The map

| Channel / ad group | Landing page | Why this page |
| --- | --- | --- |
| B1 Brand | `/` | Someone searching "leadzipp" wants the product, not a sub-page. The homepage carries the live search demo and the full conversion furniture |
| B2 Meta retarget, warm pool | `/pricing?billing=annual` | They have already seen what it does. The remaining question is price, and the parameter preselects the offer with the CAC ceiling that clears (`src/app/pricing/page.tsx:522`) |
| B2 Meta retarget, shallow pool | `/free-audit` | Visitors who bounced in under 10 seconds have not seen the product. Show them, do not price them |
| B3 Reddit, all variants | `/free-audit` | **Lowest-friction click on the site.** No signup, no card, a real result in seconds. Reddit will not tolerate a signup wall and this page does not have one |
| B4 AG1 D7 Alternative | `/compare/leadzipp-vs-d7-lead-finder` | Exact message match. Blocked until the page ships |
| B4 AG2 Outscraper Alternative | `/compare/leadzipp-vs-outscraper` | Exact message match. Blocked until the page ships |
| B4 AG3 B2B Lead Finder Alt | `/compare/leadzipp-vs-b2bleadfinder` | Live (`src/lib/comparePages.ts:407`) |
| B4 AG4 Category Alternative | `/compare` | Index page, because the query is category-shaped rather than brand-shaped |
| B4 AG5 Apollo For Local | `/compare/leadzipp-vs-apollo` | Live (`src/lib/comparePages.ts:59`) |
| B5 Bing | Mirrors B1 and B4 exactly | Imported campaigns; do not diverge the URLs or you lose the comparison |
| Tier 3 geo test only | `/leads/{category}-in-{city}` | See the warning below. Not before Tier 3 |

### Why `/free-audit` is the primary cold landing page

It is the only page on the site that delivers value before asking for anything. It takes a
business name and city, runs 16 pass-or-fail checks across the Google profile, the website
and conversion signals, and returns a Digital Health Score out of 100
(`src/app/free-audit/page.tsx:36-52`). No account, no card, nothing stored.

For cold paid traffic that is worth more than a better sales page, because it converts a
click into a demonstration instead of into a decision. It also feeds the retargeting pool,
which is where the money is actually made.

**Three fixes it needs first, all in section F:**

1. **The sitewide 200/day cap** (`src/lib/ratelimit.ts:276-280`) will deny real visitors
   once paid traffic is flowing. Raise it or budget-cap the ad group below it.
2. **It has no tracking at all.** No `free_audit_started`, no `free_audit_completed`, no
   `free_audit_cta_clicked`. Paid clicks to this page are currently unmeasurable.
3. **Its CTA points at bare `/signup`** (`src/components/marketing/FreeAuditChecker.tsx:257`),
   which creates a free account rather than starting a trial. For paid traffic this is a
   defensible choice, since the free plan is a reasonable next step after a free audit, but
   it means this ad group must be judged on `signup_completed` plus later retargeted trial
   starts, never on last-click `trial_started`. Decide deliberately; do not let it be an
   accident.

### The `/leads/{category}-in-{city}` trap, restated because it has not gone away

120 hand-written location pages look like the perfect paid asset. They are the best organic
asset LeadZipp has and a poor paid target, for one reason.

The query that matches `/leads/plumbers-in-atlanta` is "plumber leads atlanta". That phrase
is searched overwhelmingly by **plumbers who want an agency to send them customers**, not by
agencies who want a list of plumbers to pitch. Home-services lead generation is among the
most expensive inventory in Google Ads. You would pay $8 to $15 a click to reach someone who
will never buy a $25/mo agency prospecting tool, against a $68 CAC ceiling.

The same phrase means opposite things to a buyer and a non-buyer. That is the single most
expensive trap in this account and the negative list in section D6 exists mostly to defend
against it.

**These pages earn their value through indexing, not through clicks.** Only try a geo ad
group at Tier 3, only with keywords phrased from the agency's side ("find businesses without
a website in atlanta", never "atlanta plumber leads"), and only after reading a full week of
search-terms data from B4.

### Pages paid traffic must not point at

| Page | Why not |
| --- | --- |
| `/leads` index | CTAs go to bare `/signup` (`src/app/leads/page.tsx:86,276`), so a paid click that converts produces a free account |
| `/compare` index | Same (`src/app/compare/page.tsx:87,207`). Exception: B4 AG4 uses it deliberately, and that ad group is measured on `signup_completed` |
| `/web-design-leads` | Same (`src/app/web-design-leads/page.tsx:172,347`) |
| `/signup` bare | Never send an ad to a naked signup form. Always `/signup?plan=pro&billing=annual` |
| Any `/blog` post | No conversion furniture, no trial CTA |

**Fix worth doing anyway, one line each:** point those five CTAs at
`/signup?plan=pro`. It costs nothing, it fixes an organic leak that is live right now, and
it unblocks three more pages as paid destinations.

### UTM and final-URL convention

Every final URL uses the same shape, extending the existing sheet at
`../outreach/utm-sheet.md` rather than inventing a second scheme:

```
https://leadzipp.com/{path}?utm_source={source}&utm_medium={medium}&utm_campaign=paid-2026-09&utm_content={adgroup-variant}
```

| Channel | `utm_source` | `utm_medium` |
| --- | --- | --- |
| Google Search | `google` | `cpc` |
| Microsoft / Bing | `bing` | `cpc` |
| Reddit Ads | `reddit` | `cpc` |
| Meta retargeting | `meta` | `retargeting` |
| Google remarketing (Tier 3) | `google` | `remarketing` |

`utm_campaign=paid-2026-09` deliberately differs from the organic launch week's
`launch-week-2026-08`, so paid and organic never merge in a report. Increment the month
each cycle. In Google Ads, set these once as **campaign-level tracking template**
suffixes rather than typing them into 40 final URLs; use `{lpurl}` plus a suffix and let
`ValueTrack` fill `utm_content` from `{adgroupname}` where possible.

---

## D. Creative batch, ready to paste

**Verified 2026 Google RSA specs**
([Google Ads Help](https://support.google.com/google-ads/answer/7684791), fetched 2026-08-18):
headlines **30 characters**, minimum 3, maximum 15. Descriptions **90 characters**, minimum
2, maximum 4. Display paths **15 characters each**, 2 fields. Business name **25**. Spaces
and punctuation count; emoji count as 2 or more. Every character count below was measured
programmatically, not estimated.

**One recent change you must design around: asset flexibility.** Since February 2025 Google
may serve **up to two RSA headlines in the sitelink slot** and may **suppress description
lines entirely** when it predicts better performance. There is no opt-out
([Google Ads Help](https://support.google.com/google-ads/answer/15967262)). Pinning to
Headline 1, Headline 2 or Description 1 is the only guaranteed placement; pins to Headline 3
or Description 2 are not honored.

**This has a compliance consequence.** Google's dishonest-pricing policy requires clear
disclosure of an automatic charge after a free trial. If the trial-terms description can be
suppressed, the disclosure can vanish from a live ad. **Pin the trial-terms line to
Description 1 in every ad group that mentions the trial**, and in the two ad groups that do
not mention a trial, do not mention one anywhere in the asset set.

**House rules applied throughout:** no em dashes, no exclamation marks, no "unlock",
"supercharge", "revolutionize" or "game-changer". **No social proof of any kind**, because
LeadZipp has zero customers, zero testimonials and zero case studies (PRODUCT.md). Nothing
below says "trusted by", names a customer count, or implies anyone else uses it.

**Every claim below traces to a file:** 25 free live searches with no card
(`src/lib/planPolicy.ts:31`), Pro $25 with 100 searches (`:45-46`), Agency $50 with 300
pooled (`:60-62`), annual $20 and $40 (`src/app/pricing/page.tsx:85,139`), 7-day trial with
card (`src/app/api/stripe/checkout/route.ts:294-296`), 14-day money-back guarantee
(`src/app/pricing/page.tsx:692-696`), 16 checks out of 100 and 3 free checks a day
(`src/app/free-audit/page.tsx:36-52`, `src/lib/ratelimit.ts:259-263`).

**Deliberately absent: the Email Finder.** It is in the product and on the pricing page, but
PRODUCT.md records that email credit packs are disabled pending written licensing permission
from the data provider. Do not advertise it until that is resolved.

### D1. Theme: Brand (campaign B1, lands on `/`)

Business name `LeadZipp` (8). Display path `/local-leads` (11) `/by-zip` (6).

**Headlines**

| # | Headline | Chars |
| --- | --- | --- |
| 1 | LeadZipp Official Site | 22 |
| 2 | LeadZipp Lead Finder | 20 |
| 3 | LeadZipp: Scored Local Leads | 28 |
| 4 | Try LeadZipp Free | 17 |
| 5 | LeadZipp Pricing And Plans | 26 |
| 6 | 25 Free Searches, No Card | 25 |
| 7 | Live Google And Yelp Data | 25 |
| 8 | Score Local Businesses | 22 |
| 9 | Find Who Needs You Most | 23 |
| 10 | LeadZipp Pro Is $25/mo | 22 |
| 11 | Search Any ZIP Or City | 22 |
| 12 | Free Website Audit Tool | 23 |
| 13 | Built For Small Agencies | 24 |
| 14 | No Website Means A Sale | 23 |
| 15 | Start Free In Two Minutes | 25 |

Pin headline 1 to position 1. Brand ads should say the brand name first.

**Descriptions**

| # | Description | Chars | Pin |
| --- | --- | --- | --- |
| 1 | LeadZipp scores local businesses on website, reviews and profile gaps. Free plan, no card. | 90 | |
| 2 | Search any ZIP or city. Live Google and Yelp listings, ranked by how much help they need. | 89 | |
| 3 | Free: 25 live searches a month, no card. Pro is $25 a month. Agency is $50 a month. | 83 | |
| 4 | Pro trial runs 7 days and needs a card. Cancel before day 7 and you are not charged. | 84 | **Pin to D1** |

### D2. Theme: Competitor alternative (campaign B4, lands on `/compare/*`)

Business name `LeadZipp` (8). Display path `/compare` (8) `/local-leads` (11).

No competitor trademark appears in any asset, per section B4.

**Headlines**

| # | Headline | Chars |
| --- | --- | --- |
| 1 | Scraper Alternative | 19 |
| 2 | Lead Scraper Alternative | 24 |
| 3 | Compare Local Lead Tools | 24 |
| 4 | Scraped Lists Vs Scored | 23 |
| 5 | A Scraper Gives A Dump | 22 |
| 6 | We Rank By Need First | 21 |
| 7 | Honest Side By Side | 19 |
| 8 | Local Leads, Scored | 19 |
| 9 | Not A Contact Database | 22 |
| 10 | See The Comparison | 18 |
| 11 | $25/mo, No Sales Call | 21 |
| 12 | 25 Free Searches, No Card | 25 |
| 13 | Live Data, Not A Snapshot | 25 |
| 14 | Built For Local Agencies | 24 |
| 15 | Pick The Right Tool | 19 |

**Descriptions**

| # | Description | Chars | Pin |
| --- | --- | --- | --- |
| 1 | Start free with 25 live searches a month and no card. Compare before you pay anyone. | 84 | **Pin to D1** |
| 2 | Most scrapers hand you every listing. LeadZipp ranks them by which one needs you most. | 86 | |
| 3 | An honest side by side on what each tool is for, written from their own public pages. | 85 | |
| 4 | Live Google and Yelp data scored on website, reviews and profile gaps. Pro is $25 a month. | 90 | |

Note the pin: per section B10, this theme leads with the **free plan**, not the trial,
because the closest competitor offers a card-free trial. No trial is mentioned anywhere in
this set, which also removes the dishonest-pricing disclosure requirement from this ad group.

### D3. Theme: No-website wedge (Tier 3 geo test and Bing, lands on `/`)

Business name `LeadZipp` (8). Display path `/no-website` (10) `/by-zip` (6).

**Headlines**

| # | Headline | Chars |
| --- | --- | --- |
| 1 | Businesses With No Website | 26 |
| 2 | Find Local Sites To Build | 25 |
| 3 | Who Has No Website Here | 23 |
| 4 | Scored By Who Needs You | 23 |
| 5 | Weakest Listings Rank First | 27 |
| 6 | Search A ZIP, Get A List | 24 |
| 7 | Live Google And Yelp Data | 25 |
| 8 | Stop Guessing Who To Call | 25 |
| 9 | Find Web Design Clients | 23 |
| 10 | One Search, One Call List | 25 |
| 11 | Thin Reviews Means A Pitch | 26 |
| 12 | 25 Free Searches, No Card | 25 |
| 13 | Pro Is $25 A Month | 18 |
| 14 | Built For Web Agencies | 22 |
| 15 | Score Every Business In ZIP | 27 |

**Descriptions**

| # | Description | Chars | Pin |
| --- | --- | --- | --- |
| 1 | Pro trial runs 7 days and needs a card. Cancel before day 7 and you are not charged. | 84 | **Pin to D1** |
| 2 | Find local businesses with no website, thin reviews or an unclaimed Google profile. | 83 | |
| 3 | Every result gets a Digital Health Score, so the biggest gaps sit at the top of the list. | 89 | |
| 4 | Free plan: 25 live searches a month, no card. Pro is $25 a month with 100 searches. | 83 | |

### D4. Theme: Free audit tool (cheap-click ad group, lands on `/free-audit`)

Business name `LeadZipp` (8). Display path `/free-audit` (10) `/audit` (5).

**Headlines**

| # | Headline | Chars |
| --- | --- | --- |
| 1 | Free Website Audit Tool | 23 |
| 2 | Score Any Local Business | 24 |
| 3 | Free Digital Health Score | 25 |
| 4 | No Signup, No Card | 18 |
| 5 | Audit A Business In Seconds | 27 |
| 6 | 16 Checks Out Of 100 | 20 |
| 7 | See Exactly What Is Broken | 26 |
| 8 | A Door Opener For Pitches | 25 |
| 9 | Score It Before You Pitch | 25 |
| 10 | Free Local Business Audit | 25 |
| 11 | Check Their Google Profile | 26 |
| 12 | Share The Score With Them | 25 |
| 13 | Three Free Checks Per Day | 25 |
| 14 | Built For Agencies | 18 |
| 15 | Try It, Nothing To Install | 26 |

**Descriptions**

| # | Description | Chars | Pin |
| --- | --- | --- | --- |
| 1 | No signup and no card. Nothing you type is stored. Three free checks per visitor a day. | 87 | **Pin to D1** |
| 2 | Paste a business name and city. Get a Digital Health Score out of 100 in seconds. | 81 | |
| 3 | Sixteen pass or fail checks on the Google profile, the website and conversion signals. | 86 | |
| 4 | Use the score as the opening line of your pitch. Then search a whole ZIP for free. | 82 | |

No trial is mentioned in this set, deliberately. This ad group's job is a demonstration, not
a sale.

### D5. Shared assets

**Sitelinks** (title 25, description lines 35 each)

| Title | Chars | Line 1 | Chars | Line 2 | Chars | URL |
| --- | --- | --- | --- | --- | --- | --- |
| Free Audit Tool | 15 | Score any business, no signup | 29 | Three free checks a day | 23 | `/free-audit` |
| See Pricing | 11 | Free, Pro $25, Agency $50 | 25 | Annual billing saves 20% | 24 | `/pricing?billing=annual` |
| Compare Tools | 13 | Honest side by side breakdowns | 30 | No card required | 16 | `/compare` |
| Browse By City | 14 | Guides for 12 US metros | 23 | Plus 12 international cities | 28 | `/leads` |
| Start Free | 10 | 25 live searches a month | 24 | Upgrade only when you need to | 29 | `/signup?plan=pro` |

**Callouts** (25 max): `25 Free Searches` (16), `No Card To Start` (16),
`Live Google And Yelp Data` (25), `Search Any ZIP Or City` (22), `Cancel Any Time` (15),
`Public Data Sources Only` (24), `Free Audit Tool` (15), `Export To CSV` (13).

**Structured snippet**, header `Services` (values 25 max): `Lead Search` (11),
`Opportunity Scoring` (19), `Digital Health Score` (20), `CSV Export` (10),
`Saved Leads` (11), `ZIP Code Search` (15), `Audit Reports` (13).

`Email Finder` is omitted on purpose. See the licensing note above.

### D6. Reddit ad variants

Reddit's headline hard maximum is 300 characters, with roughly 80 as the practical wrap
point. Body text on a free-form ad runs to 40,000. **Reddit's current image specs conflict
across every available source and the help center will not render for verification: check
the accepted ratios in the Reddit Ads upload dialog before producing anything.** Best
available reading is JPG/PNG/GIF, 3MB max, ratios 1:1, 4:5, 4:3 and 16:9, with 1200x628
looking stale.

All three variants use `Free-form` post ads, link to
`https://leadzipp.com/free-audit?utm_source=reddit&utm_medium=cpc&utm_campaign=paid-2026-09&utm_content={variant}`,
and are written to read like a person, not a brand. **Post them from the founder's account,
not a faceless brand account.** Reddit punishes the second one.

---

**Variant R1, "the tool post"** (headline 72 chars, body 572)

> **I built a free tool that scores any local business out of 100, no signup**
>
> No signup, no email. Type a business name and a city and it runs 16 pass or fail checks:
> is there a live site, is it on HTTPS, is it mobile friendly, is the Google profile
> claimed, how thin are the reviews. You get a score and a list of what is actually broken.
>
> I made it because I got tired of opening 40 tabs to figure out which prospect was worth a
> pitch. Three free checks a day, nothing stored.
>
> The paid product searches a whole ZIP or city and scores every result at once. Free plan
> there is 25 searches a month, no card. But the checker works without any of that.

---

**Variant R2, "the prospecting workflow"** (headline 62 chars, body 618)

> **How I pick which local businesses to pitch instead of guessing**
>
> The signal I care about is not company size, it is whether their online presence is
> broken. A dentist with no website is a website sale. A roofer with 4 reviews is a
> reputation sale. A salon with an unclaimed Google profile is a 20 minute fix you can
> charge for.
>
> So I built LeadZipp: pick a category and a ZIP or a city, it pulls live Google and Yelp
> listings and scores each one on those gaps, worst first. That list is my call order.
>
> Free plan is 25 live searches a month with no card. There is also a no-signup checker at
> /free-audit if you just want to score one business and see whether the scoring is any
> good.

---

**Variant R3, "the honest comparison"** (headline 73 chars, body 563)

> **Scrapers give you every listing. I wanted it sorted by who needs the work**
>
> Most Google Maps tools are extraction tools. You get 1,200 rows and you still have to
> figure out which 30 are worth a call. That sorting is the actual job.
>
> LeadZipp scores every result on website quality, review volume and profile completeness
> and puts the weakest first. Live data at search time, not a database snapshot.
>
> It is $25 a month, self serve, no sales call. Free plan is 25 live searches a month with
> no card, which is enough to check whether the scoring matches your own judgement on a
> territory you already know. That is the only test that matters.

---

**Two rules for the comments on these.** Reddit ads have a comment section and it is the
whole ballgame. Answer every question from the founder account within a few hours, and when
someone says a competitor is cheaper, agree where it is true (Outscraper genuinely is
cheaper per record) and explain the actual difference. A defensive comment section kills a
Reddit ad faster than bad creative.

### D7. Meta retargeting variants

**Meta's own Ads Guide now lists only 4:5, 1440x1800, for Facebook Feed images**, with
1200x628 and 1080x1080 no longer appearing on that page
([Meta Ads Guide](https://www.facebook.com/business/ads-guide/image/facebook-feed)). Build
4:5 as the primary asset. Meta's published text guidance on the same page is **primary text
50 to 150 characters and headline 27 characters**; these are recommendations rather than
hard caps, and Meta truncates silently rather than rejecting, which is worse. Every variant
below is inside both.

All three link to the mapped page in section C with
`utm_source=meta&utm_medium=retargeting&utm_campaign=paid-2026-09`.

**Variant M1, the price answer** (primary 149, headline 18, description 22)

- **Primary text:** You looked at LeadZipp. Here is the whole pricing page in one line: free is 25 live searches a month with no card, Pro is $25 a month, Agency is $50.
- **Headline:** Free plan, no card
- **Description:** $20/mo billed annually
- **Destination:** `/pricing?billing=annual`

**Variant M2, the scoring hook** (primary 138, headline 24, description 25)

- **Primary text:** Every business in your search gets a score out of 100 on its website, reviews and Google profile. The weakest sit at the top of your list.
- **Headline:** Score any local business
- **Description:** Live Google and Yelp data
- **Destination:** `/pricing?billing=annual`

**Variant M3, the free audit** (primary 140, headline 21, description 23)

- **Primary text:** Try it on one business first. Type a name and a city, get a Digital Health Score out of 100 in seconds. No account, no card, nothing stored.
- **Headline:** Free audit, no signup
- **Description:** Three free checks a day
- **Destination:** `/free-audit`

M3 is the variant for the shallow pool. M1 and M2 are for visitors who reached `/pricing` or
ran a search.

### D8. Negative keywords, campaign level, all Google and Bing search campaigns

Add every one of these **before** the campaign serves an impression, not after the first
week's report. The annex researched this list; it is reproduced here in condensed form
because it is the most valuable ten minutes in the setup.

**Group A, the "lead generation" trap. The expensive one.** "Roofing leads" is searched by a
roofer who wants an agency to send them customers, never by an agency who wants a list of
roofers. Same phrase, opposite buyer.

```
"leads for"  "buy leads"  "exclusive leads"  "live transfer leads"  "pay per lead"
"shared leads"  "lead marketplace"  "aged leads"  "leads near me"  "get me leads"
"lead generation company"  "lead generation agency"  "lead generation services"
"lead gen agency"  "done for you leads"  "we generate leads"  "appointment setting"
"qualified leads for"  "roofing leads"  "hvac leads"  "plumbing leads"  "solar leads"
"mortgage leads"  "insurance leads"  "medicare leads"  "final expense leads"
"real estate leads"  "mca leads"  "debt leads"  "contractor leads"  "moving leads"
"auto insurance leads"  "legal leads"  "dental leads"  "chiropractic leads"
```

**Group B, consumer and DIY intent.** People who want an actual plumber.

```
"near me"  "emergency"  "repair"  "cost"  "quote"  "estimate"  "how much"  "hire a"
"reviews"  "open now"  "24 hour"  "best plumber"  "cheapest"  "prices"  "same day"
```

`"near me"` blocks a legitimate query ("businesses without a website near me") but the
consumer variants outnumber it heavily. Keep it blocked below $1,000/mo, revisit above.

**Group C, job seekers.**

```
"jobs"  "salary"  "hiring"  "careers"  "resume"  "internship"  "vacancy"
"recruitment"  "work from home"  "remote job"  "apply"  "employment"
```

**Group D, free and DIY tool hunters.** `free` is **not** a broad negative, because it would
block "free trial" and "free plan", which are the good queries. Phrase match only.

```
"free leads"  "free lead list"  "free scraper"  "free database"  "for free"
"100% free"  "free download"  "open source"  "github"  "python script"
"chrome extension free"  "crack"  "nulled"  "torrent"  "excel template"
"google sheets"  "scraping tutorial"  "api free"
```

**Group E, students and researchers.**

```
"what is"  "meaning"  "definition"  "course"  "certification"  "tutorial"  "pdf"
"examples"  "statistics"  "how does"  "wikipedia"  "reddit"
```

Do **not** add `"vs"` or `"alternative"` while B4 is running.

**Group F, wrong product.** Contact databases and outbound tooling: adjacent, different buyer.

```
"b2b database"  "email list buy"  "buy email list"  "linkedin scraper"
"sales navigator"  "cold email software"  "crm software"  "outreach automation"
"dialer"  "call center"  "email verifier"  "email warmup"  "data enrichment"
"intent data"  "abm"  "sales engagement"
```

**Group G, unrelated commercial.**

```
"amazon"  "ecommerce"  "shopify"  "dropshipping"  "affiliate"  "mlm"
"network marketing"  "crypto"  "forex"  "nft"  "real estate investing"  "wholesaling"
```

**A setting, not a negative, with the same effect.** Set location targeting to **Presence:
people in your targeted locations** on every campaign. The "presence or interest" default
serves ads to people merely reading about a place and is one of the largest silent budget
leaks in a small account. Also confirm **Display Expansion is off** on every search campaign.

---

## E. Static banner spec for the designer

Brand tokens are read from `src/app/globals.css:114-149`. Do not substitute approximations.

| Token | Hex | Use |
| --- | --- | --- |
| `paper` | `#FBFAF6` | Warm base for light banners |
| `paper-2` | `#F4F1E9` | Raised warm surface, inset panels |
| `sand` | `#E7E1D4` | Hairlines, borders, the dot grid |
| `ink` | `#17130E` | Headline text on light |
| `ink-soft` | `#423B32` | Secondary text on light |
| `signal` | `#C22F0A` | **Accent and CTA on light surfaces only.** 5.67:1 on white |
| `signal-bright` | `#FF4D23` | **Dark forest surfaces only.** Never on paper |
| `forest` | `#0C2B24` | Dark base |
| `forest-900` | `#071d18` | Deepest dark, gradient floor |
| `lime` | `#CBF23F` | Rare electric highlight. One element per banner, never text under 14px |

**Type:** Bricolage Grotesque ExtraBold for display, Hanken Grotesk for body, both
self-hosted woff2 already in the repo. **Readout voice** is the small monospace label seen
across the site: uppercase, `letter-spacing: 0.04em`, roughly 0.72rem, used for the eyebrow
line only (`src/app/globals.css:300-305`). Every banner carries exactly one readout eyebrow.

**Universal rules for all sizes**

1. **Two banner families, not one.** Light family: `paper` background, `sand` dot grid at 8%
   opacity, `ink` headline, `signal` CTA pill. Dark family: `forest` to `forest-900` vertical
   gradient, white headline, `signal-bright` CTA pill, one `lime` accent. Produce both; they
   will perform differently and you want the comparison.
2. **The mark:** the LeadZipp beacon pin plus the wordmark, bottom-left on landscape sizes,
   top-left on square and skyscraper. Minimum 20px cap height. Assets in
   `outreach/directory-assets/`.
3. **No stock photography and no people.** The product is a list and a score. Show the
   artifact.
4. **No fabricated UI.** If a banner shows a result row, it must be a screenshot crop from
   `outreach/ph-gallery/` (6 real screenshots at 1270x760), not a redrawn mockup with invented
   numbers. Redrawing invents a claim.
5. **No badges, no star ratings, no "trusted by".** There is no social proof to show.
6. Text must clear 4.5:1 against its own background at every size. `signal-bright` on
   `paper` fails; that pairing is the one mistake to watch for.
7. Export PNG, sRGB, under 150KB where the platform allows it.

### E1. 1200 x 628 (1.91:1). Google Display, Reddit landscape, link previews

Three-column feel, single row. Left 62% is copy, right 38% is the artifact.

```
+--------------------------------------------------------------+
| [readout eyebrow]                     |                       |
| LOCAL BUSINESS PROSPECTING            |   [artifact panel]    |
|                                       |   score chips stacked |
| Headline, 2 lines, 56/60px            |   88 / 41 / 23        |
| Bricolage ExtraBold, ink              |   worst at the top    |
|                                       |   cropped from a real |
| Subline, 1 line, 22px, ink-soft       |   screenshot          |
|                                       |                       |
| [ CTA pill, signal, white text ]      |                       |
| [pin] LeadZipp                        |                       |
+--------------------------------------------------------------+
```

- Eyebrow (readout): `LOCAL BUSINESS PROSPECTING`
- Headline: **Find the businesses that need you most**
- Subline: **Live Google and Yelp data, scored worst first. Free plan, no card.**
- CTA pill: **Score a business free**
- Margins 56px. Headline never below 48px. CTA pill height 56px minimum.

### E2. 1080 x 1080 (1:1). Reddit and Instagram feed

Vertical stack, centered left. The square has less room, so the artifact becomes a single
score dial rather than a list.

```
+---------------------------------+
| [pin] LeadZipp                  |
|                                 |
| [readout] DIGITAL HEALTH SCORE  |
|                                 |
|      ( 34 / 100 )               |
|      big numeral, 180px         |
|      signal on paper            |
|                                 |
| Headline, 2 lines, 52px, ink    |
| Subline, 20px, ink-soft         |
|                                 |
| [ CTA pill, full width ]        |
+---------------------------------+
```

- Eyebrow: `DIGITAL HEALTH SCORE`
- Numeral: `34 / 100` set in Bricolage ExtraBold, `signal` on the light family, `lime` on the
  dark family. **Label it as an example.** Add `EXAMPLE SCORE` in readout at 12px directly
  beneath, or the banner asserts a specific business is a 34.
- Headline: **No website. Thin reviews. That is your next client.**
- Subline: **Score any local business free. No signup.**
- CTA pill: **Try the free checker**
- Margins 72px.

### E3. 1440 x 1800 (4:5). Meta feed. Build this one first.

Meta's Ads Guide now lists **only 4:5 at 1440x1800** for Facebook Feed, minimum 600x750,
JPG or PNG. 1200x628 and 1080x1080 are no longer on that page. This is the Meta asset;
E1 and E2 are for Reddit and Display.

Same composition as E2, stretched vertically: mark at top, eyebrow, artifact occupying the
middle third, headline and subline in the lower third, CTA pill anchored 120px from the
bottom. Keep all text inside a 1200x1560 safe area, because feed crops are unpredictable
across placements.

Use the three Meta copy variants from section D7 as the on-image headline, one banner each.
On-image text should restate the headline, not the primary text, or the ad reads twice.

### E4. 300 x 250 (medium rectangle). Google Display remarketing, Tier 3 only

The hardest size. **One idea only.** No artifact, no subline, no eyebrow.

```
+---------------------+
| [pin] LeadZipp      |
|                     |
| Find who needs      |
| you most            |   <- 34px, 2 lines max, ink
|                     |
| 25 free searches    |   <- 16px, ink-soft, 1 line
|                     |
| [ Start free ]      |   <- signal pill, 40px tall
+---------------------+
```

- Headline: **Find who needs you most** (2 lines at 34px)
- Support line: **25 free searches, no card**
- CTA: **Start free**
- Margins 20px. Nothing below 14px. If it does not fit, cut the support line, not the CTA.

### E5. 728 x 90 (leaderboard). Google Display remarketing, Tier 3 only

Single horizontal line. Mark, then headline, then CTA, hard right.

```
+---------------------------------------------------------------------+
| [pin] LeadZipp | Find local businesses that need a website  [ Start ]|
+---------------------------------------------------------------------+
```

- Headline: **Find local businesses that need a website** at 24px, single line, `ink`
- CTA pill: **Start free**, `signal`, right-anchored, 48px tall
- Vertical margins 16px. This size gets roughly 0.7 seconds of attention. One claim, one verb.

### E6. What to produce, in priority order

| # | Size | For | Family | Count |
| --- | --- | --- | --- | --- |
| 1 | 1440x1800 | Meta retargeting | Light + dark | 6 (3 copy variants x 2 families) |
| 2 | 1200x1200 (1:1) | Reddit, **pending ratio verification** | Light + dark | 2 |
| 3 | 1080x1080 | Reddit and Instagram fallback | Light + dark | 2 |
| 4 | 1200x628 | Reddit landscape, link previews | Light + dark | 2 |
| 5 | 300x250 | Display remarketing | Light only | 1 |
| 6 | 728x90 | Display remarketing | Light only | 1 |

Rows 5 and 6 are Tier 3 work. Do not build them for the $300 test. **Verify Reddit's
accepted ratios in the upload dialog before building row 2**, since the available sources
contradict each other and the help center will not render.

---

## F. Measurement, pre-launch checklist

The analytics layer at `src/lib/analytics.ts` is genuinely well built: typed event union,
never throws, no PII, consent gated, deduped primary conversion. The gaps are not quality
gaps, they are coverage gaps, and two of them will silently destroy the campaign data.

### F1. The blockers, in the order they must be fixed

**Blocker 1. Google advertising consent signals are hard-denied even on Accept All.**

`src/app/layout.tsx:31` and `src/lib/analytics.ts:152-156` both set `ad_storage`,
`ad_user_data` and `ad_personalization` to `'denied'` unconditionally, with the comment
"LeadZipp does not use Google advertising storage." That was true on 2026-08-12. It stops
being true the moment a Google Ads account exists.

With these denied, Google Ads conversions arrive modeled at best, remarketing audiences do
not build, and Enhanced Conversions cannot function. **Fix: when the visitor chooses `all`,
grant all four.** When they choose `necessary`, keep all four denied and keep the existing
`clearGclid()` call. Consent Mode v2's `ad_user_data` and `ad_personalization` parameters
are scoped by Google to advertisers receiving data from **end users in the EEA**
([Google Ads Help](https://support.google.com/google-ads/answer/13695607)); the US campaigns
in this plan are not in scope, but keeping the parameters correct costs nothing and the plan
targets the UK and Australia in B1.

**Blocker 2. `NEXT_PUBLIC_GTM_ID` may not be set in Vercel Production.**

`src/app/layout.tsx:17-18` and `src/components/AnalyticsScripts.tsx:13,43` are both
conditional on it. If it is only in `.env.local`, the container never loads in production
and every event in this section is theoretical. **Verify in the Vercel dashboard, not in the
repo.**

**Blocker 3. `/free-audit` has a 200/day sitewide ceiling.**

`src/lib/ratelimit.ts:276-280`, `onOutage: 'deny'`. Raise it to at least 2,000/day before
pointing paid traffic at the page, or cap the free-audit ad group's daily budget so it cannot
reach the ceiling. Section C explains why this page is the primary cold landing page, which
makes this a launch blocker rather than a nice-to-have.

### F2. Exact missing events, as a checklist

Five events exist today (`src/lib/analytics.ts:29-34`). Here is everything the ads funnel
needs that does not exist, with the file to change.

| # | Event | Status | Where to add | Why ads need it |
| --- | --- | --- | --- | --- |
| 1 | `page_view` on client-side route changes | **Missing** | GTM container, not code. Add a **History Change** trigger and fire the GA4 config tag on it | Next.js App Router soft-navigations do not reload the page, so GTM's default pageview fires once per session. Every funnel step after the landing page is currently invisible |
| 2 | `checkout_started` on the signup auto-launch path | **Missing** | `src/app/(auth)/signup/page.tsx:200`, immediately before the `fetch('/api/stripe/checkout')` call | This is **the** paid conversion path. `/pricing` fires it (`src/app/pricing/page.tsx:550`); the signup handoff does not, so the primary route to checkout is the one route with no event. Reuse the existing name with a new `source: 'signup' \| 'pricing'` prop rather than inventing `trial_checkout_started`, so GTM needs one tag and Google Ads one action |
| 3 | `free_audit_started` | **Missing** | `src/components/marketing/FreeAuditChecker.tsx`, on submit | `/free-audit` has zero tracking. Paid clicks there are unmeasurable today |
| 4 | `free_audit_completed` | **Missing** | Same file, on a successful score render. Carry a coarse score bucket, never the business name | Measures whether the cheap-click landing page actually delivered value |
| 5 | `free_audit_cta_clicked` | **Missing** | Same file, line 257 link | The only bridge between the free tool and a signup. Without it the Reddit ad group cannot be judged at all |
| 6 | `value` and `currency` on `trial_started` | **Missing** | `src/lib/analytics.ts:61-64` and `:430` | Google Ads cannot value-bid on a valueless conversion. Set **value 30, currency USD**, derived as 45% trial-to-paid x $68 of contribution inside the 3-month payback window. It is a bid signal, not revenue |
| 7 | `subscription_paid` uploaded, not logged | **Log only** | `src/app/api/stripe/webhook/route.ts:96-107` `logOfflineConversion()` writes a `console.log` and nothing else. The comment at `:35-38` says so | The day-7 payment is the only conversion that is real money. See F3 |
| 8 | `fbclid` capture | **Missing** | `src/lib/analytics.ts:291`, generalize `captureGclid()` into `captureClickIds()` covering `gclid`, `fbclid`, `msclkid`, `rdt_cid` | Zero matches for `fbclid`, `msclkid`, `utm_source` or `utm_campaign` anywhere in `src/`. Meta, Microsoft and Reddit attribution do not exist |
| 9 | UTM persistence | **Missing** | Same place. Store `utm_source`, `utm_medium`, `utm_campaign`, `utm_content` in a first-party cookie alongside the click ids, and write them to `users_profile` at signup next to `gclid` | Without it, a signup that arrived from Reddit and converted a week later attributes to direct. Every non-Google channel in this plan is unattributable until this ships |
| 10 | Meta pixel | **Missing entirely** | New. Load it from `src/components/AnalyticsScripts.tsx` under the same consent gate as GTM, or add it as a GTM tag | B2 cannot run without it, and the pool has to start filling **before** Product Hunt week, not after |

**Priority order for a solo founder with limited hours:** blockers 1 and 2 first, then
events 2, 10, 8, 9, then 3 through 6, then 7. Items 1 and 2 are worth more than everything
else combined because they gate the whole system.

**The single most important instruction in this section: `signup_completed` must never be
marked as a Primary conversion in Google Ads.** The free plan gives 25 live searches a month
with no card (`src/lib/planPolicy.ts:31`) and cached reruns are free on top. That is enough
for a freelancer to work a small territory indefinitely. If free signup is the optimization
target, Google will bid hard toward people who want a free tool forever, the dashboard will
show a falling cost per conversion, and revenue will stay at zero. **This is the most common
way a plan like this fails, and it fails while looking like it is working.**

### F3. Google Ads conversion actions and the import path

| Conversion action | Source | Category | Count | Value | Primary? |
| --- | --- | --- | --- | --- | --- |
| `Trial Start (Card)` | `trial_started` via GTM | Sign-up | One | $30 | **Yes. The only bidding target** |
| `Paid Subscription` | Offline import from Stripe | Purchase | One | Actual invoice amount | Yes, once volume exists |
| `Free Signup` | `signup_completed` | Sign-up | One | $0 | **No. Observation only** |
| `Checkout Started` | `checkout_started` | Other | One | $0 | No |
| `Free Audit Completed` | `free_audit_completed` | Other | One | $0 | No |

**GA4 to Google Ads import**
([Google Ads Help](https://support.google.com/google-ads/answer/2375435)):
Goals icon → Conversions → Summary → **+ New conversion action** → **Import** → Google
Analytics (GA4) → Continue → select the events → Import and continue → Done. Edit later at
Conversions → Summary → click the action → Edit Settings.

**Offline conversion import for the day-7 payment, and the deadline that changed it**

The webhook already produces everything Google needs: `gclid`, conversion time, value and
currency, deduped, at `src/app/api/stripe/webhook/route.ts:82-108`. It just prints them.

Two things about the upload path changed in 2026 and both matter here:

1. **Since 15 June 2026, offline conversion imports and enhanced-conversions-for-leads
   uploads migrated to the Data Manager API and are blocked in the Google Ads API.** Building
   an automated uploader against the Google Ads API is now the wrong project.
2. **Google explicitly labels offline conversion import a legacy feature** and recommends new
   advertisers start with enhanced conversions for leads instead
   ([Google Ads Help](https://support.google.com/google-ads/answer/7014069)).

**The right call at LeadZipp's volume: do not build an uploader.** At one to five paid
conversions a month, upload a CSV by hand.

- **Path: Goals → Conversions → Uploads.**
- Required columns: **Google Click ID (GCLID)**, **Conversion Name** (must match the action
  name exactly), **Conversion Time**. Optional: Conversion Value, Conversion Currency.
- Since 3 October 2025, GBRAID and WBRAID identifiers may appear in the same row as a GCLID
  without erroring ([Google Ads Help](https://support.google.com/google-ads/answer/15479791)).
- Source the rows by grepping Vercel logs for `[offline-conversion]` and filtering
  `kind=invoice_paid`. Deduplicate on `dedupe_key` within a kind and on `(gclid, day)` across
  kinds, exactly as the webhook comment at `:46` instructs.
- Do this **once a week**, on the same day. Google's conversion window makes a weekly cadence
  fine and a daily one a waste of the founder's time.

**Enhanced Conversions**, for later: Settings → Customer data use → Turn on enhanced
conversions, and accept the data-processing terms. Google unified the web and leads settings
into a single on/off switch in June 2026 and now accepts user-provided data from tags, Data
Manager and API connections simultaneously
([Google Ads Help](https://support.google.com/google-ads/answer/16884284)). Not required
before launch. Worth doing before Tier 2.

### F4. UTM conventions

Extends `../outreach/utm-sheet.md` rather than replacing it. The organic launch week keeps
`utm_campaign=launch-week-2026-08`; **all paid uses `utm_campaign=paid-2026-09`**, so the two
never merge in a report.

| Channel | `utm_source` | `utm_medium` | `utm_content` |
| --- | --- | --- | --- |
| Google Search brand | `google` | `cpc` | `brand` |
| Google Search alternatives | `google` | `cpc` | `{adgroupname}` via ValueTrack |
| Microsoft / Bing | `bing` | `cpc` | `{AdGroup}` |
| Reddit Ads | `reddit` | `cpc` | `r1-tool`, `r2-workflow`, `r3-comparison` |
| Meta retargeting | `meta` | `retargeting` | `m1-price`, `m2-scoring`, `m3-audit` |
| Google remarketing (Tier 3) | `google` | `remarketing` | banner size |

In Google Ads set this once as a **campaign-level tracking template** using `{lpurl}` plus a
suffix. Do not paste UTMs into 40 individual final URLs; they will drift and the report will
lie.

**One open decision inherited from the UTM sheet.** The nine approved day-0 cold email drafts
link to a bare `leadzipp.com` and were approved verbatim. Swapping in the UTM version changes
approved copy. That decision is due before 2026-08-25 and is not this document's to make, but
note the consequence for this plan: **without it, email-sourced visitors enter the Meta
retargeting pool with no attribution**, and any trial they start will look like it came from
paid retargeting. Budget decisions in section H assume that ambiguity exists.

---

## G. Owner action list

Written to be done from a phone where possible. Each step names where you are and what you
tap. Total account setup is about 90 minutes across four platforms, plus waiting on
verification.

### G0. Do these first, tonight or tomorrow, before any account exists

1. Open the Vercel dashboard → LeadZipp project → Settings → Environment Variables.
   Confirm **`NEXT_PUBLIC_GTM_ID`** exists with scope **Production**. If it is missing,
   nothing else in this plan works. Two minutes.
2. Decide the annual question: **do paid ads lead with $20/mo billed annually, or $25/mo?**
   Section A2 says annual, strongly. This decision changes every final URL in the plan and
   it is yours, not the campaign's.
3. Decide the free-plan question: on paid landing pages, is the primary CTA the **free plan**
   or the **7-day trial**? Section B10 recommends free plan for competitor-alternative ad
   groups, trial everywhere else, because the nearest competitor offers a card-free trial.

### G1. Google Ads. Do this one first. About 30 minutes.

1. Go to **ads.google.com** → Start now. Sign in with the account that owns the GA4 property,
   so the conversion import in F3 works without an invitation dance.
2. Google will push you into a **Smart campaign**. Do not accept it. Look for
   **"Switch to Expert Mode"** near the bottom of the first screen. If you miss it, you get a
   simplified account with no keyword control and you will have to start over.
3. Choose **Create an account without a campaign**. Set currency **USD** and time zone to
   your own. **Neither can be changed later.** Getting the time zone wrong misaligns every
   daily budget and every report you will ever run.
4. Billing: Tools → Billing → Settings. Add a card. Choose **automatic payments**.
5. Set an **account-level budget cap** if the option appears in your account. If it does not,
   the daily campaign budgets in section B are the only cap and Google may spend up to
   roughly double a daily budget on any single day, balancing over the month.
6. Tools → **Linked accounts** → link **Google Analytics (GA4)** and **Search Console**.
7. Only after F1 blockers 1 and 2 are fixed: Goals → Conversions → create the five actions in
   the F3 table. Mark **only** `Trial Start (Card)` and `Paid Subscription` as Primary.

### G2. Meta Business. Do this second, because verification takes days. About 30 minutes.

1. **business.facebook.com** → Create account. Use the business name LeadZipp and
   leadzipllc@gmail.com.
2. **Domain verification takes the longest, so start it now.** Business Settings → Brand
   Safety → **Domains** → Add `leadzipp.com`. Choose the **DNS TXT record** method. Add the
   TXT record at your DNS provider, then come back and press Verify. It can take a few hours
   to propagate.
3. Business Settings → Data Sources → **Datasets** (this is where the pixel now lives) →
   Add → name it `LeadZipp Web`. Copy the **dataset ID**, which is also the pixel ID.
4. Give that ID to whoever is wiring F2 item 10. **The pixel must be live before 2026-08-26**
   so Product Hunt traffic enters the retargeting pool. This is the single most
   time-sensitive item in the whole plan: every day the pixel is not live is a day of free
   audience you never get back.
5. Add a payment method under Business Settings → Payments.
6. Do **not** create a campaign yet. B2 does not start until 2026-09-01.

### G3. Reddit Ads. About 15 minutes.

1. **ads.reddit.com** → Sign up. Use the founder's existing Reddit account if it has
   comment history; ads from an account with a real posting history do better in the
   comments, which is where Reddit ads live or die.
2. Add a payment method.
3. Create the pixel: Events Manager → **Reddit Pixel** → install. Same consent gate as
   everything else.
4. Note the floor before you budget: **$5.00/day minimum**, and minimum bids in the US, UK
   and Canada of **$0.10 CPC, $3.50 CPM**.
5. Do not launch. B3 does not start until 2026-09-01.

### G4. Microsoft Advertising. Tier 2 only. Skip for now. About 20 minutes when you get there.

1. **ads.microsoft.com** → Sign up. Choose **Import from Google Ads** during onboarding.
2. Grant read access to the Google Ads account.
3. After import, for **every** ad group: Settings → Other Settings → **Ad Distribution** →
   select **"Microsoft sites and select traffic"**. This is how you turn off the Microsoft
   Audience Network, which is on by default.
4. Set the import schedule to **manual**, not daily. A scheduled sync silently re-enables
   what you just turned off.

### G5. Standing rules for the owner while campaigns run

- **Do not touch anything for the first 7 days.** Every account's learning is worse when a
  founder edits daily. Look at it, do not change it.
- **Check the search terms report on day 4, day 10 and day 20.** Nothing else. That report is
  where the money leaks and it is the only one worth reading weekly.
- **Cap yourself at 2 hours a week.** The kill criterion in section A that trips at 4 hours a
  week is real. At $300/mo, founder time is more expensive than the media.
- **Never raise a budget in the same week you changed the creative.** You will not know which
  one moved the number.

---

## H. The 30-day launch sequence

### The Product Hunt question, answered

**Do not start paid ads until 2026-09-01. Delay the paid start until after Product Hunt week
finishes.** Three reasons, in order of weight.

1. **Retargeting needs a pool and Product Hunt is how you get one for free.** PH on 8/26,
   three Reddit organic posts on 8/25, 8/27 and 8/28, plus the cold email sequence and the
   directory submissions will produce more site visitors in that one week than $300 of ads
   buys in a month. Every one of them is a retargeting audience member at zero cost. Spending
   on cold clicks in the same week is paying for the thing you are already getting free.
2. **Paid Reddit in the same week as organic Reddit reads as astroturfing.** A paid ad
   appearing alongside a founder's organic self-post in `r/SideProject` is the pattern that
   community punishes hardest, and the organic post is worth more than the ad.
3. **PH week is a terrible measurement environment.** A spike of curious, non-buying traffic
   will contaminate every conversion rate you measure, and measuring the landing-page
   conversion rate is the entire point of the $300.

**The one exception: turn the brand campaign on before Product Hunt, on 2026-08-25.** Brand
search volume spikes during a PH launch, it is the cheapest inventory in the plan, and a
competitor intercepting "leadzipp" searches during your one launch day is the worst possible
outcome. $2/day starting the day before. That is the only paid dollar spent in August.

### Week 0: now to Sun 2026-08-24. Engineering and accounts.

| Item | Owner | Blocking? |
| --- | --- | --- |
| Fix ad consent flags (`src/app/layout.tsx:31`, `src/lib/analytics.ts:152-156`) | Eng | **Blocks everything** |
| Verify `NEXT_PUBLIC_GTM_ID` in Vercel Production | Owner, 2 min | **Blocks everything** |
| Install Meta pixel under the consent gate | Eng | **Blocks B2, and every day of delay is lost audience** |
| Create Google Ads account, Expert Mode, USD, correct time zone | Owner | Blocks B1 |
| Create Meta Business account, **start domain verification today** | Owner | Slow, start early |
| Create Reddit Ads account and pixel | Owner | Blocks B3 |
| Add `checkout_started` at `src/app/(auth)/signup/page.tsx:200` | Eng | Blocks reading the main funnel |
| Generalize `captureGclid()` to cover `fbclid`, `msclkid`, `rdt_cid` and UTMs | Eng | Blocks all non-Google attribution |
| Raise the `/free-audit` sitewide cap (`src/lib/ratelimit.ts:276-280`) | Eng | Blocks B3's landing page |
| Ship `/compare/leadzipp-vs-d7-lead-finder` and `/compare/leadzipp-vs-outscraper` | Eng | Blocks B4 AG1 and AG2 |
| Point the five bare-`/signup` CTAs at `/signup?plan=pro` | Eng, 10 min | Not blocking, but free money |
| Build the 1440x1800 Meta banners, 6 files | Designer | Blocks B2 |
| Build the Reddit 1:1 banners after verifying ratios in-platform | Designer | Blocks B3 |

**Gate at end of Week 0:** if the consent flags and GTM production check are not both done,
**do not proceed**. Everything after this point produces unreadable data without them.

### Week 1: Mon 8/25 to Sun 8/31. Launch week. Almost no paid.

| Day | Action |
| --- | --- |
| Mon 8/25 | **Turn on B1 brand only, $2/day.** Nothing else. Organic r/SideProject post runs |
| Tue 8/26 | **Product Hunt.** Zero ad changes. Watch the retargeting pool grow in Events Manager |
| Wed 8/27 | Organic r/SaaS post. Zero ad changes |
| Thu 8/28 | Organic r/startups thread. Check the Meta pool size. If it is under roughly 500, B2 slips a week |
| Fri 8/29 | Build the Google Ads campaigns in **paused** state: B1 already live, B4 with ad groups AG3, AG4, AG5, all negatives from D8 loaded, presence-only geo, Display Expansion off |
| Sat 8/30 | Build the Reddit campaign paused. Three variants, community targeting, **Audience Expansion off**, $5/day |
| Sun 8/31 | Build the Meta retargeting campaign paused. Verify the pixel is recording. Do a real test purchase with a live card and confirm `trial_started` appears in Google Ads conversion diagnostics, then refund it |

**The test purchase on Sunday is a hard gate.** If `trial_started` does not appear in Google
Ads, do not unpause anything on Monday.

### Week 2: Mon 9/1 to Sun 9/7. Paid starts. Do not touch it.

| Day | Action |
| --- | --- |
| Mon 9/1 | Unpause B2 Meta retargeting ($2/day), B3 Reddit ($5/day), B4 Google alternatives ($2.30/day). B1 continues. Total roughly $11.30/day |
| Tue to Wed | **Change nothing.** Not the bids, not the copy, not the budgets |
| Thu 9/4 | Read the **search terms report** only. Add negatives if trade-buyer intent appears. Change nothing else |
| Fri to Sun | Change nothing |

**Day 7 kill checks, Sun 9/7:** spend above $80 with zero `trial_started` anywhere means
pause everything. Any single ad group above $50 with zero conversions of any kind means pause
that ad group.

### Week 3: Mon 9/8 to Sun 9/14. First real read.

| Day | Action |
| --- | --- |
| Mon 9/8 | First full review. Cost per click by channel, cost per `trial_started`, `free_audit_completed` rate, Meta pool size |
| Tue 9/9 | One creative change permitted, in one channel only. If Reddit CTR is under 0.30%, kill Reddit rather than rewriting it |
| Thu 9/11 | Search terms report. Negatives |
| Sun 9/14 | **Day 14 kill checks.** Cost per `trial_started` above $120 stops the cold channels and keeps brand plus retargeting. Reddit CTR under 0.30% kills Reddit |

### Week 4: Mon 9/15 to Sun 9/21. Steady state.

Run it. Weekly offline conversion CSV upload every Monday (F3). Search terms report on
Thursday. Nothing else. If AG1 and AG2 were blocked at launch and the D7 and Outscraper
comparison pages have since shipped, unpause those two ad groups on Monday 9/15 with $1/day
each, taken from B3's budget rather than added.

### Week 5: Mon 9/22 to Wed 9/30. Decision.

| Day | Action |
| --- | --- |
| Mon 9/22 | Pull the full 30-day numbers. Compute the actual **landing page to trial start rate**, which is the deliverable this $300 was spent to buy |
| Tue 9/23 | Compare that measured rate against assumption A6 (1.2%). Rebuild the section A2 tables with the real number |
| Wed 9/24 | Write the one-page result. What the real CPC was per channel. What the real LP-to-trial rate was. Whether any `invoice_paid` line carries a non-null `gclid` |
| Wed 9/30 | **Apply the section A day-30 decision table.** No debate, no extension, no "one more week" |

**The overriding rule, restated because it is the one that gets ignored: if zero
`invoice_paid` lines carry a non-null click id after $300 of spend, stop.** That is the whole
answer and no further spend improves it.

---

## I. Assumption register

Every number that is not read from a file is here. The two starred rows drive the conclusion.

| ID | Assumption | Value | Basis | Risk if wrong |
| --- | --- | --- | --- | --- |
| A1 | Average Pro live searches per month | 40 | Estimate. The cap is 100 (`src/lib/planPolicy.ts:45`) so the worst case is bounded at $10 COGS | Contribution moves between $14 and $21 |
| A1b | Average Agency live searches per month | 100 | Estimate. Cap is 300 pooled (`:60`) | Contribution moves between $18 and $38 |
| A2 | Stripe fees | 2.9% + $0.30 | Standard US card pricing | Low |
| A3 | Blended contribution per month | $22.72 | Derived from A1, A1b, A2 and an 85/15 plan mix | Moderate |
| A4 | Average retention | 6 months | 4 to 8 band, no data. Zero customers exist | At 4 months LTV is $91 and the ceiling drops to $68 with no headroom |
| A5 | Blended contribution LTV | $136 | Derived from A3, A4 | Moderate |
| **A6** | **Landing page to card-required trial start** | **1.2% cold, 3.0% retargeted, 8% brand** | **Estimate. Published 3 to 5% benchmarks are for card-free trials and demo requests** | **The highest-impact unknown in the plan, and the number the $300 exists to measure. Never measured before, because until 2026-08-18 the trial CTA did not reach a card form** |
| A7 | Trial to paid | 45% | 30 to 50% band for card-required auto-charge | At 30%, cost per customer rises 50% |
| **A8** | **CPC by channel** | **Brand $0.80, retarget $0.70, Reddit $1.20, Google alt $2.50, Bing $1.60** | **See section B for per-channel source quality. Only the all-industry $5.42 search figure has a real benchmark behind it; the rest are inference or blog estimate** | **If Google alternatives land at $5.42, that ad group's cost per trial doubles and it fails its day-14 gate** |
| A9 | Plan mix | 85% Pro, 15% Agency | Estimate | Low. A richer Agency mix improves everything modestly |
| A10 | Annual share of new customers | 0% today, 25% target | The annual path exists in code but no ad has ever pointed at it | This is the lever, not a risk. See A2's table |
| A11 | Trial start bid value | $30 | Derived: 45% x $68 of contribution inside the 3-month payback window | Affects bid signal only, not the underlying economics |
| A12 | GSC indexing | ~29 of 208 | Reported by the owner. Not verifiable from the codebase | Affects the organic argument in B9, not the paid math |
| A13 | Meta retargeting pool after PH week | 500 to 2,000 | Estimate. Depends entirely on PH performance | Below ~500, B2 cannot deliver and its budget rolls to Reddit |
| A14 | Reddit monthly volume ceiling | ~$1,200 | Estimate based on seven small-to-mid subreddits | If lower, Tier 3 has nowhere to put the money and should not open |

**Sensitivity summary.** The plan's shape survives A6 being wrong in either direction,
because the budget is allocated to warm inventory whose conversion advantage is structural
rather than assumed. What the plan does **not** survive is A8 being wrong on the Google
alternatives ad group and A4 being at the low end simultaneously: that combination puts CAC
above $250 at every tier and the correct response is to stop, which is exactly what the
day-14 and day-30 kill criteria are built to catch.

---

## J. What this plan does not claim

- It does not claim paid acquisition is profitable at $25/mo billed monthly. Under base
  assumptions it is not, at any of the three tiers. It claims the loss is bounded, the
  information is worth the money, and two of the five channels do clear the ceiling.
- It does not claim any customer, any testimonial, any review score or any usage statistic.
  LeadZipp has none, and no asset in section D or E implies otherwise.
- It does not claim the CPC estimates are benchmarks. Section B labels each one, and section
  A8 flags the weakest as a day-14 failure mode.
- It does not claim the comparison pages for D7 and Outscraper exist. They do not, as of
  this writing, and the ad groups that depend on them are gated.

---

## Sources

All fetched 2026-08-18. Vendor-published pages are marked; everything else is labeled in
place where it is used.

**Google Ads (vendor-published)**
- [About responsive search ads](https://support.google.com/google-ads/answer/7684791) (15/30 headlines, 4/90 descriptions, 15-char paths, pinning behavior)
- [Search ad specifications](https://support.google.com/google-ads/answer/17092074) (25-char business name)
- [Asset flexibility](https://support.google.com/google-ads/answer/15967262) (Feb 2025: RSA headlines may serve in sitelink slots, descriptions may be suppressed, no opt-out)
- [About Enhanced CPC](https://support.google.com/google-ads/answer/2464964) (ECPC removed for Search and Display, week of 31 March 2025; Manual CPC and Maximize Clicks remain)
- [Trademark policy](https://support.google.com/adspolicy/answer/6118) (keywords unrestricted, ad text complaint-driven, informational-site exception, 7-day warning)
- [Import offline conversions](https://support.google.com/google-ads/answer/7014069) (Goals → Conversions → Uploads; OCI labeled legacy)
- [Offline conversion troubleshooting](https://support.google.com/google-ads/answer/15479791) (GBRAID/WBRAID alongside GCLID since 3 Oct 2025)
- [Conversion uploads and the Data Manager API](https://support.google.com/google-ads/answer/2998031) (15 June 2026 migration, Google Ads API path blocked)
- [Enhanced conversions changes](https://support.google.com/google-ads/answer/16884284) (April and June 2026 unification)
- [Consent Mode v2 scope](https://support.google.com/google-ads/answer/13695607) (EEA end users)
- [Import GA4 conversions](https://support.google.com/google-ads/answer/2375435)

**Benchmarks**
- [WordStream 2026 Google Ads Benchmarks](https://www.wordstream.com/blog/2026-google-ads-benchmarks) and [LocaliQ](https://localiq.com/blog/search-advertising-benchmarks/) (13,474 US search campaigns, Apr 2025 to Mar 2026; all-industry average CPC $5.42, Business Services $5.87; **no Technology/SaaS row exists**). Same company, one source.
- [The Smarketers LinkedIn Ads Benchmarks 2026](https://thesmarketers.com/blogs/linkedin-ads-benchmarks-2026/) ($5 to $25 CPC, n=40 campaigns, $8.4M spend, disclosed)

**Microsoft Advertising**
- [New advertiser FAQs](https://about.ads.microsoft.com/en/get-started/new-advertiser-faqs) (Google import tool; qualitative "less competition" language, no published discount figure)
- [Import Center, May 2026](https://about.ads.microsoft.com/en/blog/post/may-2026/new-import-center-and-other-product-news-for-may-2026)
- [Turning off Audience Ads](https://learn.microsoft.com/en-us/answers/questions/2288982/how-to-turn-off-audience-ads) (Ad group → Settings → Other Settings → Ad Distribution)

**Reddit**
- [Reddit Ads cost](https://business.reddithelp.com/s/article/How-much-do-Reddit-Ads-cost) ($5.00/day minimum; US/UK/CA minimum bids $3.50 CPM, $0.10 CPC, $0.01 CPV)
- [Community targeting overview](https://business.reddithelp.com/helpcenter/s/article/Overview-Reddit-Ads-Community-Targeting)
- Image and headline specs: sources conflict and Reddit's help center will not render for direct verification. **Verify in the Reddit Ads upload dialog before producing creative.**

**Meta**
- [Facebook Feed image specs](https://www.facebook.com/business/ads-guide/image/facebook-feed) (4:5 at 1440x1800 only; primary text 50 to 150 chars, headline 27 chars, both recommendations)
- [Conversions API Get Started](https://developers.facebook.com/docs/marketing-api/conversions-api/get-started/) (pixel ID is the dataset ID; pixel is not deprecated)
- [Website custom audience guidance](https://en-gb.facebook.com/business/help/237515166435276) ("several hundred people")
- [Custom Audience API reference](https://developers.facebook.com/docs/marketing-api/reference/custom-audience/) (no published minimum, only an opaque too-small status)

**Competitors** (fetched 2026-08-18; pricing tables on the first two are JavaScript-rendered and did not resolve, so their dollar figures are third-party and unconfirmed)
- [b2bleadfinder.io](https://b2bleadfinder.io/) and [/pricing](https://b2bleadfinder.io/pricing)
- [d7leadfinder.com](https://d7leadfinder.com/)
- [outscraper.com](https://outscraper.com/) and [/pricing](https://outscraper.com/pricing/)

**Codebase** (all read 2026-08-18): `src/lib/planPolicy.ts`, `src/lib/analytics.ts`,
`src/lib/comparePages.ts`, `src/lib/seoPages.ts`, `src/lib/ratelimit.ts`,
`src/app/layout.tsx`, `src/app/pricing/page.tsx`, `src/app/(auth)/signup/page.tsx`,
`src/app/free-audit/page.tsx`, `src/app/leads/[slug]/page.tsx`,
`src/app/compare/[slug]/page.tsx`, `src/app/api/stripe/checkout/route.ts`,
`src/app/api/stripe/webhook/route.ts`, `src/instrumentation-client.ts`,
`src/components/AnalyticsScripts.tsx`, `src/components/marketing/FreeAuditChecker.tsx`,
`src/app/globals.css`, `PRODUCT.md`, `../outreach/utm-sheet.md`.
