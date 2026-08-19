'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Star, Plus, Minus, Navigation } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

/* A cartographic hero panel: a light street map of the sample territory that
   cycles through industries — pins re-drop, the info card crossfades with the
   business photo, the toolbar relabels. Hand-authored SVG streets so the
   place reads as believable cartography, not a uniform grid.
   Motion: transform/opacity only, pauses on hover/focus (WCAG 2.2.2), and
   renders the first industry statically under prefers-reduced-motion.
   Sample data, labeled in the toolbar. */

const EASE = [0.22, 1, 0.36, 1] as const
const CYCLE_MS = 4200

type Pin = { x: number; y: number; score: number; hot?: boolean; warm?: boolean }

const INDUSTRIES: {
  label: string
  results: number
  featured: { name: string; img: string; rating: number; reviews: number; flag: string; score: number }
  pins: Pin[]
}[] = [
  {
    label: 'HVAC Contractors', results: 23,
    featured: { name: 'Windhaven Heating & Air', img: '/img/tradesman.jpg', rating: 3.9, reviews: 12, flag: 'No website', score: 96 },
    pins: [
      { x: 306, y: 226, score: 91, hot: true },
      { x: 352, y: 92, score: 84, hot: true },
      { x: 100, y: 296, score: 62, warm: true },
      { x: 398, y: 296, score: 38 },
    ],
  },
  {
    label: 'Dentists', results: 17,
    featured: { name: 'Bright Ave Dental', img: '/img/dentist.jpg', rating: 4.1, reviews: 27, flag: 'Weak rating', score: 89 },
    pins: [
      { x: 262, y: 96, score: 87, hot: true },
      { x: 428, y: 124, score: 74, warm: true },
      { x: 180, y: 300, score: 58, warm: true },
      { x: 360, y: 300, score: 31 },
    ],
  },
  {
    label: 'Restaurants', results: 31,
    featured: { name: 'Poppy & Rye Café', img: '/img/cafe.jpg', rating: 4.2, reviews: 19, flag: 'No website', score: 92 },
    pins: [
      { x: 236, y: 292, score: 88, hot: true },
      { x: 330, y: 84, score: 79, warm: true },
      { x: 438, y: 204, score: 66, warm: true },
      { x: 218, y: 56, score: 44 },
    ],
  },
  {
    label: 'Retail shops', results: 12,
    featured: { name: 'Marlowe Home Goods', img: '/img/storefront.jpg', rating: 3.8, reviews: 14, flag: 'No website', score: 94 },
    pins: [
      { x: 282, y: 142, score: 85, hot: true },
      { x: 412, y: 88, score: 71, warm: true },
      { x: 146, y: 312, score: 52, warm: true },
      { x: 310, y: 312, score: 29 },
    ],
  },
]

/* The selected business pin stays anchored beside its info card. */
const SELECTED = { x: 152, y: 118 }

/* Small building footprints — pale rects that make the blocks read as a real
   place. Decorative only. */
const FOOTPRINTS: [number, number, number, number, number][] = [
  [130, 84, 26, 14, 0], [176, 96, 18, 12, 3], [250, 90, 30, 16, 0], [388, 78, 22, 12, -2],
  [122, 190, 20, 12, 0], [246, 236, 26, 14, 2], [352, 186, 18, 10, 0], [432, 168, 24, 12, 0],
  [150, 292, 22, 12, -3], [372, 236, 20, 10, 0], [56, 110, 18, 10, 0], [56, 200, 22, 12, 2],
]

function pinTone(p: { hot?: boolean; warm?: boolean }) {
  return p.hot
    ? 'bg-signal text-white ring-white'
    : p.warm
      ? 'bg-signal-50 text-signal-600 ring-white'
      : 'bg-white text-stone ring-sand'
}

