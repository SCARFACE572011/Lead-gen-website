'use client'

import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { AnimatePresence, motion, useReducedMotion, useMotionValue, animate } from 'motion/react'
import { Star, Phone } from 'lucide-react'

type Biz = {
  name: string
  cat: string
  img: string
  score: number
  noSite: boolean
  zip: string
  reviews: number
  phone: string
}

const BUSINESSES: Biz[] = [
  { name: 'Cedar & Co. Barbers', cat: 'Salon', img: '/img/salon.jpg', score: 94, noSite: true, zip: '90210', reviews: 128, phone: '(310) 555-0182' },
  { name: 'Rapid Response Plumbing', cat: 'Plumber', img: '/img/plumber.jpg', score: 88, noSite: false, zip: '90210', reviews: 342, phone: '(213) 555-0147' },
  { name: 'Vine Street Trattoria', cat: 'Restaurant', img: '/img/restaurant.jpg', score: 91, noSite: true, zip: '90211', reviews: 87, phone: '(323) 555-0169' },
  { name: 'Summit Roofing & Exteriors', cat: 'Roofing', img: '/img/contractor.jpg', score: 96, noSite: true, zip: '90212', reviews: 54, phone: '(818) 555-0133' },
]

// ---- Radar timing (one "scan lap" == one sweep revolution) --------------
const LAP = 5.0            // seconds per radar revolution
const ACTIVE_PERIOD = 3.6  // seconds the highlighted lead stays featured
const TARGET = 218         // leads-found counter lands here on the first lap
const ORIGIN = { x: 50, y: 39 } // radar center, as % of the panel
const SQUEEZE = 0.95       // gently flatten x so the ring reads circular
const CARD_ANCHOR = { x: 27, y: 72 } // where the leader line docks into the card

// Pins are defined by their angle around the origin (0° = up, clockwise).
// That angle drives BOTH placement AND the discovery order, so each pin is
// "found" exactly as the sweep beam passes it.
type PinDef = { angle: number; radius: number; kind: 'primary' | 'ambient'; biz?: number }
const PIN_DEFS: PinDef[] = [
  { angle: 34, radius: 30, kind: 'ambient' },
  { angle: 72, radius: 33, kind: 'primary', biz: 0 },
  { angle: 128, radius: 27, kind: 'primary', biz: 1 },
  { angle: 176, radius: 24, kind: 'ambient' },
  { angle: 236, radius: 32, kind: 'primary', biz: 2 },
  { angle: 300, radius: 30, kind: 'primary', biz: 3 },
]
const PINS = PIN_DEFS.map((p) => {
  const rad = (p.angle * Math.PI) / 180
  return {
    ...p,
    x: ORIGIN.x + p.radius * Math.sin(rad) * SQUEEZE,
    y: ORIGIN.y - p.radius * Math.cos(rad),
    delay: (p.angle / 360) * LAP, // beam reaches this pin at this time in the lap
  }
})

