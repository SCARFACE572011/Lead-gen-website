'use client'

import { useRouter } from 'next/navigation'
import { RecentSearches } from './RecentSearches'
import { SearchHistory } from '@/types/lead'

interface DashboardRecentSearchesProps {
  searches: SearchHistory[]
}

export function DashboardRecentSearches({ searches }: DashboardRecentSearchesProps) {
  const router = useRouter()

  const handleRerun = (s: SearchHistory) => {
    const params = new URLSearchParams({
      zip: s.zipCode,
      category: s.category,
      radius: String(s.radius),
      ...(s.keyword ? { keyword: s.keyword } : {}),
    })
    router.push(`/search?${params.toString()}`)
  }

  return <RecentSearches searches={searches} onRerun={handleRerun} />
}
