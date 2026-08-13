'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, Copy, Check, Mail, RefreshCw, Sparkles, FileText, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { Lead } from '@/types/lead'

interface ProposalOutput {
  coldEmailSubject: string
  coldEmail: string
  proposal: string
  whatsapp: string
  linkedin: string
  callScript: string
}

type TabKey = 'email' | 'proposal' | 'whatsapp' | 'linkedin' | 'call'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'email', label: 'Cold email' },
  { key: 'proposal', label: 'Proposal' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'call', label: 'Call script' },
]

function tabText(output: ProposalOutput, tab: TabKey): string {
  switch (tab) {
    case 'email':
      return `Subject: ${output.coldEmailSubject}\n\n${output.coldEmail}`
    case 'proposal':
      return output.proposal
    case 'whatsapp':
      return output.whatsapp
    case 'linkedin':
      return output.linkedin
    case 'call':
      return output.callScript
  }
}

export default function ProposalModal({
  lead,
  onClose,
}: {
  lead: Lead | null
  onClose: () => void
}) {
  const [output, setOutput] = useState<ProposalOutput | null>(null)
  const [source, setSource] = useState<'ai' | 'template' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<TabKey>('email')
  const [copied, setCopied] = useState(false)
  // Bumped by "Regenerate" / "Try again" to re-run the fetch effect
  const [attempt, setAttempt] = useState(0)

  // Reset per-lead UI state during render (React's "adjust state when props
  // change" pattern) so the effect below only performs the fetch.
  const [renderedLeadId, setRenderedLeadId] = useState<string | null>(null)
  if (lead && lead.id !== renderedLeadId) {
    setRenderedLeadId(lead.id)
    setTab('email')
    setCopied(false)
    setOutput(null)
    setSource(null)
    setError(null)
  }

  // Loading is derived: a lead is open but no result has landed yet
  const loading = lead != null && output == null && error == null

  useEffect(() => {
    if (!lead) return
    // Already have a result (or a surfaced error) for this lead: reopening the
    // modal should not burn another generation. Regenerate resets these first.
    if (output != null || error != null) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/leads/proposal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lead: {
              businessName: lead.businessName,
              category: lead.category,
              city: lead.city,
              state: lead.state,
              website: lead.website,
              phone: lead.phone,
              email: lead.email,
              rating: lead.rating,
              reviewCount: lead.reviewCount,
            },
          }),
        })
        const data = await res.json()
        if (cancelled) return
        if (!res.ok) throw new Error(data?.error ?? 'Generation failed')
        setOutput(data.output as ProposalOutput)
        setSource(data.source === 'ai' ? 'ai' : 'template')
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Generation failed')
      }
    })()
    return () => { cancelled = true }
  }, [lead, attempt, output, error])

  const regenerate = useCallback(() => {
    setOutput(null)
    setSource(null)
    setError(null)
    setAttempt((a) => a + 1)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (lead) window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lead, onClose])

  if (!lead) return null

  const handleCopy = async () => {
    if (!output) return
    try {
      await navigator.clipboard.writeText(tabText(output, tab))
      setCopied(true)
      toast.success('Copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Could not copy. Select the text manually.')
    }
  }

  const mailtoHref = output
    ? `mailto:${lead.email ?? ''}?subject=${encodeURIComponent(output.coldEmailSubject)}&body=${encodeURIComponent(output.coldEmail)}`
    : '#'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-ink/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Outreach for ${lead.businessName}`}
        className="relative bg-card border border-sand rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-sand">
          <div className="min-w-0">
            <span className="readout text-signal">Outreach generator</span>
            <h2 className="font-display text-lg font-bold text-ink truncate mt-0.5">
              {lead.businessName}
            </h2>
            <p className="text-xs text-stone mt-0.5">
              {lead.category}
              {lead.city ? ` · ${lead.city}${lead.state ? `, ${lead.state}` : ''}` : ''}
              {!lead.website ? ' · No website' : ''}
              {lead.rating != null && lead.rating < 4.0 ? ` · ${lead.rating} stars` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {source && !loading && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold tracking-wide uppercase',
                  source === 'ai'
                    ? 'bg-signal-50 text-signal'
                    : 'bg-paper-2 text-stone border border-sand'
                )}
              >
                {source === 'ai' ? <Sparkles className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                {source === 'ai' ? 'AI personalized' : 'Smart template'}
              </span>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-stone hover:text-ink hover:bg-paper-2 transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 pt-3 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setCopied(false) }}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors',
                tab === t.key
                  ? 'bg-signal text-white'
                  : 'text-ink-soft hover:bg-paper-2'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="space-y-3 py-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-3.5 rounded bg-paper-2 animate-pulse"
                  style={{ width: `${90 - i * 9}%` }}
                />
              ))}
              <p className="text-xs text-stone pt-2">Writing outreach from this lead&apos;s gap signals…</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center text-center py-10">
              <AlertCircle className="w-8 h-8 text-signal mb-3" />
              <p className="text-sm text-ink-soft mb-4">{error}</p>
              <button
                onClick={regenerate}
                className="inline-flex items-center gap-2 bg-signal text-white text-sm font-semibold px-4 py-2 rounded-full hover:bg-signal-600 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Try again
              </button>
            </div>
          ) : output ? (
            <>
              {tab === 'email' && (
                <p className="text-xs font-semibold text-ink mb-2">
                  Subject: <span className="font-normal text-ink-soft">{output.coldEmailSubject}</span>
                </p>
              )}
              <pre className="whitespace-pre-wrap font-sans text-sm text-ink-soft leading-relaxed">
                {tab === 'email' ? output.coldEmail : tabText(output, tab)}
              </pre>
            </>
          ) : null}
        </div>

        {/* Footer */}
        {output && !loading && !error && (
          <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-t border-sand bg-paper-2/60">
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-2 bg-ink text-paper text-sm font-semibold px-4 py-2 rounded-full hover:bg-forest transition-colors"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied' : 'Copy to clipboard'}
            </button>
            {tab === 'email' && (
              <a
                href={mailtoHref}
                className="inline-flex items-center gap-2 border border-sand bg-card text-ink-soft text-sm font-semibold px-4 py-2 rounded-full hover:bg-paper-2 transition-colors"
              >
                <Mail className="w-4 h-4" />
                Open in email app
              </a>
            )}
            <button
              onClick={regenerate}
              className="ml-auto inline-flex items-center gap-1.5 text-xs text-stone hover:text-ink transition-colors"
              title="Regenerate"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Regenerate
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
