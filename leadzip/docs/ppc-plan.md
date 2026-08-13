# LeadZipp Paid Acquisition Plan

Prepared 2026-08-12. Grounded against the codebase, not against memory.
Verified files: `src/app/pricing/page.tsx`, `src/lib/seoPages.ts`, `src/lib/comparePages.ts`,
`src/app/api/stripe/checkout/route.ts`, `src/app/layout.tsx`, `src/app/(auth)/signup/page.tsx`,
`src/app/leads/[slug]/page.tsx`, `src/app/api/leads/search/route.ts`.

---

## 0. The verdict, before anything else

**Do not launch a paid acquisition campaign this month. Spend $0 on ads.**

Two separate reasons, and both are independently sufficient.

**Reason one: the arithmetic does not work at $25/mo.** To hit a survivable customer
acquisition cost, LeadZipp needs a click that costs about **19 cents**. The cheapest
realistic click on a relevant keyword is roughly **$1.50**, and the category average is
$5 to $9. That is not an optimization gap that better ad copy closes. It is a structural
gap of 8x to 20x. Full arithmetic in section 1.

**Reason two: the funnel is broken in a way that would waste 100% of the spend.** I
verified three things in the code that make paid traffic worthless today:

1. **There is no conversion tracking.** The GTM container loads, but `grep -rn "dataLayer.push" src/`
   returns zero results outside the GTM bootstrap itself. Nothing in the application
   pushes a single event. You cannot measure a trial, a checkout, or a payment.
2. **The trial CTA does not start a trial.** Every one of the 132 location pages shows
   "Start your 7-day free trial" linking to `/signup`
   (`src/app/leads/[slug]/page.tsx:110-113`, confirmed live on
   `https://leadzipp.com/leads/plumbers-in-atlanta`). The signup page contains **zero**
   references to `searchParams` and hard-redirects to `/dashboard`
   (`src/app/(auth)/signup/page.tsx:113`). Even `/signup?plan=pro` from the pricing page
   drops the plan on the floor. Every paid click that presses the main CTA creates a
   **free account**, not a trial. You would be paying $2 to $6 per click to give away
   free plans.
3. **The 138 new pages are not indexed.** They are built and invisible. Submitting the
   sitemap costs $0 and is worth more over the next two quarters than any $300 of clicks.

The honest recommendation is in section 7: do the free work first. It is not a stalling
tactic. It is where the return actually is.

If the owner wants to spend regardless, section 6 specifies a **$300 one-month
price-discovery test** with a hard kill criterion. Be clear about what that is: it buys
information about the real landing-page conversion rate, not customers. Budget it as
research, not as growth.

---

## 1. The economics

### 1.1 What a customer is actually worth

Verified from `src/app/pricing/page.tsx`:

| Plan | Monthly | Annual (per mo) | Annual total | Trial |
| --- | --- | --- | --- | --- |
| Free | $0 | $0 | $0 | n/a. 25 searches/mo, no card |
| Pro | $25 | $20 | $240 | 7-day, card required |
| Agency | $50 | $40 | $480 | 7-day, card required |

Trial confirmed at `trial_period_days: 7` in `src/app/api/stripe/checkout/route.ts:172`,
gated by a `trialEligible` check so a returning subscriber cannot re-trial.
Free plan limit confirmed as `const FREE_LIMIT = 25` at
`src/app/api/leads/search/route.ts:300`.
There is also a real 14-day money-back guarantee on the pricing page, and a 15% welcome
coupon auto-applied at checkout for visitors who claimed the popup.

**Contribution margin per Pro month:**

```
Revenue                                        $25.00
Less Google Places calls (A1: 60 searches)     ($6.00)
Less Stripe fees (2.9% + $0.30)                ($1.03)
= Contribution margin                          $17.97   ->  call it $18/mo (72%)
```

**Contribution LTV:**

```
Retention (A4): 4 to 8 months, midpoint 6
Gross LTV       = 6 x $25 = $150
Contribution LTV = 6 x $18 = $108
```

The 15% first-month coupon takes about $3.75 off that for the cohort that claims it,
so treat **$104 to $108 as contribution LTV**.

### 1.2 Allowable CAC and payback

The owner is bootstrapped, running a low-hundreds monthly budget. That is the binding
constraint. A 12-month payback is a venture-funded posture and it is not available here:
ad spend would drain working capital faster than subscriptions replenish it.

```
Payback target:   3 months
Allowable CAC at 3-month payback  = 3 x $18  = $54   (hard ceiling)
Target CAC for actual growth      = $108 / 3 = $35   (3:1 contribution LTV to CAC)
```

**Target CAC: $35. Hard ceiling: $54.** Above $54, every customer is cash-negative for
more than a quarter, which this business cannot carry.

### 1.3 The required CPC, and why paid search fails

Funnel: click -> landing page -> trial start with card -> paid on day 7.

```
A6: Landing page -> trial start (card required)   1.2%
A7: Trial -> paid                                 45%
Click -> paid                                     0.54%

Allowable CPC at $35 target  = $35 x 0.0054 = $0.19
Allowable CPC at $54 ceiling = $54 x 0.0054 = $0.29
```

