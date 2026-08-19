# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: small marketing, web, and SEO agencies (~1–15 people) that sell services to local
businesses and constantly need new clients. They prospect between client work — the job is
"build a list of local businesses worth pitching, with contact info and a concrete reason to
reach out." Secondary: solo freelancers doing the same job alone. Speak agency language:
clients, pitches, niches, retainers — not "sales ops" or "revenue teams."

## Product Purpose

LeadZipp (leadzipp.com) searches live local-business data (Google Places + Yelp), scores every
result on digital-health signals (no website, thin reviews, weak rating), finds contact emails,
and organizes results into a light pipeline with exports and shareable audit reports.
Success for the next 90 days: **paid conversions** — free users upgrading to Pro at $25/mo.
Design pushes visitors toward experiencing value fast enough to hit metered limits and upgrade.

## Positioning

The moat is the **combination**, not one claim (owner-confirmed 2026-08-18):
scored need-signals + live data at search time + self-serve cheap. Apollo/ZoomInfo sell static
contact databases at enterprise prices; LeadZipp tells an agency **who to pitch first**, from
live data, for $25/mo with no sales call. No single claim is the backbone — surfaces may lead
with whichever leg fits the moment, but the trio travels together.

## Operating Context

User searches a niche + city → scans scored results → exports or moves leads through pipeline
stages → spends email-finder credits on the best ones → pitches. The free no-signup audit
checker at /free-audit produces shareable Digital Health Score reports agencies use as
door-openers. Current phase: launch week (cold outreach live, Product Hunt 2026-08-26).

## Capabilities and Constraints

- Metered plans — source of truth is `src/lib/planPolicy.ts` + `src/lib/emailCreditPolicy.ts`;
  every marketing number must match them. Free: 25 live searches/mo, 5 lifetime email credits,
  3 shareable audit reports/mo. Pro $25: 100 searches, 100 email credits/mo. Agency $50:
  300 pooled searches, 500 pooled credits. 7-day trials (Pro 20 / Agency 50 trial credits).
- A "live search" is a cache miss and costs real money (~$0.10); cached reruns and filter
  refinements are free. UX should favor refinement over re-searching.
- Email credit packs are code-complete but DISABLED pending written licensing permission from
  the email-data provider. Licensing constraint, not technical.
- No ANTHROPIC_API_KEY in production: chat is an FAQ engine, proposal generator is
  template-based. Do not market AI capabilities beyond this truth.
- Stripe live mode wired; webhook + checkout-redirect activation both work.

## Brand Commitments

- Name **LeadZipp** (two p's), domain leadzipp.com, 📍 beacon mark.
- Color: `--color-signal` #C22F0A (5.67:1 on white) on light surfaces; `--color-signal-bright`
  #FF4D23 ONLY on dark forest-green surfaces. Do not unify these tokens.
- Type: self-hosted woff2 — Bricolage Grotesque (display), Hanken Grotesk (body).
  Never reintroduce next/font/google (build-time fetch broke the build once).
- Voice: plain-spoken and concrete; numbers over adjectives; no hype.

## Evidence on Hand

- **Zero paying customers, zero testimonials, zero case studies. Never fabricate any** —
  no invented logos, counts, reviews, or "trusted by" walls.
- Real product screenshots: `outreach/ph-gallery/` (6 × 1270×760). Logo: `outreach/directory-assets/`.
- 138+ programmatic SEO landing pages, comparison pages (vs Apollo etc.), live free-audit tool.

## Product Principles

1. **Truth over polish** — every number traces to planPolicy.ts or a real fact.
2. **Fastest path to first pitch list** — a new agency gets a scored, usable list in their
   first session, free, no card.
3. **Design toward the upgrade moment** — value lands before limits do; hitting a ceiling
   should feel like proof the product works.
4. **Respect the meter** — searches cost money; favor cached refinement over re-searching.
5. **Agency language everywhere** — clients and pitches, not leads-ops jargon.

## Accessibility & Inclusion

WCAG AA contrast is a maintained commitment (2026-08 overhaul: 103 → 19 → 0 critical
violations; #C22F0A chosen for 5.67:1). 44px touch targets, skip link, semantic landmarks —
preserve these in all future work.
