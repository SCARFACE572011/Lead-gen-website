'use client'

import { TrendingUp, Bookmark, Download, Search } from 'lucide-react'
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
  {
    key: 'totalLeads' as const,
    label: 'Total Leads Found',
    icon: TrendingUp,
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
    trend: '+12% this week',
    trendUp: true,
  },
  {
    key: 'savedLeads' as const,
    label: 'Saved Leads',
    icon: Bookmark,
    iconBg: 'bg-violet-50',
    iconColor: 'text-violet-600',
    trend: '+3 today',
    trendUp: true,
  },
  {
    key: 'exportedLeads' as const,
    label: 'Leads Exported',
    icon: Download,
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    trend: 'Last export 2d ago',
    trendUp: null,
  },
  {
    key: 'searchesThisMonth' as const,
    label: 'Searches This Month',
    icon: Search,
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
    trend: '8 remaining on plan',
    trendUp: null,
  },
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
            className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            {/* Icon */}
            <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', card.iconBg)}>
              <Icon className={cn('h-5 w-5 shrink-0', card.iconColor)} />
            </div>

            {/* Number */}
            <div className="flex flex-col gap-0.5">
              <span className="text-2xl font-bold tabular-nums text-slate-900">
                {formatNumber(value)}
              </span>
              <span className="text-sm text-slate-500">{card.label}</span>
            </div>

            {/* Trend */}
            <div className="flex items-center gap-1.5">
              {card.trendUp === true && (
                <span className="flex items-center gap-0.5 text-xs font-medium text-emerald-600">
                  <TrendingUp className="h-3 w-3 shrink-0" />
                  {card.trend}
                </span>
              )}
              {card.trendUp === null && (
                <span className="text-xs text-slate-400">{card.trend}</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
