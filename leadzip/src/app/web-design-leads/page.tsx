import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ArrowRight,
  BarChart3,
  Check,
  CircleAlert,
  Download,
  Globe2,
  MapPin,
  Search,
  Target,
} from 'lucide-react'
import { SiteFooter, SiteHeader } from '@/components/marketing/MarketingChrome'
import BreadcrumbSchema from '@/components/seo/BreadcrumbSchema'
import FaqSchema from '@/components/seo/FaqSchema'
import JsonLd from '@/components/seo/JsonLd'
import { SITE_URL } from '@/components/seo/site'

const TITLE = 'Web Design Leads: Find Local Businesses That Need a Website'
const DESCRIPTION =
  'Find web design leads by ZIP code, city, category, and radius. Prioritize local businesses with no website or visible digital gaps, then save and export a focused prospect list.'
const URL = `${SITE_URL}/web-design-leads`
const OG = '/og?title=Find+web+design+leads&subtitle=Local+businesses+with+visible+reasons+to+need+a+better+website'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    'web design leads',
    'leads for web designers',
    'website design leads',
    'find businesses that need a website',
    'local web design prospects',
    'web development leads',
  ],
  alternates: { canonical: URL },
  openGraph: {
    title: `${TITLE} | LeadZipp`,
    description: DESCRIPTION,
    url: URL,
    type: 'website',
    images: [{ url: OG, width: 1200, height: 630, alt: 'Find local web design leads with LeadZipp' }],
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
    question: 'How do I find businesses that need a website?',
    answer:
      'Choose a ZIP code or city and a business category, then filter for businesses with no website. LeadZipp also surfaces other public signals such as weak reviews, incomplete contact details, and website-health gaps so you can prioritize a smaller, more relevant list.',
  },
  {
    question: 'Are these exclusive web design leads?',
    answer:
      'No. The results come from public business listings and are not sold as exclusive inquiries. LeadZipp helps you find and rank local businesses that may have a visible need; it does not claim that a business has requested a proposal or is ready to buy.',
  },
  {
    question: 'What contact details can a web designer get?',
    answer:
      'Search results can include the public business name, address, phone, website, rating, review count, and opportunity score. Paid plans add email finding for businesses with a domain plus CSV, PDF, and CRM export options.',
  },
  {
    question: 'What should I say to a web design prospect?',
    answer:
      'Lead with one specific, verifiable issue rather than a generic redesign pitch. Mention the missing website, hard-to-use mobile experience, unclear call to action, or another visible gap, explain the practical consequence, and ask a small permission-based question.',
  },
  {
    question: 'Can LeadZipp build my first territory with me?',
    answer:
      'Yes. The Build My First Territory request lets you share your market, target business type, and service. A real person reviews the request and replies with a focused next step. No purchase is required to ask.',
  },
]

const pageSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  '@id': `${URL}#page`,
  url: URL,
  name: TITLE,
  description: DESCRIPTION,
  isPartOf: { '@id': `${SITE_URL}/#website` },
  about: [
    { '@type': 'Thing', name: 'Web design leads' },
    { '@type': 'Thing', name: 'Local business prospecting' },
  ],
  mainEntity: { '@id': `${SITE_URL}/#software` },
  inLanguage: 'en-US',
}

const SIGNALS = [
  {
    icon: Globe2,
    title: 'No website listed',
    body: 'The clearest place to start: a trading local business with no website attached to its public listing.',
  },
  {
    icon: CircleAlert,
    title: 'Visible site-health gaps',
    body: 'Check reachable sites for practical issues such as mobile readiness, speed, conversion paths, and basic analytics signals.',
  },
  {
    icon: BarChart3,
    title: 'Thin review footprint',
    body: 'Low review volume can reveal a broader digital-marketing gap and give your outreach a more useful business angle.',
  },
  {
    icon: MapPin,
    title: 'Right market and distance',
    body: 'Work one geography at a time so your examples, referrals, and market knowledge get stronger with every conversation.',
  },
]

const WORKFLOW = [
  {
    number: '01',
    title: 'Choose a sellable patch',
    body: 'Start with one ZIP code, neighborhood, or tightly defined city radius and one business category.',
  },
  {
    number: '02',
    title: 'Rank visible need',
    body: 'Put no-website and high-opportunity businesses first instead of working an alphabetical directory.',
  },
  {
    number: '03',
    title: 'Verify before contact',
    body: 'Open the listing or site, confirm the gap still exists, and write down the one detail you will reference.',
  },
  {
    number: '04',
    title: 'Save, export, and follow up',
    body: 'Keep the qualified prospects, export the same results you already found, and track the next action in one place.',
  },
]

