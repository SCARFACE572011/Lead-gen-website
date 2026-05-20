# Mobile Optimization + SEO Design
**Date:** 2026-05-20
**Project:** LeadZip

---

## Overview

Two parallel tracks: (1) make the app fully usable on mobile phones, and (2) build SEO infrastructure to rank for local-intent B2B lead generation queries. Track 1 touches UI components only. Track 2 adds new routes and content infrastructure. Neither track depends on the other.

---

## Track 1 — Mobile Optimization

### 1.1 Slide-Out Navigation Drawer

**File:** `src/components/layout/Sidebar.tsx`

The existing mobile drawer is partially implemented but lacks smooth animation and gesture support. Changes:

- Replace any `hidden/block` toggle with CSS transform: `translate-x-full` (closed) → `translate-x-0` (open), animated with `transition-transform duration-300 ease-in-out`
- Add `will-change: transform` on the drawer panel for GPU compositing
- Backdrop: `fixed inset-0 bg-black/60 backdrop-blur-sm z-40` — tap to close
- Swipe-left-to-close: track `touchstart` / `touchmove` / `touchend` on the drawer panel. If horizontal swipe delta > 60px leftward, close. No new libraries — native touch events only.
- Drawer renders at `z-50`, backdrop at `z-40`
- Body scroll locked (`overflow-hidden` on `<body>`) while drawer is open, restored on close
- All existing nav items, usage counter, plan badge, workspace name, and sign-out button are preserved unchanged

### 1.2 Bottom Sheet Filter Panel

**File:** `src/app/(dashboard)/search/page.tsx`

On mobile (< `lg` breakpoint), the filter sidebar is hidden. The current implementation shows a basic dropdown. Replace with a bottom sheet:

- Trigger: "Filters" button in the search toolbar (already exists on mobile)
- Sheet: `fixed bottom-0 left-0 right-0 z-50`, max-height `65vh`, `rounded-t-2xl`, white background, `shadow-2xl`
- Drag handle: centered `div` with `w-10 h-1 rounded-full bg-slate-300 mx-auto mt-3 mb-4`
- Animation: `translate-y-full` (closed) → `translate-y-0` (open), `transition-transform duration-300 ease-out`
- Backdrop: same pattern as drawer — `fixed inset-0 bg-black/50 z-40`, tap to close
- Content: mount the existing `<SearchFilters>` component inside the sheet unchanged — all props, callbacks, and filter state pass through identically
- "Apply" button at the bottom of the sheet closes it and triggers the search
- Sheet is scrollable internally if filters overflow

### 1.3 Compact Lead Cards on Mobile

**File:** `src/components/leads/LeadCard.tsx`

Add a `compact` prop (boolean, default false). When `compact` is true, render a minimal layout:

```
[Business Name]                          [Score chip]
[Rating ★ X.X · (N) · Distance · Open/Closed badge]
[Save Lead button]  [📞 icon btn]  [🌐 icon btn]
```

The two layouts are controlled entirely with Tailwind responsive prefixes inside `LeadCard` — no JavaScript media query hook, no prop. The compact layout renders inside a `<div className="lg:hidden">` block; the full layout renders inside `<div className="hidden lg:block">`. This avoids flash-of-wrong-layout on SSR/hydration.

Desktop (`lg+`) continues to render the full card layout with address, phone text, website URL, hours collapsible, price level, and competitor count.

The compact card hides: full address, phone number text, website URL text, hours section, price level, competitor density. These are accessible by tapping the card to open a detail sheet (future enhancement — for now, the icon buttons for call/website give the primary mobile actions).

Touch targets: all buttons in compact mode must be minimum 44×44px.

### 1.4 Homepage Hero — Inline ZIP Search

**File:** `src/app/page.tsx`

Replace the two hero CTA buttons ("Start for Free →" and "See Demo") with an inline search widget on mobile:

```
[Find leads near]
[ZIP code input ____________] [Category ▾] [Search →]
[Free · No credit card required]
```

On submit, redirect to `/search?zip={zip}&category={category}`.

Layout behavior:
- **Mobile:** Left-aligned hero text, search widget stacked vertically (ZIP input full-width, category select full-width, Search button full-width)
- **Desktop (lg+):** Keep existing layout with CTA buttons — the inline search is mobile-only (`lg:hidden` / `hidden lg:block` split)

Validation: ZIP must be 5 digits before submit (show inline error if not). Category defaults to "Restaurants" if not selected.

The existing hero headline, subheading, badge, and social proof strip below are unchanged.

### 1.5 General Mobile Fixes

Applied across all pages:

