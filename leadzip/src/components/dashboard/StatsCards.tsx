'use client'

import { TrendingUp, Bookmark, Download, Search, ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Stats {
  totalLeads: number
  savedLeads: number
  exportedLeads: number
  searchesThisMonth: number
}

interface StatsCardsProps {
  stats: Stats
}

const CARDS = [
  { key: 'totalLeads' as const, label: 'Total leads found', icon: TrendingUp, trend: '+12% this week', trendUp: true },
  { key: 'savedLeads' as const, label: 'Saved leads', icon: Bookmark, trend: '+3 today', trendUp: true },
  { key: 'exportedLeads' as const, label: 'Leads exported', icon: Download, trend: 'Last export 2d ago', trendUp: false },
  { key: 'searchesThisMonth' as const, label: 'Searches this month', icon: Search, trend: '8 remaining on plan', trendUp: false },
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
            <div className="flex items-start justify-between">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-forest text-lime transition-colors group-hover:bg-signal group-hover:text-white">
                <Icon className="h-5 w-5 shrink-0" />
              </span>
              {card.trendUp ? (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-signal-50 px-2 py-0.5 text-xs font-semibold text-signal-600">
                  <ArrowUpRight className="h-3 w-3" />
                  {card.trend.replace(/^\+/, '')}
                </span>
              ) : null}
            </div>
            <div className="mt-4">
              <span className="font-mono text-3xl font-bold tracking-tight text-ink">
                {formatNumber(value)}
              </span>
              <p className="readout mt-1.5 text-stone">{card.label}</p>
            </div>
            {!card.trendUp && (
              <p className="mt-2 text-xs text-stone">{card.trend}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
