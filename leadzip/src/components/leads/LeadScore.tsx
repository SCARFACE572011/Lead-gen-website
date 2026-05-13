'use client'

import { Flame, TrendingUp, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getScoreLabel } from '@/lib/scoring'

interface LeadScoreProps {
  score: number
  size?: 'sm' | 'md' | 'lg'
}

export function LeadScore({ score, size = 'md' }: LeadScoreProps) {
  const { label, color, bg } = getScoreLabel(score)

  const isHot = score >= 80
  const isWarm = score >= 50 && score < 80

  const Icon = isHot ? Flame : isWarm ? TrendingUp : Minus

  if (size === 'sm') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
          bg,
          color
        )}
      >
        <Icon className="h-3 w-3 shrink-0" />
        <span>{score}</span>
      </span>
    )
  }

  if (size === 'lg') {
    return (
      <div
        className={cn(
          'inline-flex flex-col items-center gap-1 rounded-xl px-4 py-3',
          bg
        )}
      >
        <div className="flex items-center gap-1.5">
          <Icon className={cn('h-5 w-5 shrink-0', color)} />
          <span className={cn('text-2xl font-bold tabular-nums', color)}>{score}</span>
        </div>
        <span className={cn('text-xs font-semibold uppercase tracking-wide', color)}>
          {label}
        </span>
      </div>
    )
  }

  // md (default)
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-semibold',
        bg,
        color
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="tabular-nums">{score}</span>
      <span className="font-medium">{label}</span>
    </span>
  )
}