export function HeroMap() {
  const reduce = useReducedMotion()
  const [active, setActive] = useState(0)

  // Featured-lead cycle — drives the card, the lime pin, the leader line and
  // the "tap to call" chip together so they always point at the same business.
  useEffect(() => {
    if (reduce) return
    const id = setInterval(() => setActive((v) => (v + 1) % BUSINESSES.length), ACTIVE_PERIOD * 1000)
    return () => clearInterval(id)
  }, [reduce])

  // Leads-found count-up. Climbs 0 -> 218 across the first discovery lap, then
  // keeps ticking up in small live increments each lap so it feels alive.
  const count = useMotionValue(0)
  const latest = useRef(0)
  const countRef = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const unsub = count.on('change', (v) => {
      const r = Math.round(v)
      latest.current = r
      if (countRef.current) countRef.current.textContent = String(r)
    })
    if (reduce) {
      count.set(TARGET)
      return () => unsub()
    }
    let interval: ReturnType<typeof setInterval> | undefined
    const first = animate(count, TARGET, {
      duration: LAP,
      ease: [0.16, 1, 0.3, 1],
      onComplete: () => {
        interval = setInterval(() => {
          const inc = 1 + Math.floor(Math.random() * 3)
          animate(count, latest.current + inc, { duration: 0.8, ease: [0.22, 1, 0.36, 1] })
        }, LAP * 1000)
      },
    })
    return () => {
      unsub()
      first.stop()
      if (interval) clearInterval(interval)
    }
  }, [reduce, count])

  const biz = BUSINESSES[active]
  const activePin = PINS.find((p) => p.biz === active) ?? PINS[1]

  return (
    <div className="lzr-root relative mx-auto w-full max-w-[520px]" style={{ ['--lzr-lap' as string]: `${LAP}s` } as CSSProperties}>
      <style>{RADAR_CSS}</style>

      {/* ============ MAP PANEL ============ */}
      <div
        className="relative aspect-[4/5] overflow-hidden rounded-[26px] ring-1 ring-white/10 sm:aspect-[5/5]"
        style={{ background: 'radial-gradient(120% 100% at 20% 0%, #14493c 0%, #0c2b24 45%, #071d18 100%)' }}
      >
        {/* faint cartographic street grid */}
        <svg className="absolute inset-0 h-full w-full opacity-[0.13]" aria-hidden>
          <defs>
            <pattern id="lzr-streets" width="46" height="46" patternUnits="userSpaceOnUse" patternTransform="rotate(12)">
              <path d="M0 0H46M0 0V46" stroke="#F3EFE6" strokeWidth="1" fill="none" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#lzr-streets)" />
        </svg>

        {/* concentric range rings + crosshair, centered on the radar origin */}
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <g fill="none" stroke="#F3EFE6" vectorEffect="non-scaling-stroke">
            <circle cx={ORIGIN.x} cy={ORIGIN.y} r="14" strokeOpacity="0.09" />
            <circle cx={ORIGIN.x} cy={ORIGIN.y} r="24" strokeOpacity="0.07" />
            <circle cx={ORIGIN.x} cy={ORIGIN.y} r="33" strokeOpacity="0.05" />
          </g>
          <g stroke="#CBF23F" strokeOpacity="0.10" vectorEffect="non-scaling-stroke">
            <line x1={ORIGIN.x - 4} y1={ORIGIN.y} x2={ORIGIN.x + 4} y2={ORIGIN.y} />
            <line x1={ORIGIN.x} y1={ORIGIN.y - 4} x2={ORIGIN.x} y2={ORIGIN.y + 4} />
          </g>
        </svg>

        {/* rotating radar sweep beam (transform-only, phase-locked to pings) */}
        {!reduce && <div className="lzr-sweep" style={{ left: `${ORIGIN.x}%`, top: `${ORIGIN.y}%` }} aria-hidden />}

        {/* bottom vignette so the lead card stays legible */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5" aria-hidden
          style={{ background: 'linear-gradient(to top, #061a15 0%, rgba(6,26,21,0.35) 45%, transparent 100%)' }} />

        {/* leader line: highlighted pin -> lead card */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <AnimatePresence>
            <motion.path
              key={active}
              d={`M ${activePin.x} ${activePin.y} L ${CARD_ANCHOR.x} ${CARD_ANCHOR.y}`}
              stroke="#CBF23F"
              strokeWidth={1}
              strokeLinecap="round"
              fill="none"
              vectorEffect="non-scaling-stroke"
              initial={reduce ? false : { pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.5 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduce ? 0 : 0.55, ease: [0.22, 1, 0.36, 1] }}
            />
          </AnimatePresence>
        </svg>
        {/* docking dot where the line meets the card */}
        <span className="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-lime"
          style={{ left: `${CARD_ANCHOR.x}%`, top: `${CARD_ANCHOR.y}%`, boxShadow: '0 0 8px 1px rgba(203,242,63,0.7)' }} aria-hidden />

        {/* radar origin dot */}
        <span className="lzr-origin" style={{ left: `${ORIGIN.x}%`, top: `${ORIGIN.y}%` }} aria-hidden />

        {/* discovered pins */}
        {PINS.map((p, idx) => {
          const isActive = p.biz === active
          const baseScale = p.kind === 'ambient' ? 0.68 : 1
          return (
            <div key={idx} className="absolute" style={{ left: `${p.x}%`, top: `${p.y}%` }} aria-hidden>
              {!reduce && (
                <span
                  className="lzr-ping"
                  style={{ animationDelay: `${p.delay}s`, ['--lzr-c' as string]: isActive ? '203,242,63' : '255,77,35' } as CSSProperties}
                />
              )}
              {isActive && !reduce && <span className="lzr-halo" />}
              <motion.span
                className="lzr-marker"
                initial={reduce ? false : { opacity: 0, y: -16, scale: 0.3 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={reduce ? { duration: 0 } : { delay: p.delay, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              >
                <motion.span
                  className="lzr-dot"
                  data-active={isActive}
                  animate={{ scale: isActive ? 1.35 : baseScale }}
                  transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 300, damping: 20 }}
                />
              </motion.span>
            </div>
          )
        })}

        {/* readout chip — live scan status */}
        <div className="absolute left-4 top-4 flex items-center gap-2 rounded-lg bg-black/30 px-2.5 py-1.5 backdrop-blur-sm ring-1 ring-white/10">
          <span className="lzr-livedot" aria-hidden />
          <span className="readout text-lime">scanning · {biz.zip}</span>
        </div>

        {/* cycling lead card */}
        <div className="absolute inset-x-4 bottom-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={biz.name}
              initial={reduce ? false : { opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -12, scale: 0.98 }}
              transition={{ duration: reduce ? 0 : 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-[0_20px_44px_-20px_rgba(0,0,0,0.7)]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={biz.img} alt="" className="h-14 w-14 flex-shrink-0 rounded-xl object-cover" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-display text-[15px] font-semibold text-ink">{biz.name}</p>
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-[12px] text-stone">
                  <span className="inline-flex items-center gap-0.5"><Star className="h-3 w-3 fill-signal text-signal" />4.{biz.reviews % 9}</span>
                  <span>·</span>
                  <span className="readout !text-[10px] !normal-case tracking-normal">{biz.cat}</span>
                  {biz.noSite && (
                    <span className="ml-auto rounded-md bg-signal-50 px-1.5 py-0.5 text-[10px] font-semibold text-signal-600">
                      No website
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-center rounded-xl bg-forest px-2.5 py-1.5">
                <span className="readout !text-[9px] text-lime">score</span>
                <span className="font-mono text-lg font-bold leading-none text-white">{biz.score}</span>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* ============ FLOATING STAT CHIPS (outside the panel) ============ */}
      <motion.div
        className="float-y absolute -left-3 top-10 hidden rounded-xl bg-white px-3 py-2 shadow-[0_16px_36px_-18px_rgba(23,19,14,0.55)] ring-1 ring-black/5 sm:block"
        initial={reduce ? false : { opacity: 0, x: -14 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.5, duration: 0.6 }}
      >
        <span className={reduce ? '' : 'lzr-heartbeat block'}>
          <span className="readout text-stone">leads found</span>
          <p className="font-mono text-xl font-bold text-ink tabular-nums">
            <span ref={countRef}>0</span>
          </p>
        </span>
      </motion.div>

      <motion.div
        className="float-y absolute -right-3 bottom-24 hidden items-center gap-2 rounded-xl bg-lime px-3 py-2 shadow-[0_16px_36px_-18px_rgba(23,19,14,0.55)] sm:flex"
        style={{ animationDelay: '1.5s' }}
        initial={reduce ? false : { opacity: 0, x: 14 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.7, duration: 0.6 }}
      >
        <span className="relative flex h-4 w-4 items-center justify-center">
          {!reduce && <span className="lzr-callring absolute inset-0 rounded-full" />}
          <Phone className="h-4 w-4 text-forest" />
        </span>
        <div>
          <span className="readout text-forest/70">tap to call</span>
          <AnimatePresence mode="wait">
            <motion.p
              key={biz.phone}
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
              transition={{ duration: reduce ? 0 : 0.3 }}
              className="font-mono text-sm font-bold text-forest tabular-nums"
            >
              {biz.phone}
            </motion.p>
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  )
}

// Component-scoped keyframes (unique lzr- prefix). Everything animates
// transform / opacity only, and all loops are gated behind !reduce in JSX.
const RADAR_CSS = `
.lzr-sweep{
  position:absolute; width:170%; aspect-ratio:1; border-radius:9999px;
  transform:translate(-50%,-50%) rotate(0deg);
  background:conic-gradient(from 0deg,
    rgba(203,242,63,0) 0deg, rgba(203,242,63,0) 268deg,
    rgba(203,242,63,0.04) 300deg, rgba(203,242,63,0.13) 340deg,
    rgba(255,77,35,0.10) 352deg, rgba(203,242,63,0.55) 359.4deg,
    rgba(255,255,255,0.72) 360deg);
  -webkit-mask-image:radial-gradient(closest-side,#000 55%,rgba(0,0,0,0.55) 80%,transparent 100%);
  mask-image:radial-gradient(closest-side,#000 55%,rgba(0,0,0,0.55) 80%,transparent 100%);
  animation:lzr-sweep var(--lzr-lap,5s) linear infinite;
  opacity:0.9; pointer-events:none; will-change:transform;
}
@keyframes lzr-sweep{ to{ transform:translate(-50%,-50%) rotate(360deg); } }

.lzr-origin{
  position:absolute; width:8px; height:8px; margin:-4px; border-radius:9999px;
  background:#CBF23F; box-shadow:0 0 12px 2px rgba(203,242,63,0.6);
  animation:lzr-core 2.4s ease-in-out infinite;
}
@keyframes lzr-core{ 0%,100%{ transform:scale(1); opacity:0.9; } 50%{ transform:scale(1.35); opacity:0.6; } }

.lzr-ping{
  position:absolute; left:0; top:0; width:16px; height:16px; margin:-8px; border-radius:9999px;
  background:radial-gradient(circle, rgba(var(--lzr-c,255,77,35),0.55) 0%, rgba(var(--lzr-c,255,77,35),0) 70%);
  transform:scale(0.35); opacity:0; pointer-events:none;
  animation:lzr-ping var(--lzr-lap,5s) linear infinite;
}
@keyframes lzr-ping{
  0%{ transform:scale(0.35); opacity:0; }
  4%{ opacity:0.6; }
  40%{ transform:scale(3.2); opacity:0; }
  100%{ transform:scale(3.2); opacity:0; }
}

.lzr-halo{
  position:absolute; left:0; top:0; width:36px; height:36px; margin:-18px; border-radius:9999px;
  background:radial-gradient(circle, rgba(203,242,63,0.30) 0%, rgba(203,242,63,0) 68%);
  pointer-events:none; animation:lzr-halo 2.4s ease-in-out infinite;
}
@keyframes lzr-halo{ 0%,100%{ transform:scale(0.85); opacity:0.6; } 50%{ transform:scale(1.15); opacity:1; } }

.lzr-marker{ position:absolute; left:0; top:0; }
.lzr-dot{
  display:block; width:14px; height:14px; margin:-7px; border-radius:9999px;
  background:#FF4D23;
  box-shadow:0 0 0 2px rgba(255,255,255,0.85), 0 4px 10px -2px rgba(0,0,0,0.5);
  transition:background-color 0.45s ease, box-shadow 0.45s ease;
}
.lzr-dot[data-active="true"]{
  background:#CBF23F;
  box-shadow:0 0 0 2px rgba(255,255,255,0.9), 0 0 18px 3px rgba(203,242,63,0.55);
}

.lzr-livedot{
  display:inline-block; width:6px; height:6px; border-radius:9999px; background:#CBF23F;
  box-shadow:0 0 8px 1px rgba(203,242,63,0.8);
  animation:lzr-livedot 1.6s ease-in-out infinite;
}
@keyframes lzr-livedot{ 0%,100%{ transform:scale(1); opacity:1; } 50%{ transform:scale(1.5); opacity:0.5; } }

.lzr-heartbeat{ animation:lzr-heartbeat var(--lzr-lap,5s) ease-in-out infinite; transform-origin:left center; }
@keyframes lzr-heartbeat{ 0%,70%,100%{ transform:scale(1); } 78%{ transform:scale(1.05); } 86%{ transform:scale(0.99); } }

.lzr-callring{
  border:1.5px solid rgba(12,43,36,0.6);
  animation:lzr-callring 1.8s ease-out infinite;
}
@keyframes lzr-callring{ 0%{ transform:scale(0.6); opacity:0.8; } 80%{ transform:scale(1.9); opacity:0; } 100%{ opacity:0; } }

@media (prefers-reduced-motion: reduce){
  .lzr-sweep, .lzr-origin, .lzr-ping, .lzr-halo, .lzr-livedot, .lzr-heartbeat, .lzr-callring{
    animation:none !important;
  }
  .lzr-ping, .lzr-halo, .lzr-callring{ opacity:0 !important; }
}
`