**You need a 19 cent click.** Benchmarks for 2026 put average SaaS search CPC at $5.34
and B2B SaaS at $8.86, with a typical $3 to $10 range. Long-tail terms like "find
businesses without a website" will come in cheaper, realistically **$1.50 to $4.00**.
Head terms like "lead generation software" run $8 to $15.

That is a gap of 8x at the very best and 20x at the average. No bid strategy, no quality
score, and no ad copy closes it.

### 1.4 Sensitivity: is there any combination that works?

Cost per paying customer, at 45% trial-to-paid:

| CPC \ LP to trial | 1.0% | 2.0% | 3.0% | 5.0% |
| --- | --- | --- | --- | --- |
| **$1.50** | $333 | $167 | $111 | **$67** |
| **$2.50** | $556 | $278 | $185 | $111 |
| **$4.00** | $889 | $444 | $296 | $178 |
| **$8.00** | $1,778 | $889 | $593 | $356 |

Target CAC $35. Ceiling $54. Contribution LTV $108.

**Not one cell clears the $54 ceiling.** Exactly one cell ($1.50 CPC at a 5% card-required
trial rate) comes in under contribution LTV, and a 5% cold-search conversion to a
card-required trial is a number almost nobody achieves. The 3 to 5% benchmark commonly
quoted for B2B SaaS search is measured on **card-free** trials and demo requests. Asking
a stranger for a card on the first visit typically cuts that by half or more.

The conclusion is robust to being wrong about the assumptions. Even the triple-optimistic
scenario is break-even at best.

### 1.5 Where the math does work

Three configurations, in order of practicality.

**A. Annual prepay.** Pro annual collects $240 on day one. Contribution is roughly $173,
banked immediately, with zero payback risk because the cash is already in the account.
That supports an allowable CAC around **$120**. Looking at the table, $1.50 CPC at 3%
($111) and at 5% ($67) both clear. Agency annual at $480 supports roughly $230 and clears
comfortably. **This is the only configuration where a realistic cell is profitable.**

The catch: the annual option is behind a toggle on `/pricing`, no ad path reaches it, and
cold traffic converts to annual at a fraction of the monthly rate. It is a real path but a
narrow one. If you ever run paid, run it to an annual-first offer.

**B. Raise the price.** At $49/mo, contribution is about $34/mo and the 3-month ceiling
becomes $102. Several cells clear. This is the single highest-leverage lever on whether
paid ever works for LeadZipp, and it is a pricing decision rather than an ads decision. I
am naming it because it would be dishonest to present an ads plan without saying that the
price is the actual constraint.

**C. Non-paid channels.** Covered in section 7. At current pricing these dominate paid on
expected return per dollar, and it is not close.

### 1.6 A margin risk worth flagging

Pro includes **unlimited searches** at roughly $0.10 per search in Places calls. The users
most attracted by an ad promising unlimited search are the heaviest users, and they are
the least profitable. A Pro user running 200 searches a month costs $20 in COGS against
$25 in revenue. Paid acquisition selects for exactly this cohort. Consider a fair-use
ceiling before scaling any channel.

---

## 2. Recommended channel

**Recommendation: Google Search, exact match only, and not until section 7 is done.**

When there is a budget to spend, Google Search is the choice. Here is the case against
each alternative, so this is a decision rather than a survey.

**Google Search (chosen).** It is the only channel where someone types the exact problem
the product solves. "Find businesses without a website" is a person with the LeadZipp
problem, right now, in their own words. Every other channel requires you to interrupt
someone and create the need. At a budget this small, intent is the only thing that can
carry the numbers, and even it does not carry them at current pricing. It is the least
bad option, and it is also the fastest way to learn the real landing page conversion rate,
which is the number the whole business plan depends on.

**Reddit (second, revisit later).** CPCs of $0.50 to $3.00 are genuinely cheaper, and
r/agency, r/SEO and r/webdev contain the exact buyer. Two problems. First, you are buying
attention rather than intent, so the landing page conversion rate will be well below
search, which eats the CPC advantage. Second, a skeptical community audience paired with a
card-required trial is the worst possible combination. Revisit Reddit **after** Google has
told you what a trial actually costs, because Reddit without a benchmark is unreadable.
Note also that organic participation in those same subreddits costs nothing and works
better for this product.

**Meta (rejected for now).** 2026 B2B benchmarks put CPC at $1.50 to $4.20, and the
consistent finding is that cold interest-based B2B targeting wastes 40 to 70% of budget,
while the documented value sits in retargeting warm audiences and lookalikes built on
closed-won customers. LeadZipp has neither. There is no warm audience to retarget because
organic traffic to the new pages is zero, and there is no customer list to build a
lookalike from. Come back when there are 1,000+ monthly visitors and 50+ paying customers.

**LinkedIn (rejected).** The targeting is genuinely the best available for reaching agency
owners. It is also $5 to $12 per click with a practical floor of $50 to $100 per day to
generate usable data. Against a $54 allowable CAC, this is not a conversation.

**Google Display and YouTube (rejected).** Cheap clicks, roughly 0.64% conversion rate,
and no intent. The entire test budget would disappear into placements that produce
nothing. The only defensible Display use here is remarketing, which requires an audience
that does not yet exist.

