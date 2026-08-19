---
name: LeadZipp
description: Warm field-map design system — paper, ink, and one beacon-orange signal
colors:
  paper: "#FBFAF6"
  paper-raised: "#F4F1E9"
  ink: "#17130E"
  ink-soft: "#423B32"
  stone: "#6F6757"
  sand: "#E7E1D4"
  signal: "#C22F0A"
  signal-deep: "#912E12"
  signal-wash: "#FFEDE6"
  signal-bright: "#FF4D23"
  forest: "#0C2B24"
  forest-mid: "#123A30"
  forest-deep: "#071D18"
  lime: "#CBF23F"
  sky: "#2E6BE6"
typography:
  display:
    fontFamily: "Bricolage Grotesque, Avenir Next, Segoe UI, sans-serif"
    fontSize: "2.7rem"
    fontWeight: 800
    letterSpacing: "-0.02em"
    lineHeight: 1.1
  headline:
    fontFamily: "Bricolage Grotesque, Avenir Next, Segoe UI, sans-serif"
    fontSize: "2.6rem"
    fontWeight: 800
    letterSpacing: "-0.02em"
    lineHeight: 1.15
  headline-sub:
    fontFamily: "Bricolage Grotesque, Avenir Next, Segoe UI, sans-serif"
    fontSize: "1.65rem"
    fontWeight: 800
    lineHeight: 1.15
  title:
    fontFamily: "Bricolage Grotesque, Avenir Next, Segoe UI, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.2
  body:
    fontFamily: "Hanken Grotesk, Avenir Next, Segoe UI, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.65
  body-article:
    fontFamily: "Hanken Grotesk, Avenir Next, Segoe UI, sans-serif"
    fontSize: "1.0625rem"
    lineHeight: 1.78
  body-compact:
    fontFamily: "Hanken Grotesk, Avenir Next, Segoe UI, sans-serif"
    fontSize: "0.9375rem"
    lineHeight: 1.6
  readout:
    fontFamily: "SFMono-Regular, Consolas, Liberation Mono, monospace"
    fontSize: "0.72rem"
    letterSpacing: "0.04em"
  readout-min:
    fontFamily: "SFMono-Regular, Consolas, Liberation Mono, monospace"
    fontSize: "0.6875rem"
    letterSpacing: "0.04em"
rounded:
  xs: "0.375rem"
  sm: "0.41rem"
  md: "0.6rem"
  lg: "0.75rem"
  xl: "1.125rem"
  2xl: "1.5rem"
  pill: "9999px"
components:
  cta-pill:
    backgroundColor: "{colors.signal}"
    textColor: "#FFFFFF"
    rounded: "{rounded.pill}"
    padding: "12px 24px"
  cta-pill-hover:
    backgroundColor: "{colors.signal-deep}"
    textColor: "#FFFFFF"
    rounded: "{rounded.pill}"
  button-app:
    backgroundColor: "{colors.signal}"
    textColor: "#FFFFFF"
    rounded: "{rounded.lg}"
    height: "32px"
  card:
    backgroundColor: "#FFFFFF"
    rounded: "{rounded.xl}"
    padding: "24px"
---

# Design System: LeadZipp

## Overview

**Creative North Star: "The Field Map"**

LeadZipp looks like a working map spread on a good desk: warm paper with a fine
grain, topographic contours in deep forest green, and one bright beacon pin that
marks where to go next. The system is warm and confident — a well-made physical
tool, not a tech demo. Light surfaces are cream paper with ink text; dark
sections flip into the "map world" of deep greens with contour lines, where the
beacon orange and a rare electric lime read like markings on a night chart.

Interactions are tactile and alive: cards lift on hover, buttons press down a
pixel on click, map pins pulse. Texture (grain, dot-grids, contours) keeps
surfaces from feeling flat or AI-clean, but it stays behind content, never on it.

