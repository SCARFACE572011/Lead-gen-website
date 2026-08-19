---
target: landing page /
total_score: 29
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 2
timestamp: 2026-08-18T23-44-49Z
slug: src-app-page-tsx
---
# Critique: Landing page (src/app/page.tsx) — 2026-08-18

Method: dual-agent (A: design review · B: detector+evidence)

## Heuristic scores (29/40)
H1 Status 3 · H2 Real world 4 · H3 Control 2 · H4 Consistency 2 · H5 Error prevention 4 · H6 Recognition 3 · H7 Flexibility 3 · H8 Minimalist 3 · H9 Recovery 2 · H10 Help 3

## Specificity verdict
Authored, not interchangeable: bespoke radar-scan hero (HeroMap.tsx phase-locked pins), readout mono voice, agency dialect. Deductions: .pin-pulse signature mark unused on flagship page; middle sections (features grid, pricing cards, FAQ) revert to standard SaaS grammar. Top and bottom authored; middle coasts.

## Priority issues
- [P0] Hero ZIP error invisible: text-signal-600 (#912E12) on forest ≈1.88:1 (HeroSearchWidget.tsx:68 on .topo hero). No aria-describedby/aria-invalid/live region. Fix: light chip or signal-bright/lime on forest + role="alert".
- [P1] Fabricated proof vs honesty claims: "These are real businesses in one ZIP" (page.tsx:265) over invented SHOWCASE businesses in 4 ZIPs (page.tsx:47-50); "not a scraped demo" (162) / "Real businesses, not a demo" (HeroSearchWidget.tsx:70) beside hardcoded 555-number demo (HeroMap.tsx:20-23); "Most popular" (332-334) with zero customers. Fix: honest labels ("what a scored block looks like"), real data or sample-territory feed, "Best value" badge.
- [P1] "any ZIP code or city worldwide" (161-162) vs widget hard-rejects non-US-ZIP (HeroSearchWidget.tsx:16-17,36-43). Fix: cut "or city worldwide" or accept cities.
- [P2] "We take your card at signup" (322) contradicts "No credit card" on skim. Fix: "Pro and Agency trials take a card; the free plan never does."
- [P2] Unpausable motion: marquee 32s, 3.6s card cycle, phone chips (WCAG 2.2.2). Fix: hover/focus pause.

## Detector (Assessment B)
12 findings, all advisory font-size drift: 2.6rem section h2s ×5 (over 2.25rem headline ramp), 15px/14.5px body copy (below 1rem floor), 10px forced readout (page.tsx:288), FirstTerritoryForm inputClass 15px. 1 false positive (page.tsx:152 hero 2.7rem inside display clamp). Browser: no tool available to that agent; leadzipp.com HTTP 200.

## Personas
Jordan (cold-email first-timer): no orientation sentence naming what LeadZipp is; "Drop a pin" label assumes map metaphor; anonymous-search capability never advertised; P0 error ends visit on typo; stats band has no third-party validation.
Sam (skeptic vs Apollo): 555 numbers confirm "fake-data tool" prior; no on-body comparison (/compare only in footer); "Claim a zip" implies exclusivity product doesn't grant; "Most popular" cheaply falsifiable; proof that exists (methodology, sample territory) buried in footer.

## Minor
Pro-card CTA bg-signal on forest (see Two Oranges); .focus-signal + .pin-pulse defined but unused; !important overrides on readout (288); marquee chips third mono register; nav "Start free" only ink-filled CTA; HeroMap rings may render elliptical (SQUEEZE 0.95 + preserveAspectRatio none); footer tagline is best positioning line, least-read location; FAQ summary weak focus; "Live" styled as metric numeral.

## Strengths
1. Radar hero: phase-locked discovery, single active index, transform/opacity-only + full reduced-motion path.
2. Truth-coupled architecture: FAQ JSON-LD from same constant; "42 industries" traces to LEAD_CATEGORIES; pricing pinned to shipped code.
3. Anonymous-search funnel verified in API (route.ts:137-176,283-306) — value-before-signup architecture.

## Questions
1. What if the hero map were real (one cached search/day)?
2. Should the widget confess it works without an account?
3. Where does Sam's Apollo objection get answered on-page?