**Competitor brand bidding (rejected, with a warning).** Bidding on "b2bleadfinder",
"apollo" or "hunter.io" as brand terms carries trademark exposure and, more practically,
invites retaliation. B2B Lead Finder is a small competitor who can bid on "leadzipp"
cheaply and hurt you more than you hurt them, because they have more brand searches to
defend and you have almost none to lose. The `/compare/` pages are excellent **organic**
assets for this exact purpose and cost nothing. Use them that way.

---

## 3. Campaign structure, mapped to pages that already exist

### 3.1 The real inventory

Verified from the codebase. URL pattern is `` `${category.slug}-in-${city.slug}` ``
(`src/lib/seoPages.ts:1474`).

- **10 categories:** plumbers, dentists, hair-salons, restaurants, roofing-contractors,
  auto-repair-shops, landscapers, hvac-contractors, chiropractors, law-firms
- **12 US cities:** atlanta, dallas, houston, phoenix, chicago, charlotte, tampa, denver,
  seattle, las-vegas, nashville, columbus
- **120 pages** at `/leads/{category}-in-{city}`
- **12 international pages:** `/leads/london-uk`, `/manchester-uk`, `/toronto-canada`,
  `/sydney-australia`, `/berlin-germany`, `/munich-germany`, `/paris-france`,
  `/amsterdam-netherlands`, `/madrid-spain`, `/dubai-uae`, `/riyadh-saudi-arabia`,
  `/mumbai-india`
- **4 comparison pages:** `/compare/leadzipp-vs-apollo`, `/compare/leadzipp-vs-hunter-io`,
  `/compare/leadzipp-vs-zoominfo`, `/compare/leadzipp-vs-b2bleadfinder`
- Plus the `/leads` and `/compare` indexes. 138 total.

### 3.2 The trap hiding inside the location pages

This is the most important structural point in the plan, and it inverts the obvious move.

The `/leads/{category}-in-{city}` pages look like the perfect paid asset: 120 pages of
hand-written copy ready for perfect message match. They are not, and bidding them would be
the most expensive mistake available.

The keyword that matches `/leads/plumbers-in-atlanta` is "plumber leads atlanta". That
query is searched overwhelmingly by **plumbers who want an agency to send them leads**,
not by agencies who want a list of plumbers to pitch. Home services lead generation is one
of the most expensive verticals in Google Ads. You would pay $8 to $15 per click to reach
a plumber who will never buy a $25/mo agency prospecting tool, and you would pay it against
a $54 CAC ceiling.

**The 120 location pages are outstanding SEO assets and poor paid targets.** Their value is
realized by getting them indexed (section 7, item 1), not by buying clicks to them. Only a
handful of geo terms survive the trap filter, and they are Phase 3 at the earliest.

### 3.3 Structure

Phase 1 is deliberately tiny. At $300/month you cannot spread across 138 pages and get a
readable signal anywhere. Two ad groups, one campaign.

**Campaign: `LZ | Search | US | Wedge Test`**
Budget $10/day. Exact match only. Location targeting set to **Presence: people in your
targeted locations**, never "presence or interest".

| Phase | Ad group | Keyword theme | Landing page |
| --- | --- | --- | --- |
| **1** | `AG1 \| No Website Prospecting` | businesses with no website | `https://leadzipp.com/` |
| **1** | `AG2 \| Agency Prospecting Tool` | tool to find local clients | `https://leadzipp.com/` |
| 2 | `AG3 \| Category Alternative` | local prospecting alternatives | `https://leadzipp.com/compare/leadzipp-vs-b2bleadfinder` |
| 2 | `AG4 \| Apollo Alternative Local` | apollo for local businesses | `https://leadzipp.com/compare/leadzipp-vs-apollo` |
| 2 | `AG5 \| Hunter Alternative` | find businesses not just emails | `https://leadzipp.com/compare/leadzipp-vs-hunter-io` |
| 2 | `AG6 \| Web Design Client Finding` | how to get web design clients | `https://leadzipp.com/leads` |
| 3 | `AG7 \| Geo \| Atlanta` | atlanta businesses without websites | `https://leadzipp.com/leads/plumbers-in-atlanta` |
| 3 | `AG8 \| Geo \| Dallas` | dallas businesses without websites | `https://leadzipp.com/leads/roofing-contractors-in-dallas` |
| 3 | `AG9 \| Geo \| Houston` | houston businesses without websites | `https://leadzipp.com/leads/hvac-contractors-in-houston` |
| 3 | `AG10 \| Geo \| Phoenix` | phoenix businesses without websites | `https://leadzipp.com/leads/dentists-in-phoenix` |
| 3 | `AG11 \| Intl \| UK+CA+AU` | uk/canada/australia variants | `/leads/london-uk`, `/leads/manchester-uk`, `/leads/toronto-canada`, `/leads/sydney-australia` |

**Why both Phase 1 ad groups point at the homepage.** At $300 you are testing whether any
click converts at all. Splitting the traffic across two landing pages makes both samples
statistically useless. The homepage is also the only page carrying the live search demo and
the full conversion furniture. Message match becomes worth optimizing for at Phase 2, once
there is a baseline to beat.

**Phase gates.** Phase 2 opens only if Phase 1 produces a cost per trial start under $60.
Phase 3 opens only if Phase 2 produces a paid subscription attributable to an ad click.
Do not run Phase 2 and 3 speculatively.

