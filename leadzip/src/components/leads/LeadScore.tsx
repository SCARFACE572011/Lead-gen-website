'use client'

import { Flame, TrendingUp, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getScoreLabel } from '@/lib/scoring'

interface LeadScoreProps {
  score: number
  size?: 'sm' | 'md' | 'lg'
}

export function LeadScore({ score, size = 'md' }: LeadScoreProps) {
  const { label } = getScoreLabel(score)

  const isHot = score >= 80
  const isWarm = score >= 50 && score < 80

  const Icon = isHot ? Flame : isWarm ? TrendingUp : Minus

  // Signal treatment — hot = live beacon (orange), warm = soft tint, low = muted warm
  const tone = isHot
    ? { bg: 'bg-signal', color: 'text-white' }
    : isWarm
      ? { bg: 'bg-signal-50', color: 'text-signal-600' }
      : { bg: 'bg-paper-2', color: 'text-stone' }

  if (size === 'sm') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
          tone.bg,
          tone.color
        )}
      >
        <Icon className="h-3 w-3 shrink-0" />
        <span className="font-mono tabular-nums">{score}</span>
      </span>
    )
  }

  if (size === 'lg') {
    return (
      <div
        className={cn(
          'inline-flex flex-col items-center gap-1 rounded-2xl px-4 py-3',
          tone.bg
        )}
      >
        <div className="flex items-center gap-1.5">
          <Icon className={cn('h-5 w-5 shrink-0', tone.color)} />
          <span className={cn('font-mono text-2xl font-bold tabular-nums', tone.color)}>{score}</span>
        </div>
        <span className={cn('readout', tone.color)}>{label}</span>
      </div>
    )
  }

  // md (default)
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-semibold',
        tone.bg,
        tone.color
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="font-mono tabular-nums">{score}</span>
      <span className="font-medium">{label}</span>
    </span>
  )
}
