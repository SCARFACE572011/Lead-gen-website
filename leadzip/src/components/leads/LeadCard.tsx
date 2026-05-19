'use client'

import { useState } from 'react'
import {
  Bookmark,
  BookmarkCheck,
  Phone,
  Globe,
  MapPin,
  Star,
  MessageSquare,
  AlertCircle,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Lead } from '@/types/lead'
import { LeadScore } from './LeadScore'

interface LeadCardProps {
  lead: Lead
  onSave: (lead: Lead) => void
  isSaved?: boolean
  isSelected?: boolean
  onSelect?: (id: string) => void
}

function StarRating({ rating, reviewCount }: { rating: number | null; reviewCount: number | null }) {
  if (rating === null) return <span className="text-xs text-slate-400">No reviews</span>

  const full = Math.floor(rating)
  const partial = rating % 1

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => {
          const filled = i < full
          const isPartial = i === full && partial >= 0.5
          return (
            <Star
              key={i}
              className={cn(
                'h-3.5 w-3.5 shrink-0',
                filled || isPartial
                  ? 'fill-amber-400 text-amber-400'
                  : 'fill-slate-200 text-slate-200'
              )}
            />
          )
        })}
      </div>
      <span className="text-xs font-medium text-slate-600 tabular-nums">
        {rating.toFixed(1)}
      </span>
      {reviewCount !== null && (
        <span className="text-xs text-slate-400 tabular-nums">({reviewCount})</span>
      )}
    </div>
  )
}

function formatWebsite(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '').slice(0, 32) + (url.replace(/^https?:\/\/(www\.)?/, '').length > 32 ? '…' : '')
}

export function LeadCard({
  lead,
  onSave,
  isSaved = false,
  isSelected = false,
  onSelect,
}: LeadCardProps) {
  const [noteOpen, setNoteOpen] = useState(false)
  const [noteDraft, setNoteDraft] = useState(lead.notes ?? '')
  const hasWebsite = Boolean(lead.website && lead.website.trim() !== '')

  return (
    <div
      className={cn(
        'group relative flex flex-col gap-3 rounded-xl border bg-white p-4 transition-all duration-200',
        'hover:shadow-md hover:-translate-y-0.5',
        isSelected
          ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-sm'
          : 'border-slate-200 shadow-sm'
      )}
    >
      {/* Selection checkbox */}
      {onSelect && (
        <div className="absolute left-3 top-3">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onSelect(lead.id)}
            aria-label={`Select ${lead.businessName}`}
            className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-blue-600"
          />
        </div>
      )}

      {/* Header */}
      <div className={cn('flex items-start justify-between gap-2', onSelect && 'pl-6')}>
        <div className="flex-1 min-w-0">
          <h3 className="truncate text-sm font-semibold text-slate-900 leading-snug">
            {lead.businessName}
          </h3>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            <span className="inline-block rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
              {lead.category}
            </span>
            {lead.sourceZip && (
              <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                {lead.sourceZip}
              </span>
            )}
          </div>
        </div>
        <LeadScore score={lead.leadScore} size="sm" />
      </div>

      {/* Rating */}
      <StarRating rating={lead.rating} reviewCount={lead.reviewCount} />

      {/* Address & Distance */}
      <div className="flex items-start gap-1.5 text-xs text-slate-500">
        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
        <span className="leading-relaxed">
          {lead.address}, {lead.city}, {lead.state} {lead.zipCode}
          {lead.distanceMiles !== null && (
            <span className="ml-1 font-medium text-slate-600">
              · {lead.distanceMiles.toFixed(1)} mi
            </span>
          )}
        </span>
      </div>

      {/* Phone */}
      {lead.phone ? (
        <a
          href={`tel:${lead.phone.replace(/\D/g, '')}`}
          className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors w-fit"
        >
          <Phone className="h-3.5 w-3.5 shrink-0" />
          {lead.phone}
        </a>
      ) : (
        <span className="flex items-center gap-1.5 text-xs text-slate-400">
          <Phone className="h-3.5 w-3.5 shrink-0" />
          No phone listed
        </span>
      )}

      {/* Website */}
      {hasWebsite ? (
        <a
          href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors w-fit"
        >
          <Globe className="h-3.5 w-3.5 shrink-0" />
          {formatWebsite(lead.website)}
        </a>
      ) : (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700 w-fit">
          <AlertCircle className="h-3 w-3 shrink-0" />
          No Website — High Opportunity
        </span>
      )}

      {/* Employee count + revenue */}
      {lead.employeeCount != null && (
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
            <Users className="h-3 w-3 shrink-0" />
            {lead.employeeCount} emp.
          </span>
          {lead.revenueEstimate && (
            <span className="text-xs text-slate-500">{lead.revenueEstimate}</span>
          )}
        </div>
      )}

      {/* Social links */}
      {(lead.facebookUrl || lead.instagramUrl || lead.linkedinUrl) && (
        <div className="flex items-center gap-1.5">
          {lead.facebookUrl && (
            <a
              href={lead.facebookUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Facebook"
              className="rounded px-1.5 py-0.5 text-[10px] font-bold text-white bg-[#1877F2] hover:opacity-80 transition-opacity"
            >
              FB
            </a>
          )}
          {lead.instagramUrl && (
            <a
              href={lead.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              className="rounded px-1.5 py-0.5 text-[10px] font-bold text-white bg-[#E1306C] hover:opacity-80 transition-opacity"
            >
              IG
            </a>
          )}
          {lead.linkedinUrl && (
            <a
              href={lead.linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="LinkedIn"
              className="rounded px-1.5 py-0.5 text-[10px] font-bold text-white bg-[#0077B5] hover:opacity-80 transition-opacity"
            >
              LI
            </a>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="mt-1 flex items-center gap-2 border-t border-slate-100 pt-3">
        <button
          onClick={() => onSave({ ...lead, notes: noteDraft })}
          aria-label={isSaved ? 'Remove from saved' : 'Save lead'}
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all duration-150',
            isSaved
              ? 'bg-blue-50 text-blue-700 hover:bg-blue-100'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          )}
        >
          {isSaved ? (
            <BookmarkCheck className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <Bookmark className="h-3.5 w-3.5 shrink-0" />
          )}
          {isSaved ? 'Saved' : 'Save'}
        </button>

        <button
          onClick={() => setNoteOpen(!noteOpen)}
          aria-label="Add note"
          className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200"
        >
          <MessageSquare className="h-3.5 w-3.5 shrink-0" />
          Note
        </button>
      </div>

      {/* Note area */}
      {noteOpen && (
        <textarea
          value={noteDraft}
          onChange={(e) => setNoteDraft(e.target.value)}
          placeholder="Add a note about this lead..."
          rows={2}
          className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/20"
        />
      )}
    </div>
  )
}