**Note on Phase 3 international.** CPCs in the UK, Canada and Australia for this space run
materially below US CPCs, and the buyer is identical. If any paid channel ever works for
LeadZipp, it is more likely to work there first. Worth remembering.

---

## 4. Ad copy

**Verified 2026 Google RSA specs:** headlines 30 characters (up to 15, minimum 3),
descriptions 90 characters (up to 4, minimum 2), display path 15 characters per field
(2 fields), business name 25 characters. Sitelink title 25, sitelink description lines 35
each. Callouts 25. Structured snippet values 25. Spaces and punctuation count. Emoji count
as 2 or more.

House rules applied: no em dashes, no exclamation marks, no "unlock", "supercharge" or
"revolutionize", and every claim is defensible against what the product actually does.

**Copy compliance note.** Nothing below claims the email finder, PDF export, CRM push, map
view, health score, market gap finder or outreach generator, because `/pricing` does not
list any of them in the Pro column. Advertising a feature the pricing page does not confirm
is a message-match break and a Google misrepresentation exposure. Fix the pricing page
(section 7, item 6) and this copy can be strengthened considerably.

### 4.1 RSA for AG1 | No Website Prospecting

Final URL: `https://leadzipp.com/`
Business name: `LeadZipp` (8)
Display path: `/no-website` (10) `/by-zip` (6)

**Headlines (30 max)**

| # | Headline | Chars |
| --- | --- | --- |
| 1 | Businesses With No Website | 26 |
| 2 | Find Businesses To Pitch | 24 |
| 3 | See Who Has No Website | 22 |
| 4 | Scored By Who Needs You | 23 |
| 5 | Local Prospecting Tool | 22 |
| 6 | Search Any ZIP Or City | 22 |
| 7 | Live Google And Yelp Data | 25 |
| 8 | Weakest Sites Rank First | 24 |
| 9 | Built For Web Agencies | 22 |
| 10 | 7-Day Free Trial | 16 |
| 11 | Pro Is $25 A Month | 18 |
| 12 | Free Plan, 25 Searches | 22 |
| 13 | Export Your List To CSV | 23 |
| 14 | Stop Guessing Who To Call | 25 |
| 15 | One Search, Full Call List | 26 |

**Descriptions (90 max)**

| # | Description | Chars |
| --- | --- | --- |
| 1 | Find local businesses with no website, thin reviews or a weak rating. Search any ZIP code. | 90 |
| 2 | Live Google and Yelp listings, scored so the biggest gaps sit at the top of your list. | 86 |
| 3 | Pro is $25 a month after a 7-day free trial. Card required, cancel by day 7 to pay $0. | 86 |
| 4 | Free plan: 25 searches a month, no card. Pro adds unlimited searches and CSV export. | 84 |

Description 3 is mandatory in the rotation and must be pinned to position 1 or 2. Google's
Dishonest Pricing Practices policy, enforced since 28 October 2025, requires clear
disclosure of the payment model and any automatic charge after a free trial. An ad
promoting a "7-day free trial" without stating the card requirement and the post-trial
charge is a suspension risk.

### 4.2 RSA for AG2 | Agency Prospecting Tool

Final URL: `https://leadzipp.com/`
Business name: `LeadZipp` (8)
Display path: `/local-leads` (11) `/agencies` (9)

**Headlines (30 max)**

| # | Headline | Chars |
| --- | --- | --- |
| 1 | Find Clients For Your Agency | 28 |
| 2 | Web Design Client Finder | 24 |
| 3 | Prospecting For Agencies | 24 |
| 4 | Fill Your Own Pipeline | 22 |
| 5 | Find Local Clients Fast | 23 |
| 6 | Sell Sites, SEO And Ads | 23 |
| 7 | Who Needs Your Help Most | 24 |
| 8 | Scored Local Lead Lists | 23 |
| 9 | Search By ZIP Or City | 21 |
| 10 | Worldwide City Search | 21 |
| 11 | 7-Day Free Trial, $25/mo | 24 |
| 12 | Start Free, 25 Searches | 23 |
| 13 | No Website Means A Sale | 23 |
| 14 | Built For Solo Closers | 22 |
| 15 | Skip The Cold List Buying | 25 |

**Descriptions (90 max)**

| # | Description | Chars |
| --- | --- | --- |
| 1 | Built for agencies and freelancers who sell websites, SEO and ads to local businesses. | 86 |
| 2 | Pick a ZIP code or a city anywhere, pick a category, and get a list scored by need. | 83 |
| 3 | No website, few reviews or a weak rating pushes a business up your call list. | 77 |
| 4 | Pro is $25 a month after a 7-day free trial. Card required, cancel by day 7 to pay $0. | 86 |

### 4.3 Assets

**Sitelinks** (title 25, description lines 35 each)

| Title | Chars | Line 1 | Chars | Line 2 | Chars | URL |
| --- | --- | --- | --- | --- | --- | --- |
| See Pricing | 11 | Free, Pro at $25, Agency at $50 | 31 | Annual billing saves 20% | 24 | `/pricing` |
| Compare Tools | 13 | Honest side by side breakdowns | 30 | Apollo, Hunter, ZoomInfo | 24 | `/compare` |
| Browse By City | 14 | Location guides for 12 US metros | 32 | Plus 12 international cities | 28 | `/leads` |
| Start Free | 10 | 25 searches a month, no card | 28 | Upgrade only when you need to | 29 | `/signup` |