export function MapPanel() {
  const reduce = useReducedMotion()
  const [idx, setIdx] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (reduce || paused) return
    const t = setInterval(() => setIdx((i) => (i + 1) % INDUSTRIES.length), CYCLE_MS)
    return () => clearInterval(t)
  }, [reduce, paused])

  const ind = INDUSTRIES[idx]

  return (
    <div
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPaused(false)
      }}
    >
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white text-ink shadow-[0_1px_0_0_rgba(0,0,0,0.2),0_30px_80px_-24px_rgba(0,0,0,0.55)]">
        {/* App toolbar */}
        <div className="flex items-center justify-between gap-3 border-b border-sand bg-white px-4 py-3">
          <div className="min-w-0">
            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={ind.label}
                initial={reduce ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? undefined : { opacity: 0, y: -6 }}
                transition={{ duration: 0.22, ease: EASE }}
                className="truncate font-display text-sm font-bold leading-tight"
              >
                {ind.label} · Plano, TX
              </motion.p>
            </AnimatePresence>
            <p className="readout mt-0.5 text-stone">
              <span className="font-mono tabular-nums">{ind.results}</span> results · ZIP 75023 · example
            </p>
          </div>
          <span className="readout shrink-0 rounded-full bg-paper-2 px-2.5 py-1 text-stone">Map view</span>
        </div>

        {/* The map */}
        <div className="relative">
          <svg viewBox="0 0 480 340" className="block w-full" role="img" aria-label="Map of a sample territory with scored business pins that cycle through industries">
            {/* ground */}
            <rect width="480" height="340" fill="#F1EDE3" />
            {/* park + greenbelt along the creek */}
            <path d="M300 250 C340 230 380 250 480 232 L480 340 L260 340 C270 300 280 264 300 250 Z" fill="#E2E8D6" />
            <path d="M20 20 h96 v70 h-96 Z" fill="#E2E8D6" opacity="0.7" />
            {/* creek */}
            <path d="M270 340 C290 300 330 280 480 268" fill="none" stroke="#C9D8CE" strokeWidth="10" strokeLinecap="round" />
            {/* building footprints */}
            <g fill="#E4DECF">
              {FOOTPRINTS.map(([x, y, w, h, r]) => (
                <rect key={`${x}-${y}`} x={x} y={y} width={w} height={h} rx="1.5" transform={r ? `rotate(${r} ${x + w / 2} ${y + h / 2})` : undefined} />
              ))}
            </g>
            {/* street casings (sand), then street fills (white) — widths vary */}
            <g stroke="#DDD6C6" fill="none">
              <path d="M0 66 H480" strokeWidth="13" />
              <path d="M0 160 C120 156 300 166 480 158" strokeWidth="9" />
              <path d="M0 258 H310" strokeWidth="9" />
              <path d="M96 0 V340" strokeWidth="13" />
              <path d="M212 0 C210 120 216 240 212 340" strokeWidth="8" />
              <path d="M330 0 V258" strokeWidth="9" />
              <path d="M416 0 V232" strokeWidth="7" />
              <path d="M212 208 c40 -4 70 10 118 0" strokeWidth="6" />
              <path d="M330 116 c50 6 90 -2 150 4" strokeWidth="6" />
              <path d="M96 208 c-30 4 -60 -6 -96 0" strokeWidth="6" />
            </g>
            <g stroke="#FFFFFF" fill="none">
              <path d="M0 66 H480" strokeWidth="9" />
              <path d="M0 160 C120 156 300 166 480 158" strokeWidth="6" />
              <path d="M0 258 H310" strokeWidth="6" />
              <path d="M96 0 V340" strokeWidth="9" />
              <path d="M212 0 C210 120 216 240 212 340" strokeWidth="5" />
              <path d="M330 0 V258" strokeWidth="6" />
              <path d="M416 0 V232" strokeWidth="4.5" />
              <path d="M212 208 c40 -4 70 10 118 0" strokeWidth="4" />
              <path d="M330 116 c50 6 90 -2 150 4" strokeWidth="4" />
              <path d="M96 208 c-30 4 -60 -6 -96 0" strokeWidth="4" />
            </g>
            {/* cul-de-sac */}
            <path d="M416 232 c0 14 -16 14 -16 0" fill="none" stroke="#FFFFFF" strokeWidth="4.5" />
            {/* street names */}
            <g fill="#A29a86" fontFamily="ui-monospace, SFMono-Regular, Consolas, monospace" fontSize="8.5" letterSpacing="0.06em">
              <text x="14" y="60">LEGACY DR</text>
              <text x="238" y="153">WINDHAVEN PKWY</text>
              <text x="14" y="252">15TH ST</text>
              <text x="88" y="330" transform="rotate(-90 88 330)">CUSTER RD</text>
              <text x="324" y="252" transform="rotate(-90 324 252)">INDEPENDENCE</text>
            </g>
            {/* selected pin stem */}
            <circle cx={SELECTED.x} cy={SELECTED.y + 14} r="2.5" fill="rgba(23,19,14,0.25)" />
            <line x1={SELECTED.x} y1={SELECTED.y + 12} x2={SELECTED.x} y2={SELECTED.y + 4} stroke="rgba(23,19,14,0.3)" strokeWidth="1.5" />
          </svg>

          {/* Cycling pins (HTML badges over the SVG for crisp text) */}
          <AnimatePresence initial={false}>
            {ind.pins.map((p, i) => (
              <motion.span
                key={`${idx}-${p.x}-${p.y}`}
                initial={reduce ? false : { opacity: 0, scale: 0.5, y: -8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={reduce ? undefined : { opacity: 0, scale: 0.5, transition: { duration: 0.16 } }}
                transition={{ delay: reduce ? 0 : 0.1 + i * 0.07, duration: 0.26, ease: EASE }}
                className="absolute flex -translate-x-1/2 -translate-y-full items-center justify-center"
                style={{ left: `${(p.x / 480) * 100}%`, top: `${(p.y / 340) * 100}%` }}
                aria-hidden
              >
                <span className={`relative flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 font-mono text-xs font-bold shadow-[0_2px_6px_rgba(23,19,14,0.25)] ring-2 ${pinTone(p)}`}>
                  {p.score}
                </span>
              </motion.span>
            ))}
          </AnimatePresence>

          {/* Selected pin — anchored beside the info card */}
          <span
            className="absolute flex -translate-x-1/2 -translate-y-full items-center justify-center"
            style={{ left: `${(SELECTED.x / 480) * 100}%`, top: `${(SELECTED.y / 340) * 100}%` }}
            aria-hidden
          >
            <span className="pin-pulse absolute h-4 w-4 rounded-full bg-signal/35" />
            <span className="relative flex h-7 min-w-7 items-center justify-center rounded-full bg-signal px-1.5 font-mono text-xs font-bold text-white shadow-[0_2px_6px_rgba(23,19,14,0.25)] ring-2 ring-white">
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={ind.featured.score}
                  initial={reduce ? false : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? undefined : { opacity: 0, y: -4 }}
                  transition={{ duration: 0.18, ease: EASE }}
                >
                  {ind.featured.score}
                </motion.span>
              </AnimatePresence>
            </span>
          </span>

          {/* Info card for the selected business — crossfades per industry */}
          <div className="absolute left-[7%] top-[38%] w-64 overflow-hidden rounded-xl border border-sand bg-white p-3.5 shadow-[0_14px_40px_-12px_rgba(23,19,14,0.35)]">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={ind.featured.name}
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? undefined : { opacity: 0, y: -8 }}
                transition={{ duration: 0.24, ease: EASE }}
              >
                <div className="flex items-start gap-2.5">
                  <Image
                    src={ind.featured.img}
                    alt=""
                    width={80}
                    height={80}
                    className="h-10 w-10 shrink-0 rounded-lg object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-[15px] font-bold leading-tight">{ind.featured.name}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-soft">
                      <Star className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400" aria-hidden />
                      <span className="font-mono tabular-nums">{ind.featured.rating.toFixed(1)}</span>
                      <span className="text-stone">({ind.featured.reviews} reviews)</span>
                    </p>
                    <p className="mt-1 text-xs font-semibold text-signal">{ind.featured.flag}</p>
                  </div>
                  <span className="inline-flex shrink-0 items-center rounded-full bg-signal px-2 py-0.5 font-mono text-xs font-bold text-white">
                    {ind.featured.score}
                  </span>
                </div>
                <p className="mt-2.5 border-t border-sand pt-2 text-xs font-semibold text-signal">Find email →</p>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Map controls */}
          <div className="absolute bottom-3 right-3 flex flex-col overflow-hidden rounded-lg border border-sand bg-white shadow-card" aria-hidden>
            <span className="flex h-8 w-8 items-center justify-center border-b border-sand text-ink-soft"><Plus className="h-4 w-4" /></span>
            <span className="flex h-8 w-8 items-center justify-center text-ink-soft"><Minus className="h-4 w-4" /></span>
          </div>
          <span className="absolute bottom-3 left-3 flex h-8 w-8 items-center justify-center rounded-lg border border-sand bg-white text-signal shadow-card" aria-hidden>
            <Navigation className="h-4 w-4" />
          </span>

          {/* Industry progress dots */}
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5" aria-hidden>
            {INDUSTRIES.map((x, i) => (
              <span
                key={x.label}
                className={`h-1.5 rounded-full transition-all duration-300 ${i === idx ? 'w-5 bg-signal' : 'w-1.5 bg-ink/15'}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
