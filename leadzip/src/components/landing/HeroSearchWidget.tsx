'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MapPin, ArrowRight } from 'lucide-react'
import { LEAD_CATEGORIES } from '@/types/lead'

export function HeroSearchWidget() {
  const router = useRouter()
  const [zip, setZip] = useState('')
  const [category, setCategory] = useState('')
  const [zipError, setZipError] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!zip.trim() || zip.trim().length < 5) {
      setZipError('Enter a valid 5-digit ZIP')
      return
    }
    setZipError('')
    const params = new URLSearchParams({ zip: zip.trim() })
    if (category) params.set('category', category)
    router.push(`/search?${params.toString()}`)
  }

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="rounded-2xl bg-white p-2 shadow-[0_20px_50px_-24px_rgba(23,19,14,0.5)] ring-1 ring-black/5">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-signal" />
              <span className="readout text-stone">ZIP</span>
            </div>
            <input
              type="text"
              inputMode="numeric"
              maxLength={5}
              value={zip}
              onChange={(e) => { setZip(e.target.value.replace(/\D/g, '')); setZipError('') }}
              placeholder="90210"
              aria-label="ZIP code"
              className="w-full rounded-xl border-0 bg-paper-2 pl-[74px] pr-4 py-3.5 font-mono text-[17px] tracking-wide text-ink placeholder:text-stone/50 focus:outline-none focus:ring-2 focus:ring-signal min-h-[52px]"
            />
          </div>

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            aria-label="Business category"
            className="rounded-xl border-0 bg-paper-2 px-4 py-3.5 text-[16px] text-ink focus:outline-none focus:ring-2 focus:ring-signal min-h-[52px] sm:max-w-[190px]"
          >
            <option value="">Any business</option>
            {LEAD_CATEGORIES.filter((c) => c !== 'Custom Keyword').map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <button
            type="submit"
            className="group flex items-center justify-center gap-2 rounded-xl bg-signal px-6 py-3.5 text-base font-semibold text-white transition-all hover:bg-signal-600 active:scale-[0.98] min-h-[52px]"
          >
            Drop a pin
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      </div>
      {zipError && <p className="mt-2 pl-2 text-sm font-medium text-signal-600">{zipError}</p>}
      <p className="mt-3 text-center text-sm text-white/70 sm:text-left sm:pl-2">
        Free to start · No credit card · Real businesses, not a demo
      </p>
    </form>
  )
}