**Callouts** (25 max)

| Callout | Chars |
| --- | --- |
| Cancel Anytime | 14 |
| No Card For Free Plan | 21 |
| 14-Day Money Back | 17 |
| Public Data Sources Only | 24 |
| Live Google And Yelp Data | 25 |
| Worldwide City Search | 21 |

All six are verified against the pricing page trust bar and FAQ.

**Structured snippet** (Header: Services, values 25 max)

`Lead Search` (11), `Opportunity Scoring` (19), `CSV Export` (10), `Search History` (14),
`Saved Leads` (11), `ZIP Code Search` (15)

**What is deliberately missing: social proof.** There are no testimonials, no customer
count, no review score, and no case study anywhere in the codebase or the site. Do not
invent any. Section 7, item 8 says what to collect. Until it exists, this copy leads on
mechanism and price, which is the only honest option.

---

## 5. Keywords and negatives

### 5.1 Keywords

Exact match `[...]` only for the test. Phrase match `"..."` is listed for Phase 2. **No
broad match anywhere.** Broad match at $300/month with no conversion history is a donation
to Google.

**AG1 | No Website Prospecting**

```
[find businesses without a website]
[businesses with no website]
[businesses without websites list]
[find companies without a website]
[local businesses without a website]
[small businesses with no website]
[how to find businesses without websites]
```
Phase 2 phrase: `"businesses with no website"`, `"find businesses without websites"`

**AG2 | Agency Prospecting Tool**

```
[local business prospecting tool]
[find local business leads]
[how to find web design clients]
[find clients for web design agency]
[google maps lead scraper]
[google maps business scraper]
[local seo prospecting tool]
[find local clients for my agency]
```
Phase 2 phrase: `"local business prospecting tool"`, `"find web design clients"`

Watch `[google maps lead scraper]` and `[google maps business scraper]` closely. They pull
two audiences: agencies who want the output, and developers who want to build a scraper
themselves. The second group never buys. If the search terms report shows developer intent,
pause them rather than trying to negative your way out.

**Phase 2 | Comparison ad groups.** All non-brand framings only. Every one of these is
flagged for trademark and retaliation risk (section 2) and should be a deliberate decision,
not a default.

```
[b2b lead finder alternative]
[apollo alternative for local businesses]
[hunter io alternative]
[zoominfo alternative for small agencies]
```

### 5.2 Negative keywords, campaign level

**Group A: The "lead generation" trap.** This is the expensive one. The same phrase means
opposite things to a buyer and a non-buyer. "Roofing leads" is searched by a roofer who
wants an agency to send them customers, never by an agency who wants a list of roofers.
Those clicks are among the most expensive in Google Ads and they will never convert here.
Add all of these before the campaign goes live, not after.

```
"leads for"              "buy leads"              "exclusive leads"
"live transfer leads"    "pay per lead"           "shared leads"
"lead marketplace"       "aged leads"             "leads near me"
"lead generation company"  "lead generation agency"  "lead generation services"
"lead gen agency"        "done for you leads"     "we generate leads"
"appointment setting"    "qualified leads for"    "get me leads"
"roofing leads"          "hvac leads"             "plumbing leads"
"solar leads"            "mortgage leads"         "insurance leads"
"medicare leads"         "final expense leads"    "real estate leads"
"mca leads"              "debt leads"             "contractor leads"
"auto insurance leads"   "moving leads"           "legal leads"
```

**Group B: Consumer and DIY intent.** People looking for an actual plumber, not for a list
of plumbers.

```
"near me"      "emergency"    "repair"      "cost"        "quote"
"estimate"     "how much"     "hire a"      "reviews"     "open now"
"24 hour"      "best plumber" "cheapest"    "prices"      "same day"
```

`"near me"` is a judgement call. It would block a legitimate query like "find businesses
without a website near me", but that query is far rarer than the consumer variants. At $300
the tradeoff favors blocking it. Revisit above $1,000/month.

**Group C: Job seekers.**

```
"jobs"        "salary"      "hiring"      "careers"     "resume"
"internship"  "vacancy"     "recruitment" "work from home"  "remote job"
"apply"       "employment"
```

**Group D: Free and DIY tool hunters.** Note that `free` is **not** a broad negative,
because it would block "free trial" queries, which are the good ones. Phrase match only, on
specific combinations.

```
"free leads"      "free lead list"    "free scraper"    "free database"
"free tool"       "for free"          "100% free"       "free download"
"open source"     "github"            "python script"   "chrome extension free"
"crack"           "nulled"            "torrent"         "excel template"
"google sheets"   "scraping tutorial"
```

**Group E: Students and researchers.**

```
"what is"      "meaning"      "definition"   "course"      "certification"
"tutorial"     "pdf"          "examples"     "statistics"  "how does"
"case study"   "wikipedia"
```

Do not add `"vs"` while the Phase 2 comparison ad groups are running.

**Group F: Wrong product.** Contact databases, enterprise sales tooling, and outbound
software are adjacent but serve a different buyer.

