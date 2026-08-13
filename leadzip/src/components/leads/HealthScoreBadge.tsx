'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Activity } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Lead } from '@/types/lead'
import {
  computeHealthScore,
  getHealthGrade,
  signalsFromDetails,
} from '@/lib/healthScore'

/**
 * Digital Health Score badge — computed instantly on the client from fields the
 * search already returned (zero extra API cost). Uses live signals from the
 * Check Health flow when the lead has them; otherwise estimates and says so.
 * Click for a transparent pillar-by-pillar breakdown.
 */
export function HealthScoreBadge({ lead, size = 'md' }: { lead: Lead; size?: 'sm' | 'md' }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const result = useMemo(
    () =>
      computeHealthScore(
        {
          businessName: lead.businessName,
          phone: lead.phone,
          website: lead.website,
          rating: lead.rating,
          reviewCount: lead.reviewCount,
          businessHours: lead.businessHours ?? null,
        },
        lead.digitalHealthDetails ? signalsFromDetails(lead.digitalHealthDetails) : undefined
      ),
    [lead]
  )

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: MouseEvent | TouchEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const grade = getHealthGrade(result.total)

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={`Digital health score ${result.total} out of 100. Show breakdown`}
        className={cn(
          'inline-flex items-center gap-1 rounded-full bg-paper-2 font-medium text-ink-soft transition-colors hover:bg-sand',
          size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'
        )}
      >
        <Activity className={cn('shrink-0', size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5', grade.color)} />
        <span className={cn('font-mono font-bold tabular-nums', grade.color)}>{result.total}</span>
        <span className="text-stone">health</span>
      </button>

      {open && (
        <div
          className={cn(
            'absolute z-30 mt-1.5 w-72 rounded-xl border border-sand bg-card p-3 shadow-lg',
            size === 'sm' ? 'left-0' : 'right-0'
          )}
        >
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs font-semibold text-ink">Digital Health Score</span>
            <span className={cn('font-mono text-sm font-bold tabular-nums', grade.color)}>
              {result.total}/100
            </span>
          </div>
          <p className="mt-0.5 text-[10px] text-stone">
            {result.verified
              ? 'Includes live website signals'
              : 'Estimated from profile data. Run Check Health or an audit to verify.'}
          </p>

          <div className="mt-2 space-y-2.5">
            {result.pillars.map((pillar) => {
              const pct = pillar.max > 0 ? Math.round((pillar.score / pillar.max) * 100) : 0
              const bar = pct >= 75 ? 'bg-green-500' : pct >= 45 ? 'bg-amber-400' : 'bg-red-500'
              return (
                <div key={pillar.name}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[11px] font-semibold text-ink-soft">{pillar.name}</span>
                    <span className="font-mono text-[11px] font-bold tabular-nums text-stone">
                      {pillar.score}/{pillar.max}
                    </span>
                  </div>
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-sand">
                    <div className={cn('h-full rounded-full', bar)} style={{ width: `${pct}%` }} />
                  </div>
                  <ul className="mt-1">
                    {pillar.checks.map((check) => (
                      <li key={check.id} className="flex items-center justify-between gap-2 py-px text-[11px]">
                        <span className="truncate text-ink-soft">
                          {check.label}
                          {check.estimated && <span className="ml-1 italic text-stone">est.</span>}
                        </span>
                        <span
                          className={cn(
                            'shrink-0 font-bold',
                            check.passed ? 'text-green-600' : 'text-red-500'
                          )}
                        >
                          {check.passed ? '✓' : '✗'}
                          <span className="ml-0.5 font-mono font-medium text-stone">{check.points}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
