import { cn } from '@/lib/utils'

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  accent?: 'default' | 'green' | 'red' | 'blue'
}

export function StatCard({ title, value, subtitle, accent = 'default' }: StatCardProps) {
  const accentBar: Record<string, string> = {
    default: 'bg-[#0369A1]',
    green: 'bg-emerald-500',
    red: 'bg-red-500',
    blue: 'bg-sky-500',
  }

  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-sm relative overflow-hidden">
      <div className={cn('absolute top-0 left-0 w-full h-0.5', accentBar[accent])} />
      <p className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">{title}</p>
      <p className="text-2xl font-bold text-[#0F172A] mt-1.5 tabular-nums">{value}</p>
      {subtitle && <p className="text-xs text-[#64748B] mt-0.5">{subtitle}</p>}
    </div>
  )
}