```
"b2b database"      "email list buy"       "buy email list"    "linkedin scraper"
"sales navigator"   "cold email software"  "crm software"      "outreach automation"
"dialer"            "call center"          "email verifier"    "email warmup"
"data enrichment"   "intent data"
```

**Group G: Unrelated commercial.**

```
"amazon"      "ecommerce"   "shopify"     "dropshipping"  "affiliate"
"mlm"         "network marketing"  "crypto"  "forex"      "nft"
"real estate investing"  "wholesaling"
```

**Setting, not a negative, but the same effect.** Set location targeting to **Presence:
people in your targeted locations**. The default, "presence or interest", serves ads to
people merely reading about a place and is one of the largest silent budget leaks in a
small account.

---

## 6. Budget, bidding, tracking, kill criterion

### 6.1 Budget

| Item | Value |
| --- | --- |
| Monthly | $300 |
| Daily | $10 |
| Campaigns | 1 |
| Ad groups | 2 |
| Duration | 30 days, untouched for the first 14 |
| Purpose | Price discovery, not customer acquisition |

$300 buys roughly 75 to 200 clicks at $1.50 to $4.00. At the assumed 1.2% trial rate that
is **1 to 2 trial starts**. Say that out loud before launching so the result is not a
surprise. This budget cannot prove that ads work. It can only prove that they do not, which
is still worth $300 to know for certain.

### 6.2 Bid strategy

**Use Maximize Clicks with a maximum CPC bid limit of $2.00.**

Reasoning. Smart Bidding needs at least 15 conversions in 30 days to function, 30+ for
Target CPA, and stability really arrives at 50 to 80. This campaign will produce 1 to 2.
Maximize Conversions and Target CPA would sit in a permanent learning phase and spend the
budget on noise. Manual CPC is defensible but adds management overhead for no gain at this
size.

The $2.00 cap is doing real work. It prevents a single $12 click from consuming 4% of the
month, and it forces the account toward the long-tail terms where the economics are least
bad. The usual objection to Maximize Clicks, that it buys the cheapest and worst traffic,
is contained here by exact-match-only keywords and the negative list above.

Switch to Maximize Conversions only after 15+ `trial_started` events in a rolling 30 days.
That will not happen at this budget.

### 6.3 Tracking: the exact conversion events

**There are currently zero `dataLayer.push` calls in the application.** The GTM container
itself loads correctly from `src/app/layout.tsx:153-160`, gated on `NEXT_PUBLIC_GTM_ID`.
Confirm that variable is set in the **Vercel Production** environment and not only in
`.env.local`, or none of this exists in production.

**Primary conversion (the only one that drives bidding):**

| Event | Fires when | Google Ads action |
| --- | --- | --- |
| `trial_started` | Stripe Checkout returns to `/dashboard?payment=success` (`checkout/route.ts:162`) | Name: `Trial Start (Card)`. Category: Sign-up. Count: One. Value: $8 fixed (A11). Primary. |

**True conversion, requires offline import:**

| Event | Fires when | Google Ads action |
| --- | --- | --- |
| `subscription_paid` | The first `invoice.paid` in `src/app/api/stripe/webhook/route.ts`, 7 days after trial start | Name: `Paid Subscription`. Category: Purchase. Count: One. Value: actual invoice amount. Primary. |

This one cannot fire in a browser, because it happens a week later with no session. It
requires **Offline Conversion Import**:

1. Capture `gclid` from the landing URL into a first-party cookie on arrival.
2. Read the cookie at signup and persist it on the user profile row.
3. On `invoice.paid` in the Stripe webhook, upload the conversion to Google Ads with the
   stored gclid, the timestamp, and the amount.

Without this, you will never connect a click to a payment, and the only metric that matters
stays permanently invisible. Build it before launch, not after.

**Secondary events (observation only, must NOT be marked Primary):**

| Event | Fires when |
| --- | --- |
| `signup_completed` | Free account created at `/signup` |
| `search_run` | First successful search in the dashboard |
| `pricing_viewed` | `/pricing` pageview |
| `checkout_started` | Successful POST to `/api/stripe/checkout`, before the Stripe redirect |

**This is the single most important instruction in the tracking section: `signup_completed`
must never be the optimization target.** The free plan gives 25 searches a month with no
card, verified at `src/app/api/leads/search/route.ts:300`. That is enough for a freelancer
to work a small territory indefinitely. If free signup is the conversion goal, Google will
optimize hard toward people who want a free tool forever, the dashboard will show a
falling cost per conversion, and revenue will be zero. This is the most common way a plan
like this fails, and it fails while looking like it is succeeding.

### 6.4 Kill criterion

**Pre-launch gate. All four must be true, or spend $0.**

1. A real test purchase fires `trial_started` and it is visible in Google Ads conversion
   diagnostics.
2. Ad click to Stripe Checkout is two clicks or fewer, and the CTA that says "free trial"
   actually reaches a card form.
3. The landing page states the trial terms adjacent to the CTA: 7 days, card required,
   auto-charge on day 7, cancel any time before.
4. GCLID capture is confirmed writing to the database.

**During the test:**

