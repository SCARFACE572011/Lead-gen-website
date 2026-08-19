---
target: pricing page
total_score: 23
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 2
timestamp: 2026-08-18T23-44-49Z
slug: src-app-pricing-page-tsx
---
# Critique: Pricing page (src/app/pricing/page.tsx) — 2026-08-18

Method: dual-agent (A: design review · B: detector+browser)

## Heuristic scores (23/40)
H1 Status 3 · H2 Real world 2 · H3 Control 3 · H4 Consistency 2 · H5 Error prevention 3 · H6 Recognition 2 · H7 Flexibility 2 · H8 Minimalist 3 · H9 Recovery 1 · H10 Help 2

## Specificity verdict
Authored skin on interchangeable skeleton: readout eyebrows, map-grid band, forest Pro card, topo close are LeadZipp; info design + copy are generic SaaS ("Simple plans that scale with you", Zap eyebrow, check/X lists). Field-map idea never used to sell.

## Priority issues
- [P0] Logged-out paid CTA dead-ends: handleUpgrade → 401 → /login?redirectTo=/pricing, plan+billing discarded (442-445); ctaHref "/signup?plan=pro" (81,127) is dead data; ?plan= param deleted unread (398). Fix: anonymous visitors → /signup?plan=X&billing=Y, auto-resume checkout post-signup.
- [P1] Pro CTA bg-signal on forest ~2.67:1, hover signal-600 ~1.9:1 — dims toward background; violates Two Oranges Rule (216-220 vs DESIGN.md). Fix: signal-bright treatment on dark cards.
- [P1] Free-card X marks text-sand on white 1.30:1 (351) + no sr-only "Not included" — screen readers hear exclusions as features (335-383). Fix: text-stone + sr-only prefix.
- [P2] No cross-tier comparison: 28 non-parallel bullets, Free 11 rows vs Pro 8; no "Everything in Free, plus" anchor on Pro; no aligned limits row. Fix: identical 4-line mono readout block atop each card (searches/credits/saved/seats).
- [P2] alert() with raw server text at checkout moment (451,454). Fix: inline error + retry.

## Detector + browser (Assessment B)
Detector: 1 true positive — 10px feature-note pill (372). Browser (real Playwright captures 1440+390): 0 console errors, 0 overflow, cards stack clean; cookie banner covers ~bottom third of 390×844 viewport and overlaps card content; chat launcher overlaps card edge; code-documented 3.62:1 white/60 exclusions on dark card; footer white/50 text-xs on forest-900; production footer renders "© 2026LeadZipp" (no space) though source has space (653) — check after next deploy.

## Personas
Jordan (phone, cold email): single-column order buries Pro below Free's 11 bullets; "live territory searches" undefined; trial tap → login dead-end; ?plan=pro link does nothing.
Riley (vs Apollo): price never argued on-page (moat trio absent; Compare only in nav); "solo closer" reads 5-person shop out of Pro; Pro seat count undisclosed; CRM cap hidden on Pro vs "Up to 3" on Agency; no credit rollover policy stated.

## Minor
Free CTA formless (white + sand border ~1.3:1 on white card); -mt-4 spacing hack (319-322); toggle lacks aria-pressed (481-505); hidden daily caps (50/150) vs "no hidden cap" ethos; success banner says "Pro" for Agency buys (404-410); Agency card orphaned in sm: 2-col grid; Pro audit reports capped 25/mo but card implies uncapped; "10,000 per member" unverified vs planPolicy 10k flat; FAQ questions are <p> not headings; annual savings only visible after toggle.

## Strengths
1. Two-safety-nets architecture (before-pay/after-pay, 533-561) with FAQ mirror.
2. Radical honesty: every number verified against planPolicy/emailCreditPolicy/featureUsage — zero fabrication.
3. System fidelity in the skin (readout voice, warm shadows, forest/lime/glow).

## Questions
1. Why does the closing band sell Free when the 90-day metric is paid conversion?
2. Is this page documenting Free or selling Pro (Free is the longest object on it)?
3. Why is the moat argued everywhere except where the money decision happens?
