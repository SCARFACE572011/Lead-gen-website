import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import type { HealthScoreResult } from '@/lib/healthScore'
import { PillarBreakdown, ScoreGauge } from '@/components/audit/HealthReportView'

/**
 * Public, shareable Digital Presence Audit — /audit/[slug].
 *
 * Read-only report page opened from a link an agency sends a prospect. Every
 * report footer links back to LeadZipp, which turns each shared audit into a
 * marketing channel.
 *
 * Reads the audit_reports row by slug using the SERVICE ROLE key, which
 * bypasses RLS. This is deliberate: the table grants anon nothing, because an
 * anon-readable policy would let anyone enumerate every report and learn which
 * businesses each customer is prospecting. The slug is the capability, and the
 * server is the only thing that can redeem it.
 */

export const dynamic = 'force-dynamic'

interface LeadSnapshot {
  businessName: string
  category?: string
  address?: string
  city?: string
  state?: string
  zipCode?: string
  phone?: string
  website?: string
  rating?: number | null
  reviewCount?: number | null
}

interface AuditRow {
  lead: LeadSnapshot
  health: HealthScoreResult
  created_at: string
}

function reportClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  // Service role only. The anon key cannot read this table by design, so
  // falling back to it would silently 404 every shared report.
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key || url === 'https://placeholder.supabase.co') {
    if (!key) {
      console.error(
        '[audit] SUPABASE_SERVICE_ROLE_KEY is missing, so shared audit report links cannot be read.'
      )
    }
    return null
  }
  return createClient(url, key, { auth: { persistSession: false } })
}

async function getReport(slug: string): Promise<AuditRow | null> {
  const supabase = reportClient()
  if (!supabase) return null
  const { data, error } = await supabase
    .from('audit_reports')
    .select('lead, health, created_at')
    .eq('slug', slug)
    .maybeSingle()
  if (error || !data) return null
  return data as unknown as AuditRow
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const report = await getReport(slug)
  const name = report?.lead?.businessName
  return {
    title: name ? `${name} | Digital Presence Audit` : 'Digital Presence Audit',
    description: name
      ? `How ${name} shows up online: Google profile, website quality, and conversion signals.`
      : 'A digital presence audit generated with LeadZipp.',
    robots: { index: false, follow: false },
  }
}

// ScoreGauge and PillarBreakdown live in @/components/audit/HealthReportView,
// shared with the public free checker on /free-audit.

function whatThisMeans(health: HealthScoreResult, name: string): string[] {
  const paragraphs: string[] = []
  const t = health.total
  if (t >= 80) {
    paragraphs.push(
      `${name} has a strong digital presence. The fundamentals are in place, so the biggest wins now come from staying ahead: fresh reviews, up-to-date listings, and conversion tuning.`
    )
  } else if (t >= 60) {
    paragraphs.push(
      `${name} has a solid base online, but customers comparing local options will notice the gaps below. Closing them is usually quick and directly improves how often searches turn into calls.`
    )
  } else if (t >= 40) {
    paragraphs.push(
      `${name} is visible online but leaving business on the table. Several checks below are failing, and each one is a place where a potential customer drops off before making contact.`
    )
  } else {
    paragraphs.push(
      `${name} is close to invisible to customers searching online. Most people check a business out on Google before calling; right now that first impression is working against ${name}.`
    )
  }

  const failed = health.pillars
    .flatMap((p) => p.checks)
    .filter((ch) => !ch.passed)
    .sort((a, b) => b.points - a.points)
  if (failed.length > 0) {
    const top = failed.slice(0, 3).map((ch) => ch.label.toLowerCase())
    paragraphs.push(
      `Highest-impact fixes, in order: ${top.join('; ')}. Together these are worth ${failed
        .slice(0, 3)
        .reduce((s, ch) => s + ch.points, 0)} points of this score.`
    )
  }
  return paragraphs
}

export default async function AuditReportPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const report = await getReport(slug)
  if (!report || !report.lead?.businessName || !report.health?.pillars) notFound()

  const { lead, health } = report
  const generated = new Date(report.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const location = [lead.city, lead.state].filter(Boolean).join(', ')

  return (
    <div className="min-h-screen bg-paper text-ink">
      {/* Top bar */}
      <header className="print-keep border-b border-sand bg-paper">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link href="/" className="flex items-center gap-1.5 font-display text-lg font-bold text-ink">
            LeadZipp
            <span className="mt-1 inline-block h-2 w-2 rounded-full bg-signal" />
          </Link>
          <span className="text-xs font-medium uppercase tracking-wide text-stone">
            Digital Presence Audit
          </span>
        </div>
      </header>

      <main id="main-content" className="mx-auto max-w-3xl px-4 pb-16">
        {/* Business header + gauge */}
        <section className="flex flex-col items-center gap-6 py-10 text-center sm:flex-row sm:justify-between sm:text-left">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-signal-600">
              Audit report
            </p>
            <h1 className="mt-1 font-display text-3xl font-bold leading-tight sm:text-4xl">
              {lead.businessName}
            </h1>
            <p className="mt-2 text-sm text-stone">
              {[lead.category, location || lead.address].filter(Boolean).join(' · ')}
            </p>
            <p className="mt-1 text-xs text-stone">
              Generated {generated}
              {health.verified ? ' · includes a live website check' : ' · estimated from public profile data'}
            </p>
          </div>
          <div className="shrink-0">
            <ScoreGauge total={health.total} />
          </div>
        </section>

        {/* Pillars */}
        <PillarBreakdown pillars={health.pillars} />

        {/* What this means */}
        <section className="mt-8 rounded-2xl border border-sand bg-card p-6">
          <h2 className="font-display text-lg font-bold">What this means</h2>
          <div className="mt-3 space-y-3">
            {whatThisMeans(health, lead.businessName).map((para, i) => (
              <p key={i} className="text-sm leading-relaxed text-ink-soft">
                {para}
              </p>
            ))}
          </div>
          <p className="mt-4 text-xs text-stone">
            Scores are based on public profile data{health.verified ? ' and an automated website check' : ''}.
            Checks marked estimated were inferred from profile data and can be verified with a full site review.
          </p>
        </section>

        {/* CTA footer */}
        <section className="mt-8 rounded-2xl bg-forest p-6 text-center sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-lime">
            Report generated with LeadZipp
          </p>
          <h2 className="mt-2 font-display text-xl font-bold text-white sm:text-2xl">
            Find local businesses that need better marketing
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-white/70">
            LeadZipp helps agencies discover, score, and win local businesses with reports like
            this one, generated in seconds.
          </p>
          <Link
            href="/"
            className="mt-5 inline-block rounded-full bg-signal px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-signal-600"
          >
            Explore LeadZipp
          </Link>
        </section>
      </main>
    </div>
  )
}
