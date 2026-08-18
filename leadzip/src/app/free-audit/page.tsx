import type { Metadata } from 'next'
import Link from 'next/link'
import { BadgeCheck, Gauge, Globe, MapPin } from 'lucide-react'
import { FreeAuditChecker } from '@/components/marketing/FreeAuditChecker'
import { SiteFooter, SiteHeader } from '@/components/marketing/MarketingChrome'
import BreadcrumbSchema from '@/components/seo/BreadcrumbSchema'
import FaqSchema from '@/components/seo/FaqSchema'
import { SITE_URL } from '@/components/seo/site'

const TITLE = 'Free Local Business Website Audit'
const DESCRIPTION =
  'Check any local business in seconds. A free Digital Health Score covering its Google profile, website quality, and conversion signals. No signup needed.'
const URL = `${SITE_URL}/free-audit`
const OG =
  '/og?title=Free+local+business+website+audit&subtitle=Digital+health+score+in+seconds,+no+signup+needed'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: URL },
  openGraph: {
    title: `${TITLE} | LeadZipp`,
    description: DESCRIPTION,
    url: URL,
    type: 'website',
    images: [{ url: OG, width: 1200, height: 630, alt: 'Free local business website audit from LeadZipp' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${TITLE} | LeadZipp`,
    description: DESCRIPTION,
    images: [OG],
  },
}

const FAQS = [
  {
    question: 'What does the health score measure?',
    answer:
      'Sixteen pass or fail checks across three pillars: Google Maps profile completeness and reputation (30 points), website quality such as a live site, HTTPS, and an own domain (35 points), and conversion signals like mobile friendliness and a clear way to get in touch (35 points). Every point belongs to a named check, so nothing in the score is a black box.',
  },
  {
    question: 'Why is it free with no signup?',
    answer:
      'The checker is how we show what LeadZipp does. You get a real score for one business at a time, and nothing you type here is stored. Creating a free account unlocks whole-territory searches that score every business in the results at once.',
  },
  {
    question: 'How often can I check a business?',
    answer:
      'Three checks per visitor per day. If you need more, a free LeadZipp account includes 25 searches a month with no card required, and each search scores an entire list of businesses in one go.',
  },
]

const PILLARS = [
  {
    icon: MapPin,
    name: 'Google Maps profile',
    points: '30 points',
    blurb: 'Phone, website link, hours, review volume, and rating on the public profile.',
  },
  {
    icon: Globe,
    name: 'Website quality',
    points: '35 points',
    blurb: 'A live site on its own domain with a secure HTTPS connection, verified by a real fetch.',
  },
  {
    icon: Gauge,
    name: 'Conversion signals',
    points: '35 points',
    blurb: 'Mobile friendliness, load speed, analytics, and an obvious way for customers to get in touch.',
  },
]

export default function FreeAuditPage() {
  return (
    <div className="grain relative min-h-screen bg-paper text-ink">
      <SiteHeader />
      <BreadcrumbSchema
        items={[
          { name: 'Home', url: SITE_URL },
          { name: 'Free website audit', url: URL },
        ]}
      />
      <FaqSchema items={FAQS} />

      <main id="main-content">
        {/* HERO */}
        <section className="topo relative overflow-hidden text-white">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:py-22">
            <span className="readout inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-lime ring-1 ring-white/15">
              <BadgeCheck className="h-3.5 w-3.5" /> Free tool · no signup
            </span>
            <h1 className="mt-6 max-w-3xl font-display text-[2.4rem] font-extrabold leading-[1.02] tracking-tight sm:text-[3.4rem]">
              Run a free website audit on any local business.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/75">
              Enter a business and its city or ZIP code. LeadZipp scores its Google profile,
              website, and conversion signals out of 100, with every point explained and a live
              check of the site itself.
            </p>
            <p className="readout mt-6 text-white/60">
              No signup · 3 checks a day · results in seconds
            </p>
          </div>
        </section>

        {/* CHECKER */}
        <section className="mx-auto max-w-3xl px-5 py-12 sm:py-14">
          <FreeAuditChecker />
        </section>

        {/* WHAT IS SCORED */}
        <section className="border-t border-sand bg-paper-2">
          <div className="mx-auto max-w-6xl px-5 py-14">
            <h2 className="font-display text-2xl font-bold sm:text-3xl">What the score covers</h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-soft">
              The same Digital Health Score that powers LeadZipp lead lists and shareable audit
              reports: three pillars, sixteen named checks, zero black box.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {PILLARS.map((pillar) => (
                <div key={pillar.name} className="rounded-2xl border border-sand bg-card p-5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-signal/10 text-signal">
                      <pillar.icon className="h-4 w-4" />
                    </span>
                    <span className="font-mono text-xs font-semibold text-stone">{pillar.points}</span>
                  </div>
                  <h3 className="mt-3 text-sm font-semibold text-ink">{pillar.name}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{pillar.blurb}</p>
                </div>
              ))}
            </div>
            <p className="mt-6 text-sm text-ink-soft">
              Curious how the checks are weighted?{' '}
              <Link href="/lead-scoring-methodology" className="font-semibold text-signal hover:text-signal-600">
                Read the scoring methodology
              </Link>
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section className="mx-auto max-w-3xl px-5 py-14">
          <h2 className="font-display text-2xl font-bold sm:text-3xl">Free audit FAQ</h2>
          <div className="mt-6 space-y-4">
            {FAQS.map((faq) => (
              <div key={faq.question} className="rounded-2xl border border-sand bg-card p-5">
                <h3 className="text-sm font-semibold text-ink">{faq.question}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{faq.answer}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
