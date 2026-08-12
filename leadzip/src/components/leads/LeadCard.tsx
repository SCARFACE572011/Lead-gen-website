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
  Mail,
  Loader2,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Lead, DigitalHealthDetails } from '@/types/lead'
import { LeadScore } from './LeadScore'

interface LeadCardProps {
  lead: Lead
  onSave: (lead: Lead) => void
  isSaved?: boolean
  isSelected?: boolean
  onSelect?: (id: string) => void
}

function StarRating({ rating, reviewCount }: { rating: number | null; reviewCount: number | null }) {
  if (rating === null) return <span className="text-xs text-stone">No reviews</span>

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
                  : 'fill-sand text-sand'
              )}
            />
          )
        })}
      </div>
      <span className="text-xs font-medium text-ink-soft font-mono tabular-nums">
        {rating.toFixed(1)}
      </span>
      {reviewCount !== null && (
        <span className="text-xs text-stone font-mono tabular-nums">({reviewCount})</span>
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

  type EmailState = 'idle' | 'loading' | 'found' | 'not_found'
  const [emailState, setEmailState] = useState<EmailState>('idle')
  const [foundEmail, setFoundEmail] = useState<string>('')
  const [emailConfidence, setEmailConfidence] = useState<'verified' | 'likely' | 'guessed'>('guessed')

  async function handleFindEmail() {
    if (!lead.website) return
    setEmailState('loading')
    try {
      const res = await fetch('/api/leads/enrich/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: lead.website }),
      })
      const data = await res.json()
      if (res.ok && data.email) {
        setFoundEmail(data.email)
        setEmailConfidence(data.confidence)
        setEmailState('found')
      } else {
        setEmailState('not_found')
      }
    } catch {
      setEmailState('not_found')
    }
  }

  const confidenceBadgeClass = {
    verified: 'bg-green-50 text-green-700',
    likely: 'bg-amber-50 text-amber-700',
    guessed: 'bg-paper-2 text-stone',
  }[emailConfidence]

  type HealthState = 'idle' | 'loading' | 'found' | 'unreachable'
  const [localHealthState, setLocalHealthState] = useState<HealthState>('idle')
  const [localHealthScore, setLocalHealthScore] = useState<number | null>(null)
  const [localHealthDetails, setLocalHealthDetails] = useState<DigitalHealthDetails | null>(null)
  const [breakdownOpen, setBreakdownOpen] = useState(false)
  const [hoursOpen, setHoursOpen] = useState(false)

  // Merge local state with lead prop (batch health check updates lead prop)
  const healthScore = localHealthScore ?? lead.digitalHealthScore ?? 0
  const healthDetails = localHealthDetails ?? lead.digitalHealthDetails ?? null
  const healthState: HealthState = localHealthState !== 'idle'
    ? localHealthState
    : lead.digitalHealthScore !== undefined ? 'found' : 'idle'

  async function handleCheckHealth() {
    if (!lead.website) return
    setLocalHealthState('loading')
    try {
      const res = await fetch('/api/leads/enrich/health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ website: lead.website }),
      })
      const data = await res.json()
      if (res.ok && typeof data.score === 'number') {
        setLocalHealthScore(data.score)
        setLocalHealthDetails(data.details ?? null)
        setLocalHealthState('found')
      } else {
        setLocalHealthState('unreachable')
      }
    } catch {
      setLocalHealthState('unreachable')
    }
  }

  // Merge Find Email / health results into the lead on save so the
  // enrichment data reaches localStorage, Supabase, and exports instead of
  // living only in component state
  function handleSaveClick() {
    onSave({
      ...lead,
      notes: noteDraft,
      ...(emailState === 'found' && foundEmail
        ? { email: foundEmail, emailConfidence }
        : {}),
      ...(localHealthScore != null ? { digitalHealthScore: localHealthScore } : {}),
      ...(localHealthDetails ? { digitalHealthDetails: localHealthDetails } : {}),
    })
  }

  function healthColor(score: number) {
    if (score <= 30) return { label: 'text-red-700', bar: 'bg-red-500' }
    if (score <= 60) return { label: 'text-amber-700', bar: 'bg-amber-400' }
    return { label: 'text-green-700', bar: 'bg-green-500' }
  }

  const VISIBLE_SIGNALS: { key: keyof DigitalHealthDetails; label: string; pts: number; caveat?: string }[] = [
    { key: 'hasHttps', label: 'SSL / HTTPS', pts: 5 },
    { key: 'mobileResponsive', label: 'Mobile-friendly', pts: 10 },
    { key: 'hasAnalytics', label: 'Google Analytics', pts: 10 },
    { key: 'hasGoogleAds', label: 'Google Ads', pts: 15 },
    { key: 'hasFacebookAds', label: 'Facebook Ads', pts: 15 },
    { key: 'hasGBP', label: 'Google Business Profile', pts: 15, caveat: 'detected from site' },
    { key: 'hasContactForm', label: 'Contact form / email', pts: 10 },
    { key: 'fastLoad', label: 'Fast server response', pts: 10 },
  ]

  return (
    <div
      className={cn(
        'group relative flex flex-col gap-3 rounded-2xl border bg-card p-4 card-lift',
        isSelected
          ? 'border-signal ring-2 ring-signal/20'
          : 'border-sand'
      )}
    >
      {/* Selection checkbox — desktop only; the mobile layout renders its own
          inline checkbox so it can't overlap the business name */}
      {onSelect && (
        <div className="absolute left-3 top-3 hidden lg:block">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onSelect(lead.id)}
            aria-label={`Select ${lead.businessName}`}
            className="h-4 w-4 cursor-pointer rounded border-sand accent-signal"
          />
        </div>
      )}

      {/* Compact layout — mobile only */}
      <div className="lg:hidden">
        <div className="flex items-start gap-2.5">
          {onSelect && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onSelect(lead.id)}
              aria-label={`Select ${lead.businessName}`}
              className="mt-1 h-4 w-4 shrink-0 cursor-pointer rounded border-sand accent-signal"
            />
          )}
          <div className="flex-1 min-w-0">
            <h3 className="truncate text-[15px] font-semibold font-display text-ink leading-snug">{lead.businessName}</h3>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1">
              {lead.rating !== null && (
                <span className="text-xs text-amber-600 font-medium font-mono">
                  ★ {lead.rating?.toFixed(1)}
                  {lead.reviewCount != null && <span className="text-stone"> ({lead.reviewCount})</span>}
                </span>
              )}
              {lead.distanceMiles !== null && lead.distanceMiles !== undefined && (
                <span className="text-xs text-stone font-mono">· {lead.distanceMiles.toFixed(1)} mi</span>
              )}
              {!lead.website && (
                <span className="rounded-full bg-signal-50 px-2 py-0.5 text-xs font-semibold text-signal-600">No website</span>
              )}
              {lead.openNow === false && (
                <span className="rounded-full bg-paper-2 px-2 py-0.5 text-xs font-medium text-stone">Closed now</span>
              )}
            </div>
            {lead.address && (
              <p className="mt-1 truncate text-xs text-stone">
                {lead.address}
                {lead.city ? `, ${lead.city}` : ''}
              </p>
            )}
          </div>
          <LeadScore score={lead.leadScore} size="sm" />
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={handleSaveClick}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 rounded-full px-3 py-2.5 text-xs font-semibold min-h-[44px] transition-all duration-150',
              isSaved ? 'bg-signal-50 text-signal-600' : 'bg-ink text-paper hover:bg-ink/90'
            )}
          >
            {isSaved ? <BookmarkCheck className="h-4 w-4 shrink-0" /> : <Bookmark className="h-4 w-4 shrink-0" />}
            {isSaved ? 'Saved' : 'Save Lead'}
          </button>
          {lead.phone && (
            <a
              href={`tel:${lead.phone.replace(/\D/g, '')}`}
              className="flex items-center justify-center rounded-full bg-paper-2 p-2.5 text-ink-soft hover:bg-sand transition-colors min-h-[44px] min-w-[44px]"
              aria-label={`Call ${lead.businessName}`}
            >
              <Phone className="h-4 w-4" />
            </a>
          )}
          {lead.website && (
            <a
              href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center rounded-full bg-paper-2 p-2.5 text-ink-soft hover:bg-sand transition-colors min-h-[44px] min-w-[44px]"
              aria-label={`Visit ${lead.businessName} website`}
            >
              <Globe className="h-4 w-4" />
            </a>
          )}
          {hasWebsite && (
            emailState === 'found' ? (
              <a
                href={`mailto:${foundEmail}`}
                title={foundEmail}
                className="flex items-center justify-center rounded-full bg-signal-50 p-2.5 text-signal-600 hover:bg-signal-50 transition-colors min-h-[44px] min-w-[44px]"
                aria-label={`Email ${lead.businessName}`}
              >
                <Mail className="h-4 w-4" />
              </a>
            ) : (
              <button
                onClick={handleFindEmail}
                disabled={emailState === 'loading'}
                className="flex items-center justify-center rounded-full bg-paper-2 p-2.5 text-ink-soft hover:bg-sand transition-colors min-h-[44px] min-w-[44px] disabled:opacity-60"
                aria-label={emailState === 'not_found' ? 'Email not found' : 'Find email'}
              >
                {emailState === 'loading'
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Mail className="h-4 w-4" />}
              </button>
            )
          )}
        </div>
      </div>

      {/* Full layout — desktop only */}
      <div className="hidden lg:flex flex-col gap-3">

      {/* Header */}
      <div className={cn('flex items-start justify-between gap-2', onSelect && 'pl-6')}>
        <div className="flex-1 min-w-0">
          <h3 className="truncate text-sm font-semibold font-display text-ink leading-snug">
            {lead.businessName}
          </h3>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            <span className="inline-block rounded-full bg-signal-50 px-2 py-0.5 text-xs font-medium text-signal-600">
              {lead.category}
            </span>
            {lead.sourceZip && (
              <span className="inline-block rounded-full bg-paper-2 px-2 py-0.5 text-xs font-medium font-mono text-stone">
                {lead.sourceZip}
              </span>
            )}
            {lead.openNow === true && (
              <span className="inline-block rounded-full bg-forest/10 px-2 py-0.5 text-xs font-medium text-forest">
                Open Now
              </span>
            )}
            {lead.openNow === false && (
              <span className="inline-block rounded-full bg-paper-2 px-2 py-0.5 text-xs font-medium text-stone">
                Closed now
              </span>
            )}
            {lead.priceLevel != null && lead.priceLevel > 0 && (
              <span className="inline-block rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium font-mono text-amber-700">
                {'$'.repeat(lead.priceLevel)}
              </span>
            )}
          </div>
        </div>
        <LeadScore score={lead.leadScore} size="sm" />
      </div>

      {/* Rating */}
      <StarRating rating={lead.rating} reviewCount={lead.reviewCount} />

      {/* Address & Distance */}
      <div className="flex items-start gap-1.5 text-xs text-stone">
        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-signal" />
        <span className="leading-relaxed">
          {lead.address}, {lead.city}, {lead.state} {lead.zipCode}
          {lead.distanceMiles !== null && (
            <span className="ml-1 font-medium font-mono text-ink-soft">
              · {lead.distanceMiles.toFixed(1)} mi
            </span>
          )}
          {lead.nearbyCompetitorCount != null && lead.nearbyCompetitorCount > 0 && (
            <span className="ml-1 text-stone">
              · {lead.nearbyCompetitorCount} competitor{lead.nearbyCompetitorCount !== 1 ? 's' : ''} nearby
            </span>
          )}
        </span>
      </div>

      {/* Business hours (collapsible) */}
      {lead.businessHours && lead.businessHours.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setHoursOpen(o => !o)}
            className="text-xs text-stone hover:text-ink-soft transition-colors"
          >
            {hoursOpen ? '▴ hide hours' : '▾ show hours'}
          </button>
          {hoursOpen && (
            <div className="mt-1.5 rounded-lg bg-paper-2 p-2 space-y-0.5">
              {lead.businessHours.map((h, i) => (
                <p key={i} className="text-xs text-ink-soft">{h}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Phone */}
      {lead.phone ? (
        <a
          href={`tel:${lead.phone.replace(/\D/g, '')}`}
          className="flex items-center gap-1.5 text-xs font-medium font-mono text-signal hover:text-signal-600 transition-colors w-fit"
        >
          <Phone className="h-3.5 w-3.5 shrink-0" />
          {lead.phone}
        </a>
      ) : (
        <span className="flex items-center gap-1.5 text-xs text-stone">
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
          className="flex items-center gap-1.5 text-xs font-medium text-signal hover:text-signal-600 transition-colors w-fit"
        >
          <Globe className="h-3.5 w-3.5 shrink-0" />
          {formatWebsite(lead.website)}
        </a>
      ) : (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-signal-50 px-2.5 py-0.5 text-xs font-semibold text-signal-600 w-fit">
          <AlertCircle className="h-3 w-3 shrink-0" />
          No Website — High Opportunity
        </span>
      )}

      {/* Employee count + revenue */}
      {lead.employeeCount != null && (
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1 rounded-full bg-paper-2 px-2.5 py-0.5 text-xs font-medium text-ink-soft">
            <Users className="h-3 w-3 shrink-0" />
            <span className="font-mono">{lead.employeeCount}</span> emp.
          </span>
          {lead.revenueEstimate && (
            <span className="text-xs text-stone">{lead.revenueEstimate}</span>
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
      <div className="mt-1 flex items-center gap-2 border-t border-sand pt-3 flex-wrap">
        <button
          onClick={handleSaveClick}
          aria-label={isSaved ? 'Remove from saved' : 'Save lead'}
          className={cn(
            'flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium transition-all duration-150',
            isSaved
              ? 'bg-signal-50 text-signal-600 hover:bg-signal-50'
              : 'bg-paper-2 text-ink-soft hover:bg-sand'
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
          className="flex items-center gap-1.5 rounded-full bg-paper-2 px-2.5 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:bg-sand"
        >
          <MessageSquare className="h-3.5 w-3.5 shrink-0" />
          Note
        </button>

        {hasWebsite && (
          <>
            {emailState === 'idle' && (
              <button
                onClick={handleFindEmail}
                aria-label="Find email"
                className="flex items-center gap-1.5 rounded-full bg-paper-2 px-2.5 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:bg-sand"
              >
                <Mail className="h-3.5 w-3.5 shrink-0" />
                Find Email
              </button>
            )}

            {emailState === 'loading' && (
              <span className="flex items-center gap-1.5 rounded-full bg-paper-2 px-2.5 py-1.5 text-xs font-medium text-stone cursor-not-allowed">
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                Finding…
              </span>
            )}

            {emailState === 'found' && (
              <div className="flex items-center gap-1.5">
                <a
                  href={`mailto:${foundEmail}`}
                  className="max-w-[160px] truncate text-xs font-medium font-mono text-signal hover:text-signal-600 transition-colors"
                >
                  {foundEmail}
                </a>
                <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-semibold', confidenceBadgeClass)}>
                  {emailConfidence}
                </span>
              </div>
            )}

            {emailState === 'not_found' && (
              <span className="text-xs text-stone">Not found</span>
            )}

            {healthState === 'idle' && (
              <button
                onClick={handleCheckHealth}
                aria-label="Check digital health"
                className="flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1.5 text-xs font-medium text-green-700 transition-colors hover:bg-green-100"
              >
                <Zap className="h-3.5 w-3.5 shrink-0" />
                Check Health
              </button>
            )}

            {healthState === 'loading' && (
              <span className="flex items-center gap-1.5 rounded-full bg-paper-2 px-2.5 py-1.5 text-xs font-medium text-stone cursor-not-allowed">
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                Checking…
              </span>
            )}
            {healthState === 'found' && (
              <span className={cn('text-xs font-bold font-mono tabular-nums', healthColor(healthScore).label)}>
                {healthScore}/100
              </span>
            )}
          </>
        )}
      </div>

      {/* Health result */}
      {hasWebsite && healthState === 'found' && (
        <div className="mt-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('text-sm font-bold font-mono tabular-nums', healthColor(healthScore).label)}>
              {healthScore}/100
            </span>
            <div className="h-1.5 w-20 rounded-full bg-sand overflow-hidden">
              <div
                className={cn('h-full rounded-full', healthColor(healthScore).bar)}
                style={{ width: `${healthScore}%` }}
              />
            </div>
            {healthScore <= 30 && (
              <span className="rounded-full bg-signal-50 px-2 py-0.5 text-[10px] font-semibold text-signal-600">
                High opportunity
              </span>
            )}
            <button
              onClick={() => setBreakdownOpen((o) => !o)}
              className="text-xs text-stone hover:text-ink-soft transition-colors"
            >
              {breakdownOpen ? '▴ hide' : '▾ breakdown'}
            </button>
          </div>

          {breakdownOpen && healthDetails && (
            <div className="mt-2 space-y-2">
              {/* Website screenshot */}
              {hasWebsite && (
                <div className="rounded-lg overflow-hidden border border-sand bg-paper-2 h-28 relative">
                  <img
                    src={`https://api.microlink.io/?url=${encodeURIComponent(lead.website)}&screenshot=true&embed=screenshot.url&type=jpeg&meta=false`}
                    alt={`${lead.businessName} website`}
                    className="w-full h-full object-cover object-top"
                    loading="lazy"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                </div>
              )}
              <div className="rounded-lg bg-paper-2 p-2 text-xs">
                {VISIBLE_SIGNALS.map(({ key, label, pts, caveat }) => (
                  <div key={key} className="flex items-center justify-between border-b border-sand py-1 last:border-0">
                    <span className="text-ink-soft">
                      {label}
                      {caveat && <span className="ml-1 italic text-stone">({caveat})</span>}
                      <span className="ml-1 font-mono text-stone">+{pts}</span>
                    </span>
                    <span className={healthDetails[key] ? 'font-bold text-green-600' : 'font-bold text-red-500'}>
                      {healthDetails[key] ? '✓' : '✗'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {hasWebsite && healthState === 'unreachable' && (
        <p className="mt-1 text-xs text-stone">⚠ Couldn&apos;t reach site</p>
      )}

      {/* Note area */}
      {noteOpen && (
        <textarea
          value={noteDraft}
          onChange={(e) => setNoteDraft(e.target.value)}
          placeholder="Add a note about this lead..."
          rows={2}
          className="w-full resize-none rounded-lg border border-sand bg-paper-2 px-3 py-2 text-xs text-ink-soft placeholder:text-stone focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/20"
        />
      )}
      </div>{/* end full layout */}
    </div>
  )
}
