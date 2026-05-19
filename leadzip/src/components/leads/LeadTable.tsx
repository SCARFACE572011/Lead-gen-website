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
  Star,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Lead } from '@/types/lead'
import { LeadScore } from './LeadScore'

type SortKey = 'leadScore' | 'rating' | 'reviewCount' | 'businessName'
type SortDir = 'asc' | 'desc'

interface LeadTableProps {
  leads: Lead[]
  onSave: (lead: Lead) => void
  savedIds: string[]
}

function SortIcon({ column, sortKey, sortDir }: { column: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (column !== sortKey) return <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
  return sortDir === 'asc'
    ? <ArrowUp className="h-3.5 w-3.5 text-blue-600" />
    : <ArrowDown className="h-3.5 w-3.5 text-blue-600" />
}

function StarBadge({ rating }: { rating: number | null }) {
  if (rating === null) return <span className="text-slate-400 text-xs">—</span>
  return (
    <span className="inline-flex items-center gap-1 tabular-nums text-sm">
      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400 shrink-0" />
      <span className="font-medium text-slate-700">{rating.toFixed(1)}</span>
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

  const headerCell = (label: string, key: SortKey) => (
    <th
      className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
      aria-sort={sortKey === key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        onClick={() => handleSort(key)}
        className="flex items-center gap-1.5 hover:text-slate-800 transition-colors"
      >
        {label}
        <SortIcon column={key} sortKey={sortKey} sortDir={sortDir} />
      </button>
    </th>
  )

  if (leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400">
        <p className="text-sm">No leads to display</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[800px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50">
            <th className="w-10 px-4 py-3">
              <span className="sr-only">Select</span>
            </th>
            {headerCell('Business', 'businessName')}
            <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              Category
            </th>
            <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              Location
            </th>
            {showZipColumn && (
              <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                ZIP
              </th>
            )}
            <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              Phone
            </th>
            <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              Website
            </th>
            <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              Email
            </th>
            {headerCell('Rating', 'rating')}
            <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              Employees
            </th>
            {headerCell('Score', 'leadScore')}
            <th className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {sorted.map((lead) => {
            const isSaved = savedIds.includes(lead.id)
            const hasWebsite = Boolean(lead.website && lead.website.trim() !== '')

            return (
              <tr
                key={lead.id}
                className="group transition-colors hover:bg-blue-50/40"
              >
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    aria-label={`Select ${lead.businessName}`}
                    className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-blue-600"
                  />
                </td>
                <td className="px-4 py-3">
                  <span className="font-semibold text-slate-900">{lead.businessName}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-block rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                    {lead.category}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-500">
                  <span className="whitespace-nowrap">
                    {lead.city}, {lead.state}
                  </span>
                </td>
                {showZipColumn && (
                  <td className="px-4 py-3">
                    {lead.sourceZip ? (
                      <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                        {lead.sourceZip}
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs">—</span>
                    )}
                  </td>
                )}
                <td className="px-4 py-3">
                  {lead.phone ? (
                    <a
                      href={`tel:${lead.phone.replace(/\D/g, '')}`}
                      className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 transition-colors whitespace-nowrap"
                    >
                      <Phone className="h-3.5 w-3.5 shrink-0" />
                      {lead.phone}
                    </a>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {hasWebsite ? (
                    <a
                      href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      <Globe className="h-3.5 w-3.5 shrink-0" />
                      <span className="max-w-[120px] truncate">
                        {lead.website.replace(/^https?:\/\/(www\.)?/, '')}
                      </span>
                    </a>
                  ) : (
                    <span className="inline-block rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
                      No Website
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {!lead.website ? (
                    <span className="text-slate-400 text-xs">—</span>
                  ) : emailStates[lead.id] === 'loading' ? (
                    <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                  ) : emailStates[lead.id] === 'found' ? (
                    <span className="inline-flex items-center gap-1.5">
                      <a
                        href={`mailto:${emailData[lead.id]?.email}`}
                        className="max-w-[140px] truncate text-blue-600 hover:text-blue-800 transition-colors text-xs"
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
                            : 'bg-slate-100 text-slate-500'
                        )}
                      >
                        {emailData[lead.id]?.confidence}
                      </span>
                    </span>
                  ) : emailStates[lead.id] === 'not_found' ? (
                    <span className="text-slate-400 text-xs">—</span>
                  ) : (
                    <button
                      onClick={() => handleFindEmail(lead)}
                      aria-label={`Find email for ${lead.businessName}`}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                    >
                      <Mail className="h-4 w-4 shrink-0" />
                    </button>
                  )}
                </td>
                <td className="px-4 py-3">
                  <StarBadge rating={lead.rating} />
                  {lead.reviewCount !== null && (
                    <span className="ml-1 text-xs text-slate-400 tabular-nums">
                      ({lead.reviewCount})
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {lead.employeeCount != null ? (
                    <span className="inline-flex items-center gap-1 text-xs text-slate-600">
                      <Users className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      {lead.employeeCount}
                    </span>
                  ) : (
                    <span className="text-slate-400 text-xs">—</span>
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
                          ? 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                          : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'
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