**Key Characteristics:**
- Warm paper ground (#FBFAF6) with ink text — never sterile white/gray
- Cartographic motifs: topo contours, dot-grid, pulsing pins, mono readouts
- One voice of accent: signal red-orange, earned and rare
- Dark sections are deep map-green, not black
- Tactile motion: lift, press, pulse — 220ms with a soft spring curve

## Colors

A warm, grounded palette: paper and ink for reading, forest for depth, one signal accent for action.

### Primary
- **Signal** (#C22F0A): the accessible red-orange used for CTAs, links, active
  states, and accents on light surfaces (4.9–5.7:1 on paper/white). This is the
  default "orange" everywhere on light ground.
- **Signal Deep** (#912E12): hover/pressed state of Signal.
- **Signal Bright** (#FF4D23): the original beacon orange. Lives ONLY on dark
  forest surfaces (where Signal would die) — never on light ground.
- **Signal Wash** (#FFEDE6): tint backgrounds behind icons, highlights, badges.

### Secondary
- **Forest** (#0C2B24): deep map-green for dark marketing sections, footers, and
  the dark app theme. **Forest Mid** (#123A30) and **Forest Deep** (#071D18) layer it.
- **Lime** (#CBF23F): rare electric highlight on forest only — one detail per screen.
- **Sky** (#2E6BE6): cool support accent (charts, info), used sparingly.

### Neutral
- **Paper** (#FBFAF6): page background. **Paper Raised** (#F4F1E9): secondary surfaces.
- **Ink** (#17130E): headings/body. **Ink Soft** (#423B32): long-form secondary text.
- **Stone** (#6F6757): muted captions and placeholders.
- **Sand** (#E7E1D4): hairline borders, dividers, dot-grid dots.

### Named Rules
**The Two Oranges Rule.** Signal (#C22F0A) on light surfaces; Signal Bright
(#FF4D23) on dark forest surfaces only. Never swap them, never "unify" them —
the split exists for WCAG AA contrast.
**The One Beacon Rule.** The accent appears where action or signal lives — one
clear beacon per viewport, not orange everywhere.

## Typography

**Display Font:** Bricolage Grotesque (self-hosted woff2; falls back to Avenir Next)
**Body Font:** Hanken Grotesk (self-hosted woff2)
**Label/Mono Font:** system mono (SFMono/Consolas)

**Character:** A characterful grotesque pairing — Bricolage's quirky width and
weight give headlines warmth and confidence; Hanken keeps body text plain-spoken
and highly legible. Never load fonts from Google at build time (self-hosted only).

### Hierarchy
- **Display** (800, clamp ~2.5–4.5rem, 1.05–1.1, -0.02em): hero headlines; may
  carry one italic or Signal-colored word as the emphasis move.
- **Headline** (700–800, 1.65–2.6rem, 1.15): section titles (h2/h3).
- **Title** (700, 1.25rem, 1.2): card titles and sub-sections.
- **Body** (400–500, 0.9375–1.0625rem, 1.6–1.78): paragraphs in Ink Soft, max
  ~65ch; the 0.9375rem compact step is for card copy and form controls.
- **Readout** (mono, 0.72rem, +0.04em, UPPERCASE): coordinates, ZIPs, stats,
  eyebrow labels — the "instrument panel" voice unique to this system.

### Named Rules
**The Readout Rule.** Data fragments (counts, scores, ZIPs, coordinates) render
in the mono readout style, not in body type — the map's instrument voice.

## Layout

Max-width containers (~72–80rem) with generous vertical rhythm between marketing
sections; content stays on the paper ground while alternating full-bleed forest
bands create the light/dark cadence. The app shell is a fixed white sidebar over
paper content with dense, compact controls. Spacing follows Tailwind's 4px scale;
44px minimum touch targets. Dot-grid (`.map-grid`) and grain (`.grain`) textures
sit behind hero/section content at low opacity.

## Elevation & Depth

Ambient, warm, and soft — shadows are ink-tinted (rgba(23,19,14,…)), never gray.
Surfaces are gently lifted at rest and rise on hover:

### Shadow Vocabulary
- **card** (`0 1px 0 0 rgba(23,19,14,.04), 0 10px 30px -18px rgba(23,19,14,.28)`): resting cards.
- **card-hover** (`0 1px 0 0 rgba(23,19,14,.05), 0 22px 50px -24px rgba(23,19,14,.36)`): paired with a -3/-4px translateY.
- **signal-glow** (`0 0 0 1px rgba(255,77,35,.15), 0 18px 60px -18px rgba(255,77,35,.55)`): reserved for the one hero/beacon element.

### Named Rules
**The Warm Shadow Rule.** Every shadow derives from Ink, not black or gray —
depth stays inside the paper world.

## Shapes

Soft, confident rounding from a 0.75rem base scale. Marketing CTAs are full
pills; cards round at ~1–1.5rem; app controls at 0.6–0.75rem. Borders are Sand
hairlines (1px) on light, translucent paper (12–16% white) on forest. The
signature silhouette is the map pin — pulsing rings (`.pin-pulse`) radiate from
pin markers.

## Components

### Buttons
- **Marketing CTA (pill):** Signal fill, white 600-weight text, `rounded-full`,
  ~12px×24px padding; hover deepens to Signal Deep; min-height 44–48px.
- **App button:** compact (h-8, rounded-lg, text-sm) with Signal fill and
  white text; presses down 1px on click (`active:translate-y-px`).
- **Outline/Ghost/Secondary:** Sand border or Paper Raised fill, Ink text.
- **Focus:** 3px Signal outline, 2px offset (`.focus-signal`) — thick and visible.

### Cards / Containers
- White fill on paper ground, ~1–1.5rem radius, Sand hairline border, warm
  ambient shadow, 24px padding; hover lifts -3 to -4px with deeper shadow
  (220ms `cubic-bezier(0.22,1,0.36,1)`).

### Inputs / Fields
- White fill, Sand 1px border, ~0.6rem radius; focus swaps border to ring color
  with a 3px soft ring; placeholder in Stone.

### Navigation
- Marketing: paper-toned bar, Ink links, Signal hover, pill CTA at right; 44px
  targets; mobile sheet menu.
- App: white sidebar with Sand hairline edge, Signal Bright active states.

### Signature Component: The Beacon Pin
A Signal circle with `.pin-pulse` rings expanding outward (2.4s spring loop) —
used on maps, hero art, and empty states. This is the brand's animated mark.

## Do's and Don'ts

### Do:
- **Do** put grain/dot-grid/topo texture behind sections — it is the brand's ground.
- **Do** use the mono readout voice for any datum (scores, counts, ZIPs).
- **Do** keep motion physical and brief: 200–220ms, spring curve, lift/press/pulse.
- **Do** honor `prefers-reduced-motion` (already globally enforced).

### Don't:
- **Don't** mix the two oranges across surface types (The Two Oranges Rule).
- **Don't** introduce pure white/gray/black grounds — every neutral is warm.
- **Don't** use gray or black shadows — shadows derive from Ink.
- **Don't** fabricate proof (logos, counts, testimonials) — zero customers today;
  evidence lives in PRODUCT.md.
- **Don't** load Google Fonts at build time — fonts are self-hosted woff2.