- **Touch targets:** Any `<button>` or `<a>` that is currently smaller than 44px tall gets `min-h-[44px]` or padding adjustment
- **Horizontal overflow:** `overflow-x: hidden` on `<body>` to prevent horizontal scroll caused by full-width elements
- **Table view disabled on mobile:** On the search page, hide the "Table" view mode toggle on mobile (`hidden lg:flex`) — table layout doesn't work on narrow screens. Mobile defaults to Card view.
- **Map view on mobile:** The map view toggle remains available; when active on mobile, the map fills the full content area (no sidebar competing for width)
- **Font sizes:** Audit for any `text-xs` on body copy that becomes unreadable at < 375px width; bump to `text-sm` where needed
- **Input zoom prevention:** All `<input>` elements get `text-[16px]` on mobile to prevent iOS auto-zoom on focus

---

## Track 2 — SEO

### 2.1 Fix Existing Metadata

**Pricing page** (`src/app/pricing/page.tsx`):

Currently a `'use client'` component, which prevents a `metadata` export. Fix: extract the interactive portions (billing toggle, payment status banners using `useSearchParams`) into a child `PricingClient` component. The parent `page.tsx` becomes a server component and exports:

```ts
export const metadata: Metadata = {
  title: 'Pricing — LeadZip',
  description: 'Free plan with 25 searches/month. Upgrade to Pro for unlimited searches, CSV export, and CRM integrations.',
  alternates: { canonical: 'https://leadzip.vercel.app/pricing' },
  openGraph: { ... }
}
```

**Auth pages** (`login`, `signup`, `forgot-password`, `reset-password`):

Each gets a minimal `metadata` export with a descriptive title and description. Example:
- Login: `"Sign in to LeadZip — Local Business Lead Generation"`
- Signup: `"Create your free LeadZip account — Find local B2B leads by ZIP code"`

**Canonical URLs:** Add `alternates: { canonical: '<full-url>' }` to every public page that doesn't already have it (pricing, auth pages).

**metadataBase:** Already set to `https://leadzip.vercel.app`. Update to custom domain once DNS is configured.

### 2.2 Core Web Vitals

- **Images:** All `<img>` tags on the homepage and marketing pages converted to `next/image` with explicit `width`, `height`, and `sizes` props. Add `priority` to above-the-fold images (hero).
- **Font:** Already using `display: 'swap'` on Plus Jakarta Sans — no change needed.
- **LCP target:** The hero headline should be the LCP element. Ensure it is not hidden behind a loading state on first render.
- **Script loading:** GTM and GA4 already use `strategy="afterInteractive"` — no change needed.
- **No layout shift:** Any dynamically loaded components (map, Microlink screenshots) must have explicit height placeholders to prevent CLS.

### 2.3 Programmatic Landing Pages

**Route:** `src/app/(marketing)/leads/[category]/[city]/page.tsx`

**URL pattern:** `/leads/dentists-in-los-angeles`, `/leads/plumbers-in-chicago`, `/leads/auto-shops-in-90210`

**Static generation:** `generateStaticParams` pre-renders the top 20 US cities × 30 LeadZip categories = 600 pages at build time. A `src/lib/seo/cities.ts` file exports the city list with name, state, and representative ZIP. Remaining combinations resolve dynamically (`dynamicParams = true`).

**Page structure** (each page is a server component):

```
H1: Find [Category] Leads in [City], [State]
<p> Introductory paragraph about finding [category] businesses in [city] with LeadZip </p>

[Inline ZIP search widget — same as homepage hero, pre-filled with city's ZIP]

## Why LeadZip for [Category] Leads in [City]?
3 bullet points (rating data, phone/website enrichment, export to CSV)

## Frequently Asked Questions
- How many [category] businesses are in [city]?
- What information does LeadZip show for each lead?
- Can I export [category] leads from [city] to Excel?
(3–4 FAQs per page, marked up with FAQPage schema)

[Sign up CTA card]
```

