'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, CheckCircle2, Loader2, Mail } from 'lucide-react'
import { track } from '@/lib/analytics'

interface TerritoryFormState {
  name: string
  email: string
  territory: string
  businessType: string
  offer: string
  notes: string
  companyWebsite: string
}

const EMPTY_FORM: TerritoryFormState = {
  name: '',
  email: '',
  territory: '',
  businessType: '',
  offer: 'Web design',
  notes: '',
  companyWebsite: '',
}

const inputClass =
  'mt-1.5 w-full rounded-xl border border-sand bg-white px-3.5 py-3 text-[15px] text-ink outline-none transition-colors placeholder:text-stone/70 focus:border-signal focus:ring-2 focus:ring-signal/15'

export function FirstTerritoryForm() {
  const [form, setForm] = useState<TerritoryFormState>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  function update(field: keyof TerritoryFormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }))
    if (error) setError('')
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError('')

    try {
      const response = await fetch('/api/territory-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const payload = (await response.json().catch(() => ({}))) as { error?: string }
      if (!response.ok) {
        setError(payload.error || 'We could not send your request. Please try again.')
        return
      }
      setSubmitted(true)
      track('first_territory_request_submitted', {
        has_notes: Boolean(form.notes.trim()),
      })
    } catch {
      setError('We could not reach the request form. Please try again or email support@leadzipp.com.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="rounded-3xl border border-lime/40 bg-forest p-7 text-white sm:p-9" role="status">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-lime text-forest">
          <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
        </span>
        <h2 className="mt-5 font-display text-2xl font-extrabold">Your territory request is in.</h2>
        <p className="mt-3 max-w-lg leading-relaxed text-white/75">
          We have the market, business type, and offer. A real person will review it and reply to{' '}
          <strong className="text-white">{form.email}</strong> with the next step. No automated sales sequence.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/sample-territory"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-signal px-5 py-2.5 text-sm font-semibold text-white"
          >
            See the sample report <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link
            href="/resources/web-design-outreach-kit"
            className="inline-flex items-center justify-center rounded-full border border-white/20 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
          >
            Get the outreach kit
          </Link>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-3xl border border-sand bg-paper-2 p-6 shadow-card sm:p-8" noValidate>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-signal-50 text-signal">
          <Mail className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <h2 className="font-display text-2xl font-extrabold">Tell us where you sell.</h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">
            Five fields. We use them only to prepare and reply to this request.
          </p>
        </div>
      </div>

      <div className="mt-7 grid gap-5 sm:grid-cols-2">
        <label className="text-sm font-semibold text-ink">
          Your name <span className="text-signal" aria-hidden="true">*</span>
          <input
            required
            autoComplete="name"
            value={form.name}
            onChange={(event) => update('name', event.target.value)}
            className={inputClass}
            placeholder="Jordan Lee"
            maxLength={80}
          />
        </label>
        <label className="text-sm font-semibold text-ink">
          Work email <span className="text-signal" aria-hidden="true">*</span>
          <input
            required
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(event) => update('email', event.target.value)}
            className={inputClass}
            placeholder="you@agency.com"
            maxLength={254}
          />
        </label>
        <label className="text-sm font-semibold text-ink">
          Territory <span className="text-signal" aria-hidden="true">*</span>
          <input
            required
            value={form.territory}
            onChange={(event) => update('territory', event.target.value)}
            className={inputClass}
            placeholder="Austin, TX or 78704"
            maxLength={120}
          />
        </label>
        <label className="text-sm font-semibold text-ink">
          Businesses to target <span className="text-signal" aria-hidden="true">*</span>
          <input
            required
            value={form.businessType}
            onChange={(event) => update('businessType', event.target.value)}
            className={inputClass}
            placeholder="Roofers, dentists, restaurants…"
            maxLength={100}
          />
        </label>
      </div>

      <label className="mt-5 block text-sm font-semibold text-ink">
        What do you sell? <span className="text-signal" aria-hidden="true">*</span>
        <select
          required
          value={form.offer}
          onChange={(event) => update('offer', event.target.value)}
          className={inputClass}
        >
          <option>Web design</option>
          <option>Local SEO</option>
          <option>Reputation management</option>
          <option>Paid advertising</option>
          <option>Another local-business service</option>
        </select>
      </label>

      <label className="mt-5 block text-sm font-semibold text-ink">
        Helpful context <span className="font-normal text-stone">(optional)</span>
        <textarea
          value={form.notes}
          onChange={(event) => update('notes', event.target.value)}
          className={`${inputClass} min-h-28 resize-y`}
          placeholder="Your ideal project, minimum budget, or the kind of gap you want us to prioritize."
          maxLength={600}
        />
      </label>

      <label className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
        Company website
        <input
          tabIndex={-1}
          autoComplete="off"
          value={form.companyWebsite}
          onChange={(event) => update('companyWebsite', event.target.value)}
        />
      </label>

      {error && (
        <p className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}{' '}
          <a href="mailto:support@leadzipp.com" className="font-semibold underline underline-offset-2">
            Email support instead
          </a>
          .
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-signal px-6 py-3 font-semibold text-white transition-colors hover:bg-signal-600 disabled:cursor-wait disabled:opacity-70"
      >
        {submitting ? (
          <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Sending request…</>
        ) : (
          <>Build my first territory <ArrowRight className="h-4 w-4" aria-hidden="true" /></>
        )}
      </button>
      <p className="mt-3 text-center text-xs leading-relaxed text-stone">
        No purchase required. By sending this form, you agree to our{' '}
        <Link href="/privacy" className="underline underline-offset-2 hover:text-ink">privacy policy</Link>.
      </p>
    </form>
  )
}
