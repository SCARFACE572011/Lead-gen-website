import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Info, Search } from 'lucide-react'
import { SiteHeader, SiteFooter } from '@/components/marketing/MarketingChrome'
import { Reveal } from '@/components/landing/Reveal'
import BreadcrumbSchema from '@/components/seo/BreadcrumbSchema'
import FaqSchema from '@/components/seo/FaqSchema'
import { SITE_URL } from '@/components/seo/site'
import { COMPARISONS, COMPARISON_DISCLAIMER } from '@/lib/comparePages'

const TITLE = 'Compare LeadZipp with Other Prospecting Tools'
const DESCRIPTION =
  'Honest comparisons between LeadZipp and Apollo, Hunter.io, ZoomInfo and B2B Lead Finder. Written around use case fit rather than invented feature checkmarks.'
const OG = '/og?title=Compare+LeadZipp&subtitle=Honest+comparisons,+no+invented+checkmarks'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/compare` },
  openGraph: {
    title: `${TITLE} | LeadZipp`,
    description: DESCRIPTION,
    url: `${SITE_URL}/compare`,
    type: 'website',
    images: [{ url: OG, width: 1200, height: 630, alt: TITLE }],
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
    question: 'How are these comparisons written?',
    answer:
      'Every statement about another company is drawn from what that company publicly advertises about itself, checked against their own live marketing site. We do not publish competitor prices we have not verified, we do not assert that a competitor lacks a feature unless they say so themselves, and anything uncertain is left out rather than guessed at.',
  },
  {
    question: 'Why is there no feature checklist with scores?',
    answer:
      'Because scored matrices on vendor sites are almost always written to make the vendor win. These pages compare use case fit instead. Each one names the kind of work the other tool is built for, the kind LeadZipp is built for, and where the two genuinely overlap, so you can match it against your own situation.',
  },
  {
    question: 'What is LeadZipp actually for?',
    answer:
      'Finding local businesses that need what you sell. You search a ZIP code, or a city and country anywhere in the world, pick a category and a radius, and get back real businesses scored on signals like having no website, few reviews or a weak rating. It is built for agencies and freelancers selling websites, SEO, ads and marketing to local businesses.',
  },
  {
    question: 'Can I try it before paying?',
    answer:
      'Yes. The free plan includes 25 searches a month against live data. Paid plans start with a 7-day free trial, which requires a card and charges nothing if you cancel before day 7.',
  },
]

export default function CompareIndex() {
  return (
    <div className="grain relative min-h-screen bg-paper text-ink">
      <SiteHeader />

      <BreadcrumbSchema
        items={[
          { name: 'Home', url: SITE_URL },
          { name: 'Compare', url: `${SITE_URL}/compare` },
        ]}
      />
      <FaqSchema items={FAQS} />

      {/* HERO */}
      <section className="topo relative overflow-hidden text-white">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:py-22">
          <span className="readout inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-lime ring-1 ring-white/15">
            <span className="h-1.5 w-1.5 rounded-full bg-lime" /> {COMPARISONS.length} comparisons
          </span>
          <h1 className="mt-6 max-w-3xl font-display text-[2.4rem] font-extrabold leading-[1.02] tracking-tight sm:text-[3.4rem]">
            How LeadZipp compares.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/75">
            Most of the tools people put next to LeadZipp are solving a different problem. These pages say
            which problem each one solves, where the overlap is real, and when you should pick the other tool.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-signal px-6 py-3 font-semibold text-white transition-all hover:bg-signal-600 active:scale-95"
            >
              <Search className="h-4 w-4" /> Start your 7-day free trial
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/30 px-6 py-3 font-semibold text-white transition-colors hover:bg-white/10"
            >
              See pricing
            </Link>
          </div>
          <p className="readout mt-4 text-white/45">
            Free plan: 25 searches / month · Trial needs a card · Cancel before day 7, no charge
          </p>
        </div>
      </section>

      {/* COMPARISON CARDS */}
      <section className="mx-auto max-w-6xl px-5 py-18 sm:py-24">
        <div className="grid gap-6 md:grid-cols-2">
          {COMPARISONS.map((c, i) => (
            <Reveal key={c.slug} delay={(i % 2) * 0.08}>
              <Link
                href={`/compare/${c.slug}`}
                className="group flex h-full flex-col rounded-3xl border border-sand bg-white p-7 card-lift"
              >
                <span className="readout text-signal">LeadZipp vs</span>
                <h2 className="mt-2 font-display text-2xl font-extrabold leading-tight transition-colors group-hover:text-signal-600">
                  {c.competitor}
                </h2>
                <p className="mt-3 flex-1 text-[15px] leading-relaxed text-ink-soft">{c.summary}</p>
                <p className="mt-5 rounded-xl border border-sand bg-paper-2 px-4 py-3 text-[14px] font-medium leading-relaxed text-ink">
                  {c.verdict}
                </p>
                <span className="mt-5 inline-flex items-center gap-2 font-semibold text-signal">
                  Read the comparison
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            </Reveal>
          ))}
        </div>

        <div className="mt-8 flex items-start gap-2.5 text-[13.5px] text-stone">
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <p>{COMPARISON_DISCLAIMER}</p>
        </div>
      </section>

      {/* HOW WE WRITE THESE */}
      <section className="map-grid border-y border-sand bg-paper-2 py-18 sm:py-24">
        <div className="mx-auto max-w-6xl px-5">
          <Reveal className="max-w-2xl">
            <span className="readout text-signal">The ground rules</span>
            <h2 className="mt-3 font-display text-3xl font-extrabold leading-tight sm:text-[2.4rem]">
              How these comparisons are written.
            </h2>
          </Reveal>
          <div className="mt-12 grid gap-5 sm:grid-cols-3">
            {[
              {
                t: 'Only public claims',
                b: 'Everything said about another product comes from what that company advertises about itself on its own site, checked rather than remembered.',
              },
              {
                t: 'No invented pricing',
                b: 'Where a competitor publishes prices we say so and send you to their page. Where they sell through a sales team we say that and stop. No figures we cannot stand behind.',
              },
              {
                t: 'No fake checkmarks',
                b: 'We never assert that another tool is missing something unless they say so. Comparisons are framed around what each product is built to do.',
              },
            ].map((item) => (
              <div key={item.t} className="rounded-2xl border border-sand bg-white p-6">
                <h3 className="font-display text-lg font-bold">{item.t}</h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-ink-soft">{item.b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-5 py-18 sm:py-24">
        <span className="readout text-signal">Questions</span>
        <h2 className="mt-3 font-display text-3xl font-extrabold leading-tight sm:text-[2.4rem]">
          Before you compare.
        </h2>
        <div className="mt-10 divide-y divide-sand rounded-3xl border border-sand bg-white">
          {FAQS.map((f) => (
            <details key={f.question} className="group px-6 py-5 [&_svg]:open:rotate-45">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                <span className="font-display text-[17px] font-semibold leading-snug">{f.question}</span>
                <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-signal-50 text-signal transition-transform">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </span>
              </summary>
              <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">{f.answer}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden bg-signal py-18 text-white sm:py-24">
        <div className="grain absolute inset-0 opacity-40" />
        <div className="relative mx-auto max-w-3xl px-5 text-center">
          <h2 className="font-display text-3xl font-extrabold leading-[1.05] sm:text-[2.9rem]">
            The fastest comparison is a search.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-[17px] leading-relaxed text-white/85">
            Pick a category and an area you already know, run it, and see whether the list is one you would
            work. The free plan covers 25 searches a month, and the 7-day trial on Pro requires a card but
            charges nothing if you cancel before day 7.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 font-semibold text-signal transition-transform hover:scale-[1.03] active:scale-95"
            >
              <Search className="h-4 w-4" /> Start free
            </Link>
            <Link
              href="/leads"
              className="inline-flex items-center gap-2 rounded-full border border-white/40 px-7 py-3.5 font-semibold text-white transition-colors hover:bg-white/10"
            >
              Browse location guides
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  )
}
