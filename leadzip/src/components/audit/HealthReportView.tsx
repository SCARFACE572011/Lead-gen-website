import { getHealthGrade, type HealthPillar } from '@/lib/healthScore'

/**
 * Presentational pieces of the Digital Presence Audit report, shared by the
 * public /audit/[slug] page (server-rendered from a stored row) and the free
 * checker on /free-audit (client-rendered from a fetch). Pure markup with no
 * hooks or state, so both environments use them unchanged.
 */

export function ScoreGauge({ total }: { total: number }) {
  const grade = getHealthGrade(total)
  const r = 64
  const c = 2 * Math.PI * r
  const filled = (Math.max(0, Math.min(100, total)) / 100) * c
  const stroke = total >= 80 ? '#16a34a' : total >= 60 ? '#65a30d' : total >= 40 ? '#d97706' : '#dc2626'
  return (
    <div className="relative h-44 w-44">
      <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90">
        <circle cx="80" cy="80" r={r} fill="none" stroke="#E7E1D4" strokeWidth="12" />
        <circle
          cx="80"
          cy="80"
          r={r}
          fill="none"
          stroke={stroke}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${c - filled}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-5xl font-bold tabular-nums text-ink">{total}</span>
        <span className="text-xs font-medium text-stone">out of 100</span>
        <span className={`mt-1 text-sm font-semibold ${grade.color}`}>{grade.label}</span>
      </div>
    </div>
  )
}

export function PillarBreakdown({ pillars }: { pillars: HealthPillar[] }) {
  return (
    <section className="grid gap-4 sm:grid-cols-3">
      {pillars.map((pillar) => {
        const pct = pillar.max > 0 ? Math.round((pillar.score / pillar.max) * 100) : 0
        const barColor = pct >= 75 ? 'bg-green-500' : pct >= 45 ? 'bg-amber-400' : 'bg-red-500'
        return (
          <div key={pillar.name} className="rounded-2xl border border-sand bg-card p-4">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold text-ink">{pillar.name}</h2>
              <span className="font-mono text-sm font-bold tabular-nums text-ink-soft">
                {pillar.score}/{pillar.max}
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-sand">
              <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
            </div>
            <ul className="mt-3 space-y-1.5">
              {pillar.checks.map((check) => (
                <li key={check.id} className="flex items-start justify-between gap-2 text-xs">
                  <span className="text-ink-soft">
                    {check.label}
                    {check.estimated && (
                      <span className="ml-1 italic text-stone">(estimated)</span>
                    )}
                  </span>
                  <span
                    className={
                      check.passed
                        ? 'shrink-0 font-bold text-green-600'
                        : 'shrink-0 font-bold text-red-500'
                    }
                    aria-label={check.passed ? 'Passed' : 'Failed'}
                  >
                    {check.passed ? '✓' : '✗'}
                    <span className="ml-1 font-mono font-medium text-stone">
                      {check.points}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </section>
  )
}
