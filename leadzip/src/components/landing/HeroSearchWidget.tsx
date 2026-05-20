'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MapPin, Search } from 'lucide-react'
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
    <form onSubmit={handleSubmit} className="w-full space-y-3">
      <div className="flex flex-col gap-2">
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#0369A1] pointer-events-none" />
          <input
            type="text"
            inputMode="numeric"
            maxLength={5}
            value={zip}
            onChange={(e) => {
              setZip(e.target.value.replace(/\D/g, ''))
              setZipError('')
            }}
            placeholder="Enter ZIP code"
            className="w-full rounded-xl border border-[#E2E8F0] bg-white pl-9 pr-4 py-3 text-[16px] text-slate-900 placeholder:text-slate-400 focus:border-[#0369A1] focus:outline-none focus:ring-2 focus:ring-[#0369A1]/20 min-h-[48px]"
          />
        </div>
        {zipError && <p className="text-xs text-red-500 pl-1">{zipError}</p>}

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full rounded-xl border border-[#E2E8F0] bg-white px-4 py-3 text-[16px] text-slate-900 focus:border-[#0369A1] focus:outline-none focus:ring-2 focus:ring-[#0369A1]/20 min-h-[48px]"
        >
          <option value="">All categories</option>
          {LEAD_CATEGORIES.filter((c) => c !== 'Custom Keyword').map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#0369A1] py-3 text-base font-semibold text-white hover:bg-[#0284C7] transition-colors min-h-[48px]"
      >
        <Search className="h-4 w-4" />
        Find Leads
      </button>

      <p className="text-center text-xs text-slate-400">Free · No credit card required</p>
    </form>
  )
}
