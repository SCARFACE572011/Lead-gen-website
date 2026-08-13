'use client'

import { useRouter } from 'next/navigation'
import { RecentSearches } from './RecentSearches'
import { SearchHistory } from '@/types/lead'

interface DashboardRecentSearchesProps {
  searches: SearchHistory[]
}

export function DashboardRecentSearches({ searches }: DashboardRecentSearchesProps) {
  const router = useRouter()

  // Mirrors the history page's rerun. Country and km have to travel with the
  // location: they are part of the international cache key, so dropping them
  // guarantees a cache miss, and worse, re-geocodes an ambiguous city name
  // like "Cambridge" with no country bias and can land on the wrong continent.
  const handleRerun = (s: SearchHistory) => {
    const params = new URLSearchParams({
      zip: s.zipCode,
      category: s.category,
      radius: String(s.radius),
      ...(s.countryCode ? { country: s.countryCode } : {}),
      ...(s.radiusKm != null ? { radiusKm: String(s.radiusKm) } : {}),
      ...(s.keyword ? { keyword: s.keyword } : {}),
    })
    router.push(`/search?${params.toString()}`)
  }

  return <RecentSearches searches={searches} onRerun={handleRerun} />
}