| When | Condition | Action |
| --- | --- | --- |
| Day 7 | Spend > $70 and `trial_started` = 0 | **Pause.** This is a funnel problem, not a bid problem. Do not raise the budget. |
| Day 14 | CTR < 2% on exact match | Rewrite the RSA once. Do not add budget. |
| Day 14 | Cost per `trial_started` > $150 | **Hard stop.** Implies CAC above $333, roughly 6x the ceiling. Optimization does not close 6x. |
| Any time | Search terms report shows majority trade-buyer intent | Add negatives immediately, then reassess at the next checkpoint. |

**Day 30 decision, on cost per `trial_started`:**

| Result | Implied CAC | Decision |
| --- | --- | --- |
| Under $24 | ~$54 | At the ceiling. Continue one more cycle, open Phase 2. Do not scale yet. |
| $24 to $60 | $54 to $133 | Do not scale. One more cycle only if a specific funnel fix ships between cycles. |
| Over $60 | Over $133 | **Stop paid search permanently at $25/mo pricing.** Revisit only after a price increase or an annual-first offer. |

**Overriding rule:** if `subscription_paid` attributable to paid traffic is zero after $300
of total spend, stop. That is the whole answer, and no amount of further spend improves it.

---

## 7. What to do before spending anything

This section is the actual recommendation. Items 1 through 4 are blocking. Every one of
them costs approximately nothing and each is worth more than the $300 campaign.

**1. Submit the sitemap to Google Search Console. Today.**
138 pages are built and invisible. `src/app/sitemap.ts` and `src/app/robots.ts` both exist,
so the work is done and the submission is not. Indexing takes weeks to months, which means
every day of delay pushes the entire payoff further out. There is no paid campaign at any
budget that returns more than getting 132 hand-written location pages and 4 comparison
pages into the index. If only one thing on this list gets done, make it this one.

**2. Fix the trial CTA. It is the single largest leak in the business.**
Verified: `src/app/leads/[slug]/page.tsx:110-113` shows "Start your 7-day free trial"
linking to `/signup`. `src/app/(auth)/signup/page.tsx` has zero `searchParams` references
and hard-redirects to `/dashboard` at line 113. Even the pricing page's own
`/signup?plan=pro` link drops the plan.

The fix: have the signup page read `?plan=`, and on successful signup with a plan present,
call `/api/stripe/checkout` and redirect to Stripe rather than to `/dashboard`. Then point
the location page CTAs at `/signup?plan=pro`.

Until this ships, every paid click that presses the primary CTA produces a free account. You
would be paying $2 to $6 per click to give away the free plan. This also fixes an organic
leak that is costing money right now, at zero traffic and forever after.

**3. Add conversion tracking.** Section 6.3 names the exact events. Without them you cannot
distinguish a good campaign from a bad one, and Google cannot bid.

**4. Add GCLID capture and Stripe offline conversion import.** Without it, the day-7
payment is invisible to the ad platform forever.

**5. Decide what the free plan is for.**
25 searches a month with no card is generous enough to replace the paid product for a
freelancer working one small territory. That may be an excellent product decision. It is a
disqualifying paid-acquisition decision, because paid traffic will always take the free
door. Either accept that and do not run ads, or make the trial the primary CTA on paid
landing pages and move the free plan to a secondary link. A third option is to keep 25
searches but gate export, so free demonstrates value without replacing the product.

**6. Reconcile the pricing page with the product you actually shipped.**
`/pricing` lists, for Pro: unlimited searches, 1,000 saved leads, advanced lead scoring,
lead details and contact info, CSV export, search history, lead notes and status tracking,
and priority email support. It lists "Advanced filters" as **not** included on Pro.

It does not mention the email finder, PDF export, CRM push, map view, digital health
scores, shareable audit reports, the CRM pipeline, the market gap finder, or the 5-format
outreach generator, all of which either shipped today or are marketed on
`src/lib/comparePages.ts`. That is a large release that the page a buyer reads does not
know about.

Two consequences. First, ad copy cannot claim those features, which is why section 4 does
not. Second, and larger: the pricing page is under-selling the product to every visitor
from every channel. This is free copy work with a return on organic, paid, and direct
traffic simultaneously.

**7. Confirm `NEXT_PUBLIC_GTM_ID` is set in Vercel Production.** It is present in
`.env.local`. The GTM tag in `src/app/layout.tsx` is conditional on that variable, so if it
is missing in production the container never loads and everything in section 6.3 is
theoretical.

**8. Collect social proof you are allowed to use.**
There are no testimonials, customer counts, review scores, or case studies in the codebase
or on the site, and none should be invented. Get three to five real users on record with
written permission. A named quote from one working agency owner would raise landing page
conversion more than any headline rewrite in section 4, and landing page conversion is the
variable the entire economic model in section 1 is most sensitive to.

**9. Then do the cheaper things that beat ads at this stage.**
- Participate honestly in r/agency, r/SEO, r/webdev and r/juststart. That is where the buyer
  is, it costs nothing, and it produces the testimonials from item 8.
- The `/audit/[slug]` shareable audit report is a natural free public tool. A free audit
  that a prospect can share is a distribution mechanism, not just a feature.
- The `/compare/leadzipp-vs-b2bleadfinder` page reaches competitor-brand searchers
  organically at zero cost and zero trademark risk. Bidding those same terms costs money and
  invites retaliation. Let the page do the work.

