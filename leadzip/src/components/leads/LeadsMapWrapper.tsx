'use client'
import dynamic from 'next/dynamic'
import type { Lead } from '@/types/lead'

const LeadsMap = dynamic(
  () => import('./LeadsMap').then((m) => ({ default: m.LeadsMap })),
  { ssr: false, loading: () => <div className="w-full h-[480px] rounded-xl bg-white/5 animate-pulse" /> }
)

interface Props {
  leads: Lead[]
  centerLat: number
  centerLon: number
  onLeadClick?: (lead: Lead) => void
}

export function LeadsMapWrapper(props: Props) {
  return <LeadsMap {...props} />
}
