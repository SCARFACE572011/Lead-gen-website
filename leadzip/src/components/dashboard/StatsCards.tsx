'use client'

import { TrendingUp, Bookmark, Download, Search } from 'lucide-react'

interface Stats {
  totalLeads: number
  savedLeads: number
  exportedLeads: number
  searchesThisMonth: number
}

interface StatsCardsProps {
  stats: Stats
}

// No trend pills: the old "+12% this week" / "8 remaining on plan" strings were
// hardcoded fiction shown regardless of real data. Cards now show only the real
// number + label.
const CARDS = [
  { key: 'totalLeads' as const, label: 'Total leads found', icon: TrendingUp },
  { key: 'savedLeads' as const, label: 'Saved leads', icon: Bookmark },
  { key: 'exportedLeads' as const, label: 'Leads exported', icon: Download },
  { key: 'searchesThisMonth' as const, label: 'Searches this month', icon: Search },
]

function formatNumber(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return n.toLocaleString()
}

export function StatsCards({ stats }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {CARDS.map((card) => {
        const Icon = card.icon
        const value = stats[card.key]
        return (
          <div
            key={card.key}
            className="group relative overflow-hidden rounded-2xl border border-sand bg-card p-5 card-lift"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-forest text-lime transition-colors group-hover:bg-signal group-hover:text-white">
              <Icon className="h-5 w-5 shrink-0" />
            </span>
            <div className="mt-4">
              <span className="font-mono text-3xl font-bold tracking-tight text-ink">
                {formatNumber(value)}
              </span>
              <p className="mt-1.5 text-sm font-medium text-stone">{card.label}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