---

## 8. Assumption register

No historical data exists. Every number below is an assumption, and the two starred ones
drive the entire conclusion.

| ID | Assumption | Value | Basis | Risk if wrong |
| --- | --- | --- | --- | --- |
| A1 | Average Pro searches per month | 60 | None. Pure estimate | COGS moves $0 to $20/mo. At 200 searches, contribution falls to $4/mo and paid is impossible at any CPC |
| A2 | Stripe fees | 2.9% + $0.30 | Standard US card pricing | Low |
| A3 | Contribution margin per Pro month | $18 (72%) | Derived from A1, A2 | Moderate |
| A4 | Average retention | 6 months | Brief's 4 to 8 band. No data | At 4 months, contribution LTV is $72 and the ceiling drops to $54 with no growth headroom. At 12 months it is $216 and annual-style economics apply |
| A5 | Contribution LTV | $108 | Derived from A3, A4 | Moderate |
| **A6** | **Landing page to card-required trial start** | **1.2%** | **Estimate. Public 3 to 5% benchmarks are for card-free trials and demos** | **Highest-impact unknown in the plan. This is the number the $300 test exists to measure** |
| A7 | Trial to paid | 45% | Brief's 30 to 50% band for card-required auto-charge | At 30%, cost per customer rises 50% |
| A8 | CPC on long-tail terms | $1.50 to $4.00 | Below the $5.34 SaaS / $8.86 B2B SaaS averages, reflecting lower competition on these specific phrases | If actual CPCs land at category average, the conclusion strengthens |
| A9 | Pro to Agency mix | 85 / 15 | Estimate | Low. A richer Agency mix improves the numbers modestly |
| A10 | 15% welcome coupon uptake | Partial | Popup exists in the codebase, no uptake data | Low, roughly $3.75 one time |
| A11 | Trial start value for bidding | $8 | Derived: $18 x 45% | Only affects bid signal, not the underlying economics |

**Sensitivity summary.** The conclusion in section 0 survives being wrong about all of
these simultaneously in the favorable direction. Only if A6 reaches 5% **and** CPC holds at
$1.50 **and** retention beats 8 months does paid search approach break-even, and even then
it does not clear the $54 ceiling. That is what makes "do not spend" the confident answer
rather than a cautious one.

---

## Sources

- [About responsive search ads, Google Ads Help](https://support.google.com/google-ads/answer/7684791?hl=en)
- [Google Responsive Search Ads Character Limits 2026, TextKit](https://textkit.dev/blog/google-responsive-search-ads-character-limits)
- [Google Ads Character Limits 2026, AdsPreview](https://adspreview.us/guides/google-ads-character-limits)
- [Google Ads Sitelink Character Limits, Adsbot](https://adsbot.co/google-ads-sitelink-character-limits/)
- [About structured snippet assets, Google Ads Help](https://support.google.com/google-ads/answer/6280012?hl=en)
- [Google Ads policy update, dishonest pricing practices, effective October 2025](https://help.kliken.com/en/articles/12401029-google-ads-policy-update-dishonest-pricing-practices-effective-october-2025)
- [Google Ads policy update requires clear pricing disclosure by October 2025, Swipe Insight](https://web.swipeinsight.app/posts/google-ads-policy-update-requires-clear-pricing-disclosure-by-october-2025-19713)
- [B2B SaaS Google Ads Benchmarks 2026, Kampaio](https://www.kampaio.com/blog/b2b-saas-google-ads-benchmarks-2026)
- [B2B SaaS Google Ads CPC Benchmarks 2026, ROA Marketing](https://roa-marketing.com/blog/b2b-saas-google-ads-cpc-benchmarks-2026/)
- [100+ B2B SaaS Google Ads Benchmarks, Pipe Rocket](https://piperocket.digital/research/google-ads-benchmarks/)
- [About Smart Bidding, Google Ads Help](https://support.google.com/google-ads/answer/7065882?hl=en)
- [How Many Conversions Do Google Ads Need, KeywordMe](https://www.keywordme.io/blog/how-many-conversions-do-google-ads-need-to-optimize)
- [Reddit Ads Cost, CPC, CPM and CPA by Industry 2026, Benly](https://benly.ai/learn/reddit-ads/reddit-ads-cost-benchmarks)
- [Reddit Ads CPC and CPM Benchmarks, Stackmatix](https://www.stackmatix.com/blog/reddit-ads-cpc-cpm-benchmarks)
- [Meta Ads Benchmarks 2026 for B2B SaaS, Growth Spree](https://www.growthspreeofficial.com/blogs/meta-ads-benchmarks-2026-b2b-saas-b2b-cpm-cpc-cpl-vertical)
- [B2B Meta Ads Benchmarks, 27five](https://27five.com/blog/b2b-meta-ads-benchmarks-cpl-cpc-roas/)
- [LinkedIn Ads Cost, CPC, CPM and Budget Benchmarks 2026, Benly](https://benly.ai/learn/linkedin-ads/linkedin-ads-cost)
- [LinkedIn Ads Minimum Daily Budget in 2026, Stackmatix](https://www.stackmatix.com/blog/linkedin-ads-minimum-daily-budget-2026)