**Metadata per page:**
```ts
title: `Find ${category} Leads in ${city}, ${state} — LeadZip`
description: `Discover ${category} businesses in ${city} with ratings, phone numbers, and websites. Search by ZIP code and export your lead list instantly.`
alternates: { canonical: `https://leadzip.vercel.app/leads/${slug}` }
```

**Structured data:** FAQPage schema + BreadcrumbList (Home > Leads > [Category] > [City]).

**Internal linking:** Homepage links to the top 6 city/category combinations. The sitemap includes all 600 pre-rendered pages.

**Thin content prevention:** Each page has at minimum 200 words of unique content (intro paragraph + FAQs). City and category names are varied naturally in the copy, not keyword-stuffed.

### 2.4 Blog / Resource Section

**Routes:**
- `src/app/(marketing)/blog/page.tsx` — post listing
- `src/app/(marketing)/blog/[slug]/page.tsx` — individual post
- `src/app/(marketing)/blog/rss.xml/route.ts` — RSS feed

**Content:** MDX files in `content/blog/`. Each file has frontmatter:

```yaml
---
title: "Cold Outreach Templates for Contractor Leads"
description: "5 proven email templates for reaching out to general contractors found on LeadZip."
publishedAt: "2026-05-20"
category: "Outreach"
---
```

**Initial posts (5 at launch):**
1. "How to Find Dentist Leads in Any City Using ZIP Codes"
2. "Cold Outreach Templates for Contractor Leads"
3. "The Best Business Categories for Local B2B Lead Generation"
4. "How to Export Leads to HubSpot and Salesforce from LeadZip"
5. "Local SEO vs. Lead Generation: What's the Difference?"

**Page structure:** Post title (H1), meta description shown as subtitle, publish date, reading time, MDX content, author byline (LeadZip Team), related posts (3 cards), CTA to sign up.

**Metadata per post:** Derived from frontmatter — title, description, canonical, OG image (generated via the existing `/og` route with `?title=...`).

**Structured data:** `Article` schema with `headline`, `datePublished`, `dateModified`, `author`, `publisher`.

**RSS feed:** `/blog/rss.xml` returns a valid RSS 2.0 feed built from all MDX frontmatter. Linked from `<head>` via `alternates.types['application/rss+xml']`.

### 2.5 Sitemap Expansion

**File:** `src/app/sitemap.ts`

Update to include:
- All 600 programmatic landing pages (`/leads/[category]-in-[city]`)
- All blog posts (read from `content/blog/` at build time)
- Remove `/login` and `/signup` (no ranking value, wastes crawl budget)
- Add `/blog` listing page

Priority guidance:
- `/` → 1.0
- `/pricing` → 0.9
- `/blog` → 0.8
- Blog posts → 0.7
- Programmatic pages → 0.6
- `/privacy`, `/terms` → 0.2

### 2.6 Robots.txt Update

**File:** `src/app/robots.ts`

Add `/leads/` to `allow` list (currently disallowed under the catch-all `/` allow, but make explicit). Add `/blog/` explicitly. No change to disallowed authenticated routes.

---

## Files Modified

| File | Change |
|------|--------|
| `src/components/layout/Sidebar.tsx` | Smooth animation, swipe-to-close, scroll lock |
| `src/app/(dashboard)/search/page.tsx` | Bottom sheet filter panel, hide table view on mobile |
| `src/components/leads/LeadCard.tsx` | Add `compact` prop + compact layout |
| `src/app/page.tsx` | Inline ZIP search widget in hero (mobile) |
| `src/app/pricing/page.tsx` | Extract client parts, add metadata export |
| `src/app/(auth)/login/page.tsx` | Add metadata |
| `src/app/(auth)/signup/page.tsx` | Add metadata |
| `src/app/(auth)/forgot-password/page.tsx` | Add metadata |
| `src/app/(auth)/reset-password/page.tsx` | Add metadata |
| `src/app/sitemap.ts` | Include programmatic + blog pages |
| `src/app/robots.ts` | Explicitly allow `/leads/` and `/blog/` |

## Files Created

| File | Purpose |
|------|---------|
| `src/app/(marketing)/leads/[category]/[city]/page.tsx` | Programmatic landing pages |
| `src/lib/seo/cities.ts` | Top 20 US cities with name, state, ZIP |
| `src/lib/seo/slugify.ts` | Category + city → URL slug util |
| `src/app/(marketing)/blog/page.tsx` | Blog post listing |
| `src/app/(marketing)/blog/[slug]/page.tsx` | Individual blog post |
| `src/app/(marketing)/blog/rss.xml/route.ts` | RSS feed |
| `content/blog/*.mdx` | 5 initial blog posts |

---

## Success Criteria

**Mobile:**
- Lighthouse mobile score ≥ 85 on `/` and `/search`
- All touch targets ≥ 44px
- No horizontal scroll on any page at 375px viewport
- Drawer animation is smooth (no jank) on a mid-range Android device
- Filters bottom sheet opens/closes without layout shift

**SEO:**
- All public pages have unique title + description + canonical
- Google Search Console shows 600+ programmatic pages indexed within 4 weeks of deploy
- Core Web Vitals: LCP < 2.5s, CLS < 0.1, FID < 100ms on mobile
- Blog RSS feed validates against W3C feed validator
- Sitemap includes all public pages, no authenticated routes
