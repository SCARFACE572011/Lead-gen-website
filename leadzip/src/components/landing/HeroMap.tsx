'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Star, Globe, Phone } from 'lucide-react'

type Biz = {
  name: string
  cat: string
  img: string
  score: number
  noSite: boolean
  zip: string
  reviews: number
}

const BUSINESSES: Biz[] = [
  { name: 'Cedar & Co. Barbers', cat: 'Salon', img: '/img/salon.jpg', score: 94, noSite: true, zip: '90210', reviews: 128 },
  { name: 'Rapid Response Plumbing', cat: 'Plumber', img: '/img/plumber.jpg', score: 88, noSite: false, zip: '90210', reviews: 342 },
  { name: 'Vine Street Trattoria', cat: 'Restaurant', img: '/img/restaurant.jpg', score: 91, noSite: true, zip: '90211', reviews: 87 },
  { name: 'Summit Roofing & Exteriors', cat: 'Roofing', img: '/img/contractor.jpg', score: 96, noSite: true, zip: '90212', reviews: 54 },
]

// Pin coordinates as % of the map card
const PINS = [
  { x: 22, y: 30, big: false },
  { x: 68, y: 22, big: true },
  { x: 44, y: 58, big: false },
  { x: 80, y: 66, big: false },
  { x: 30, y: 74, big: false },
  { x: 58, y: 44, big: false },
]

export function HeroMap() {
  const [i, setI] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setI((v) => (v + 1) % BUSINESSES.length), 3200)
    return () => clearInterval(id)
  }, [])

  const biz = BUSINESSES[i]

  return (
    <div className="relative mx-auto w-full max-w-[520px]">
      {/* Map card */}
      <div className="relative aspect-[4/5] overflow-hidden rounded-[26px] ring-1 ring-white/10 sm:aspect-[5/5]"
        style={{
          background:
            'radial-gradient(120% 100% at 20% 0%, #14493c 0%, #0c2b24 45%, #071d18 100%)',
        }}
      >
        {/* faint street grid */}
        <svg className="absolute inset-0 h-full w-full opacity-[0.14]" aria-hidden>
          <defs>
            <pattern id="streets" width="46" height="46" patternUnits="userSpaceOnUse" patternTransform="rotate(12)">
              <path d="M0 0H46M0 0V46" stroke="#F3EFE6" strokeWidth="1" fill="none" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#streets)" />
        </svg>
        {/* a bolder diagonal "avenue" */}
        <div className="absolute -inset-10 opacity-25" aria-hidden
          style={{ background: 'linear-gradient(115deg, transparent 46%, rgba(203,242,63,.5) 47%, transparent 48%)' }} />

        {/* pulsing pins */}
        {PINS.map((p, idx) => (
          <div key={idx} className="absolute" style={{ left: `${p.x}%`, top: `${p.y}%` }}>
            <span className="absolute -left-2 -top-2 h-4 w-4 rounded-full bg-signal/50 pin-pulse"
              style={{ animationDelay: `${idx * 0.35}s` }} />
            <span className={`relative block rounded-full ring-2 ring-white/70 ${p.big ? 'h-3.5 w-3.5 bg-lime' : 'h-2.5 w-2.5 bg-signal'}`} />
          </div>
        ))}

        {/* readout chip top-left */}
        <div className="absolute left-4 top-4 rounded-lg bg-black/30 px-2.5 py-1.5 backdrop-blur-sm ring-1 ring-white/10">
          <span className="readout text-lime">● live · {biz.zip}</span>
        </div>

        {/* cycling lead card */}
        <div className="absolute inset-x-4 bottom-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={biz.name}
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.98 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
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

      {/* floating stat chips */}
      <motion.div
        className="absolute -left-3 top-10 hidden rounded-xl bg-white px-3 py-2 shadow-[0_16px_36px_-18px_rgba(23,19,14,0.55)] ring-1 ring-black/5 sm:block float-y"
        initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5, duration: 0.6 }}
      >
        <span className="readout text-stone">leads found</span>
        <p className="font-mono text-xl font-bold text-ink">218</p>
      </motion.div>
      <motion.div
        className="absolute -right-3 bottom-24 hidden items-center gap-2 rounded-xl bg-lime px-3 py-2 shadow-[0_16px_36px_-18px_rgba(23,19,14,0.55)] sm:flex float-y"
        style={{ animationDelay: '1.5s' }}
        initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.7, duration: 0.6 }}
      >
        <Phone className="h-4 w-4 text-forest" />
        <div>
          <span className="readout text-forest/70">tap to call</span>
          <p className="font-mono text-sm font-bold text-forest">(213) 555-0147</p>
        </div>
      </motion.div>
    </div>
  )
}
