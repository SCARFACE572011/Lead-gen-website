'use client'

import { useState } from 'react'
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Bookmark,
  BookmarkCheck,
  Globe,
  Loader2,
  Mail,
  Phone,
  Zap,
  Star,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Lead, DigitalHealthDetails } from '@/types/lead'
import { LeadScore } from './LeadScore'

type SortKey = 'leadScore' | 'rating' | 'reviewCount' | 'businessName'
type SortDir = 'asc' | 'desc'

interface LeadTableProps {
  leads: Lead[]
  onSave: (lead: Lead) => void
  savedIds: string[]
}

function SortIcon({ column, sortKey, sortDir }: { column: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (column !== sortKey) return <ArrowUpDown className="h-3.5 w-3.5 text-stone" />
  return sortDir === 'asc'
    ? <ArrowUp className="h-3.5 w-3.5 text-signal" />
    : <ArrowDown className="h-3.5 w-3.5 text-signal" />
}

function StarBadge({ rating }: { rating: number | null }) {
  if (rating === null) return <span className="text-stone text-xs">—</span>
  return (
    <span className="inline-flex items-center gap-1 tabular-nums text-sm">
      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400 shrink-0" />
      <span className="font-medium font-mono text-ink-soft">{rating.toFixed(1)}</span>
    </span>
  )
}

export function LeadTable({ leads, onSave, savedIds }: LeadTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('leadScore')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const sorted = [...leads].sort((a, b) => {
    let valA: string | number
    let valB: string | number

    if (sortKey === 'businessName') {
      valA = a.businessName.toLowerCase()
      valB = b.businessName.toLowerCase()
    } else {
      valA = (a[sortKey] as number | null) ?? 0
      valB = (b[sortKey] as number | null) ?? 0
    }

    if (valA < valB) return sortDir === 'asc' ? -1 : 1
    if (valA > valB) return sortDir === 'asc' ? 1 : -1
    return 0
  })

  const showZipColumn = leads.some((l) => Boolean(l.sourceZip))

  type EmailState = 'idle' | 'loading' | 'found' | 'not_found'
  const [emailStates, setEmailStates] = useState<Record<string, EmailState>>({})
  const [emailData, setEmailData] = useState<Record<string, { email: string; confidence: 'verified' | 'likely' | 'guessed' }>>({})

  async function handleFindEmail(lead: Lead) {
    if (!lead.website) return
    setEmailStates((prev) => ({ ...prev, [lead.id]: 'loading' }))
    try {
      const res = await fetch('/api/leads/enrich/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: lead.website }),
      })
      const data = await res.json()
      if (res.ok && data.email) {
        setEmailData((prev) => ({ ...prev, [lead.id]: { email: data.email, confidence: data.confidence } }))
        setEmailStates((prev) => ({ ...prev, [lead.id]: 'found' }))
      } else {
        setEmailStates((prev) => ({ ...prev, [lead.id]: 'not_found' }))
      }
    } catch {
      setEmailStates((prev) => ({ ...prev, [lead.id]: 'not_found' }))
    }
  }

  type HealthState = 'idle' | 'loading' | 'found' | 'unreachable'
  const [healthStates, setHealthStates] = useState<Record<string, HealthState>>({})
  const [healthData, setHealthData] = useState<Record<string, { score: number; details: DigitalHealthDetails }>>({})

  async function handleCheckHealth(lead: Lead) {
    if (!lead.website) return
    setHealthStates((prev) => ({ ...prev, [lead.id]: 'loading' }))
    try {
      const res = await fetch('/api/leads/enrich/health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ website: lead.website }),
      })
      const data = await res.json()
      if (res.ok && typeof data.score === 'number') {
        setHealthData((prev) => ({ ...prev, [lead.id]: { score: data.score, details: data.details } }))
        setHealthStates((prev) => ({ ...prev, [lead.id]: 'found' }))
      } else {
        setHealthStates((prev) => ({ ...prev, [lead.id]: 'unreachable' }))
      }
    } catch {
      setHealthStates((prev) => ({ ...prev, [lead.id]: 'unreachable' }))
    }
  }

  function healthScoreChipClass(score: number): string {
    if (score <= 30) return 'bg-red-50 text-red-700'
    if (score <= 60) return 'bg-amber-50 text-amber-700'
    return 'bg-green-50 text-green-700'
  }

  const headerCell = (label: string, key: SortKey) => (
    <th
      className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone"
      aria-sort={sortKey === key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        onClick={() => handleSort(key)}
        className="flex items-center gap-1.5 hover:text-ink transition-colors"
      >
        {label}
        <SortIcon column={key} sortKey={sortKey} sortDir={sortDir} />
      </button>
    </th>
  )

  if (leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-stone">
        <p className="text-sm">No leads to display</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-sand bg-card shadow-card">
      <table className="w-full min-w-[800px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-sand bg-paper-2">
            <th className="w-10 px-4 py-3">
              <span className="sr-only">Select</span>
            </th>
            {headerCell('Business', 'businessName')}
            <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone">
              Category
            </th>
            <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone">
              Location
            </th>
            {showZipColumn && (
              <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone">
                ZIP
              </th>
            )}
            <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone">
              Phone
            </th>
            <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone">
              Website
            </th>
            <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone">
              Email
            </th>
            <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone">
              Health
            </th>
            {headerCell('Rating', 'rating')}
            <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone">
              Employees
            </th>
            {headerCell('Score', 'leadScore')}
            <th className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-stone">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-sand">
          {sorted.map((lead) => {
            const isSaved = savedIds.includes(lead.id)
            const hasWebsite = Boolean(lead.website && lead.website.trim() !== '')

            return (
              <tr
                key={lead.id}
                className="group transition-colors hover:bg-signal-50/50"
              >
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    aria-label={`Select ${lead.businessName}`}
                    className="h-4 w-4 cursor-pointer rounded border-sand accent-signal"
                  />
                </td>
                <td className="px-4 py-3">
                  <span className="font-semibold text-ink">{lead.businessName}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-block rounded-full bg-signal-50 px-2 py-0.5 text-xs font-medium text-signal-600">
                    {lead.category}
                  </span>
                </td>
                <td className="px-4 py-3 text-stone">
                  <span className="whitespace-nowrap">
                    {lead.city}, {lead.state}
                  </span>
                </td>
                {showZipColumn && (
                  <td className="px-4 py-3">
                    {lead.sourceZip ? (
                      <span className="inline-block rounded-full bg-paper-2 px-2 py-0.5 text-xs font-medium font-mono text-stone">
                        {lead.sourceZip}
                      </span>
                    ) : (
                      <span className="text-stone text-xs">—</span>
                    )}
                  </td>
                )}
                <td className="px-4 py-3">
                  {lead.phone ? (
                    <a
                      href={`tel:${lead.phone.replace(/\D/g, '')}`}
                      className="inline-flex items-center gap-1 font-mono text-signal hover:text-signal-600 transition-colors whitespace-nowrap"
                    >
                      <Phone className="h-3.5 w-3.5 shrink-0" />
                      {lead.phone}
                    </a>
                  ) : (
                    <span className="text-stone">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {hasWebsite ? (
                    <a
                      href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-signal hover:text-signal-600 transition-colors"
                    >
                      <Globe className="h-3.5 w-3.5 shrink-0" />
                      <span className="max-w-[120px] truncate">
                        {lead.website.replace(/^https?:\/\/(www\.)?/, '')}
                      </span>
                    </a>
                  ) : (
                    <span className="inline-block rounded-full bg-signal-50 px-2 py-0.5 text-xs font-semibold text-signal-600">
                      No Website
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {!lead.website ? (
                    <span className="text-stone text-xs">—</span>
                  ) : emailStates[lead.id] === 'loading' ? (
                    <Loader2 className="h-4 w-4 animate-spin text-stone" />
                  ) : emailStates[lead.id] === 'found' ? (
                    <span className="inline-flex items-center gap-1.5">
                      <a
                        href={`mailto:${emailData[lead.id]?.email}`}
                        className="max-w-[140px] truncate font-mono text-signal hover:text-signal-600 transition-colors text-xs"
                      >
                        {emailData[lead.id]?.email}
                      </a>
                      <span
                        className={cn(
                          'inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                          emailData[lead.id]?.confidence === 'verified'
                            ? 'bg-green-50 text-green-700'
                            : emailData[lead.id]?.confidence === 'likely'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-paper-2 text-stone'
                        )}
                      >
                        {emailData[lead.id]?.confidence}
                      </span>
                    </span>
                  ) : emailStates[lead.id] === 'not_found' ? (
                    <span className="text-stone text-xs">—</span>
                  ) : (
                    <button
                      onClick={() => handleFindEmail(lead)}
                      aria-label={`Find email for ${lead.businessName}`}
                      className="rounded-lg p-1.5 text-stone hover:bg-paper-2 hover:text-ink transition-colors"
                    >
                      <Mail className="h-4 w-4 shrink-0" />
                    </button>
                  )}
                </td>
                <td className="px-4 py-3">
                  {!hasWebsite ? (
                    <span className="text-stone text-xs">—</span>
                  ) : healthStates[lead.id] === 'loading' ? (
                    <Loader2 className="h-4 w-4 animate-spin text-stone" />
                  ) : healthStates[lead.id] === 'found' ? (
                    <span
                      className={cn(
                        'inline-block rounded-full px-2 py-0.5 text-xs font-bold font-mono tabular-nums',
                        healthScoreChipClass(healthData[lead.id]?.score ?? 0)
                      )}
                    >
                      {healthData[lead.id]?.score}
                    </span>
                  ) : healthStates[lead.id] === 'unreachable' ? (
                    <span className="text-stone text-xs">—</span>
                  ) : (
                    <button
                      onClick={() => handleCheckHealth(lead)}
                      aria-label={`Check health for ${lead.businessName}`}
                      className="rounded-lg p-1.5 text-stone hover:bg-paper-2 hover:text-green-600 transition-colors"
                    >
                      <Zap className="h-4 w-4 shrink-0" />
                    </button>
                  )}
                </td>
                <td className="px-4 py-3">
                  <StarBadge rating={lead.rating} />
                  {lead.reviewCount !== null && (
                    <span className="ml-1 text-xs text-stone font-mono tabular-nums">
                      ({lead.reviewCount})
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {lead.employeeCount != null ? (
                    <span className="inline-flex items-center gap-1 text-xs font-mono text-ink-soft">
                      <Users className="h-3.5 w-3.5 shrink-0 text-stone" />
                      {lead.employeeCount}
                    </span>
                  ) : (
                    <span className="text-stone text-xs">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <LeadScore score={lead.leadScore} size="sm" />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => onSave(lead)}
                      aria-label={isSaved ? 'Remove from saved' : 'Save lead'}
                      className={cn(
                        'rounded-lg p-1.5 transition-colors',
                        isSaved
                          ? 'bg-signal-50 text-signal-600 hover:bg-signal-50'
                          : 'text-stone hover:bg-paper-2 hover:text-ink'
                      )}
                    >
                      {isSaved ? (
                        <BookmarkCheck className="h-4 w-4 shrink-0" />
                      ) : (
                        <Bookmark className="h-4 w-4 shrink-0" />
                      )}
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