export default function WebDesignLeadsPage() {
  return (
    <div className="grain relative min-h-screen bg-paper text-ink">
      <SiteHeader />
      <BreadcrumbSchema
        items={[
          { name: 'Home', url: SITE_URL },
          { name: 'Web design leads', url: URL },
        ]}
      />
      <FaqSchema items={FAQS} />
      <JsonLd data={pageSchema} />

      <main>
        <section className="topo relative overflow-hidden text-white">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 sm:py-24 lg:grid-cols-[1.02fr_0.98fr]">
            <div>
              <span className="readout inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-lime ring-1 ring-white/15">
                <span className="h-1.5 w-1.5 rounded-full bg-lime" /> Web design lead generation
              </span>
              <h1 className="mt-6 max-w-3xl font-display text-[2.65rem] font-extrabold leading-[0.99] tracking-tight sm:text-[4rem]">
                Find web design leads with a visible reason to buy.
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/78">
                Search local businesses by ZIP code, city, category, and radius. Put businesses with no website or
                clear digital gaps at the top—then verify, save, and work a focused list.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/signup"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-signal px-6 py-3 font-semibold text-white transition-colors hover:bg-signal-600"
                >
                  Find web design leads free <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link
                  href="/first-territory"
                  className="inline-flex items-center justify-center rounded-full border border-white/25 px-6 py-3 font-semibold text-white transition-colors hover:bg-white/10"
                >
                  Build my first territory
                </Link>
              </div>
              <p className="readout mt-4 text-white/60">Free plan available · Public business data · No fake “ready to buy” claims</p>
            </div>

            <div className="rounded-3xl border border-white/15 bg-white/[0.07] p-4 shadow-2xl backdrop-blur-sm sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
                <div>
                  <p className="readout text-lime">Example prioritization</p>
                  <p className="mt-1 text-sm text-white/60">Illustrative businesses—not live records</p>
                </div>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/70">Web design · Sample patch</span>
              </div>
              <div className="mt-4 space-y-3">
                {[
                  { name: 'Northstar Roof Care', gap: 'No website listed', score: 94, action: 'Call' },
                  { name: 'Juniper Home Electric', gap: 'Mobile conversion gaps', score: 86, action: 'Email' },
                  { name: 'Oakline Family Dental', gap: 'Thin review footprint', score: 78, action: 'Audit' },
                ].map((lead, index) => (
                  <div key={lead.name} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-2xl bg-white p-3.5 text-ink">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-paper-2 font-mono text-xs font-bold text-stone">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-display text-sm font-bold">{lead.name}</p>
                      <p className="mt-0.5 truncate text-xs text-stone">{lead.gap} · First action: {lead.action}</p>
                    </div>
                    <span className="rounded-lg bg-signal-50 px-2 py-1 font-mono text-xs font-bold text-signal">{lead.score}</span>
                  </div>
                ))}
              </div>
              <Link href="/sample-territory" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-lime hover:underline">
                Open the full sample territory <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        <section className="border-b border-sand bg-paper-2 py-7">
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-5 sm:flex-row sm:items-center">
            <div>
              <p className="font-display text-lg font-bold">Need a prospecting script and tracker too?</p>
              <p className="mt-1 text-sm text-ink-soft">Use the free web-design outreach kit after you build the list.</p>
            </div>
            <Link
              href="/resources/web-design-outreach-kit"
              className="inline-flex shrink-0 items-center gap-2 rounded-full border border-sand bg-white px-5 py-2.5 text-sm font-semibold text-ink hover:border-signal"
            >
              <Download className="h-4 w-4 text-signal" aria-hidden="true" /> Get the free kit
            </Link>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-18 sm:py-24">
          <div className="max-w-3xl">
            <p className="readout text-signal">Intent, not just contact data</p>
            <h2 className="mt-3 font-display text-3xl font-extrabold leading-tight sm:text-[2.65rem]">
              A better web design lead starts with evidence.
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-ink-soft">
              A directory tells you a business exists. A useful prospect list tells you why the business may be
              worth contacting. LeadZipp ranks public signals so you can spend your time verifying and pitching the
              prospects with the clearest fit—not claiming that strangers are inbound leads.
            </p>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {SIGNALS.map((signal) => (
              <article key={signal.title} className="rounded-2xl border border-sand bg-white p-6">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-forest text-lime">
                  <signal.icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="mt-5 font-display text-lg font-bold">{signal.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{signal.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-y border-sand bg-paper-2 py-18 sm:py-24">
          <div className="mx-auto max-w-6xl px-5">
            <p className="readout text-signal">The workflow</p>
            <h2 className="mt-3 max-w-2xl font-display text-3xl font-extrabold leading-tight sm:text-[2.65rem]">
              Turn one territory into this week&apos;s outreach.
            </h2>
            <ol className="mt-12 grid gap-px overflow-hidden rounded-3xl border border-sand bg-sand md:grid-cols-4">
              {WORKFLOW.map((step) => (
                <li key={step.number} className="bg-white p-6 sm:p-7">
                  <span className="font-mono text-sm font-bold text-signal">{step.number}</span>
                  <h3 className="mt-5 font-display text-lg font-bold">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-soft">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-12 px-5 py-18 sm:py-24 lg:grid-cols-2">
          <div>
            <p className="readout text-signal">What comes with each result</p>
            <h2 className="mt-3 font-display text-3xl font-extrabold leading-tight">
              Enough context to decide before you enrich.
            </h2>
            <p className="mt-5 text-[17px] leading-relaxed text-ink-soft">
              Start with listing data and scoring. Use paid enrichment or exports only after a prospect clears your
              basic fit check, so you are not spending time or tools on every row.
            </p>
            <ul className="mt-7 grid gap-3 sm:grid-cols-2">
              {[
                'Business name and category',
                'Public phone and address',
                'Website presence',
                'Rating and review count',
                'Opportunity score',
                'Save and qualification workflow',
                'Email finder on paid plans',
                'CSV, PDF, and CRM exports on paid plans',
              ].map((item) => (
                <li key={item} className="flex gap-2.5 text-sm text-ink-soft">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-signal" aria-hidden="true" /> {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-3xl bg-forest p-7 text-white sm:p-9">
            <Target className="h-7 w-7 text-lime" aria-hidden="true" />
            <p className="readout mt-6 text-lime">Founder-assisted first run</p>
            <h2 className="mt-3 font-display text-3xl font-extrabold">Not sure which market to start with?</h2>
            <p className="mt-4 leading-relaxed text-white/75">
              Share your target location, business type, and service. We will help narrow the request into a first
              territory you can realistically work, and reply with the next step.
            </p>
            <Link
              href="/first-territory"
              className="mt-7 inline-flex items-center gap-2 rounded-full bg-signal px-6 py-3 font-semibold text-white hover:bg-signal-600"
            >
              Build my first territory <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <p className="readout mt-4 text-white/60">No purchase required · One focused request</p>
          </div>
        </section>

        <section className="border-t border-sand bg-paper-2 py-18 sm:py-24">
          <div className="mx-auto max-w-3xl px-5">
            <p className="readout text-signal">Questions</p>
            <h2 className="mt-3 font-display text-3xl font-extrabold leading-tight">Web design lead generation, plainly answered.</h2>
            <div className="mt-10 divide-y divide-sand overflow-hidden rounded-3xl border border-sand bg-white">
              {FAQS.map((faq) => (
                <article key={faq.question} className="p-6 sm:p-7">
                  <h3 className="font-display text-lg font-bold">{faq.question}</h3>
                  <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">{faq.answer}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="topo text-white">
          <div className="mx-auto max-w-4xl px-5 py-16 text-center sm:py-20">
            <Search className="mx-auto h-7 w-7 text-lime" aria-hidden="true" />
            <h2 className="mt-5 font-display text-3xl font-extrabold sm:text-4xl">Your next web design prospect may be one ZIP away.</h2>
            <p className="mx-auto mt-4 max-w-2xl leading-relaxed text-white/70">
              Run a free search yourself, preview the sample territory, or ask for help shaping the first one.
            </p>
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/signup" className="inline-flex items-center justify-center gap-2 rounded-full bg-signal px-6 py-3 font-semibold text-white">
                Start free <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link href="/sample-territory" className="inline-flex items-center justify-center rounded-full border border-white/25 px-6 py-3 font-semibold text-white hover:bg-white/10">
                View sample territory
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
