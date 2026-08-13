import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, CircleAlert, Download, Phone, Search, Target } from 'lucide-react'
import { SiteFooter, SiteHeader } from '@/components/marketing/MarketingChrome'
import BreadcrumbSchema from '@/components/seo/BreadcrumbSchema'
import JsonLd from '@/components/seo/JsonLd'
import { SITE_URL } from '@/components/seo/site'

const TITLE = 'Sample Local Sales Territory Report'
const DESCRIPTION =
  'Preview how a LeadZipp territory becomes a prioritized outreach plan. See illustrative local-business records, visible opportunity signals, qualification notes, and a practical first-week workflow.'
const URL = `${SITE_URL}/sample-territory`
const OG = '/og?title=Sample+sales+territory&subtitle=From+a+local+search+to+a+focused+first-week+outreach+plan'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: URL },
  openGraph: {
    title: `${TITLE} | LeadZipp`,
    description: DESCRIPTION,
    url: URL,
    type: 'article',
    images: [{ url: OG, width: 1200, height: 630, alt: 'Sample LeadZipp local sales territory report' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${TITLE} | LeadZipp`,
    description: DESCRIPTION,
    images: [OG],
  },
}

const pageSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  '@id': `${URL}#page`,
  url: URL,
  name: TITLE,
  description: DESCRIPTION,
  isPartOf: { '@id': `${SITE_URL}/#website` },
  about: { '@id': `${SITE_URL}/#software` },
  inLanguage: 'en-US',
}

const SAMPLE_LEADS = [
  {
    name: 'Northstar Roof Care',
    category: 'Roofing contractor',
    location: 'South Austin sample area',
    score: 94,
    signal: 'No website listed',
    secondary: '4.7 rating · 18 reviews · Phone listed',
    firstAction: 'Call and ask who handles new-customer inquiries. Lead with the missing website, not a full redesign pitch.',
    priority: 'Call first',
  },
  {
    name: 'Bluebonnet Gutter Works',
    category: 'Gutter service',
    location: 'South Austin sample area',
    score: 89,
    signal: 'No website listed',
    secondary: '4.5 rating · 11 reviews · Phone listed',
    firstAction: 'Verify there is no newer site, then offer a simple quote-request page as the smallest useful project.',
    priority: 'Call first',
  },
  {
    name: 'Juniper Home Electric',
    category: 'Electrician',
    location: 'South Austin sample area',
    score: 86,
    signal: 'Website found; conversion gaps to verify',
    secondary: '4.3 rating · 29 reviews · Public website and phone',
    firstAction: 'Open the site on mobile and confirm the call or quote path before mentioning any issue.',
    priority: 'Audit first',
  },
  {
    name: 'Hill Country Fence Co.',
    category: 'Fence contractor',
    location: 'South Austin sample area',
    score: 81,
    signal: 'Thin review footprint',
    secondary: '4.1 rating · 7 reviews · Website listed',
    firstAction: 'Treat this as a lower-priority combined website/reputation angle after the no-website prospects.',
    priority: 'Email second',
  },
  {
    name: 'Oakline Family Dental',
    category: 'Dentist',
    location: 'South Austin sample area',
    score: 78,
    signal: 'Website found; contact path to verify',
    secondary: '4.6 rating · 42 reviews · Public website and phone',
    firstAction: 'Verify the booking experience. Contact only if a real, specific friction point remains.',
    priority: 'Research',
  },
]

const SCORE_BREAKDOWN = [
  { label: 'No website or meaningful website gap', value: 'Highest-priority signal' },
  { label: 'Public phone and contactability', value: 'Makes a first action possible' },
  { label: 'Review footprint and listing completeness', value: 'Adds context, not certainty' },
  { label: 'Category and geography fit', value: 'Keeps the batch relevant' },
]

export default function SampleTerritoryPage() {
  return (
    <div className="grain relative min-h-screen bg-paper text-ink">
      <SiteHeader />
      <BreadcrumbSchema
        items={[
          { name: 'Home', url: SITE_URL },
          { name: 'Sample territory', url: URL },
        ]}
      />
      <JsonLd data={pageSchema} />

      <main>
        <section className="topo relative overflow-hidden text-white">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:py-22">
            <div className="flex flex-col justify-between gap-8 md:flex-row md:items-end">
              <div className="max-w-3xl">
                <span className="readout inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-lime ring-1 ring-white/15">
                  <span className="h-1.5 w-1.5 rounded-full bg-lime" /> Product workflow preview
                </span>
                <h1 className="mt-6 font-display text-[2.55rem] font-extrabold leading-[1.01] tracking-tight sm:text-[3.8rem]">
                  Sample territory: from search results to Monday&apos;s call list.
                </h1>
                <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/78">
                  This example shows the decisions around a LeadZipp territory: which businesses rise, what to
                  verify, and how to turn the best few into specific outreach instead of blasting the whole list.
                </p>
              </div>
              <Link
                href="/signup"
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-signal px-6 py-3 font-semibold text-white hover:bg-signal-600"
              >
                Search my market <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        <section className="border-b border-amber-200 bg-amber-50 py-4">
          <div className="mx-auto flex max-w-6xl items-start gap-3 px-5 text-sm leading-relaxed text-amber-900">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>
              <strong>Sample-data notice:</strong> every business name and detail on this page is fictional and
              illustrative. This is a workflow demo, not a claim about real companies or current market results.
            </p>
          </div>
        </section>

        <section className="border-b border-sand bg-paper-2 py-8">
          <div className="mx-auto grid max-w-6xl gap-5 px-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Territory', 'South Austin sample area'],
              ['Target', 'Local service businesses'],
              ['Offer', 'Website design'],
              ['First batch', '5 prospects'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-sand bg-white p-4">
                <p className="readout text-stone">{label}</p>
                <p className="mt-2 font-display font-bold">{value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-16 sm:py-22">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <p className="readout text-signal">Prioritized batch</p>
              <h2 className="mt-3 font-display text-3xl font-extrabold leading-tight">Work the reason, not the row.</h2>
              <p className="mt-3 max-w-2xl text-ink-soft">
                Each sample record includes the next qualification step. None is presented as an inbound buyer.
              </p>
            </div>
            <Link href="/lead-scoring-methodology" className="text-sm font-semibold text-signal hover:underline">
              Read the scoring method
            </Link>
          </div>

          <div className="mt-10 overflow-hidden rounded-3xl border border-sand bg-white shadow-card">
            <div className="hidden grid-cols-[52px_1.2fr_0.85fr_96px] gap-4 border-b border-sand bg-paper-2 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-stone md:grid">
              <span>Rank</span><span>Prospect and signal</span><span>First action</span><span>Score</span>
            </div>
            <ol className="divide-y divide-sand">
              {SAMPLE_LEADS.map((lead, index) => (
                <li key={lead.name} className="grid gap-5 p-5 md:grid-cols-[52px_1.2fr_0.85fr_96px] md:items-start">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-paper-2 font-mono text-sm font-bold text-stone">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-lg font-bold">{lead.name}</h3>
                      <span className="rounded-full bg-signal-50 px-2.5 py-1 text-xs font-semibold text-signal">{lead.signal}</span>
                    </div>
                    <p className="mt-1.5 text-sm text-stone">{lead.category} · {lead.location}</p>
                    <p className="mt-2 text-sm text-ink-soft">{lead.secondary}</p>
                  </div>
                  <div>
                    <p className="readout text-stone">{lead.priority}</p>
                    <p className="mt-2 text-sm leading-relaxed text-ink-soft">{lead.firstAction}</p>
                  </div>
                  <span className="inline-flex w-fit items-center rounded-xl bg-forest px-3 py-2 font-mono text-lg font-bold text-lime">
                    {lead.score}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="border-y border-sand bg-paper-2 py-16 sm:py-22">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 lg:grid-cols-2">
            <div>
              <p className="readout text-signal">How to read the score</p>
              <h2 className="mt-3 font-display text-3xl font-extrabold">Prioritization, not purchase intent.</h2>
              <p className="mt-5 text-[17px] leading-relaxed text-ink-soft">
                A high opportunity score says the public signals create a clearer reason to investigate. It does not
                mean the business asked for help, has budget, or will respond. A thirty-second verification step still
                comes before every call or email.
              </p>
              <div className="mt-8 space-y-3">
                {SCORE_BREAKDOWN.map((item) => (
                  <div key={item.label} className="flex items-start justify-between gap-4 rounded-xl border border-sand bg-white px-4 py-3">
                    <span className="text-sm font-semibold text-ink">{item.label}</span>
                    <span className="max-w-[45%] text-right text-sm text-stone">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl bg-forest p-7 text-white sm:p-9">
              <p className="readout text-lime">First-week plan</p>
              <ol className="mt-6 space-y-5">
                {[
                  ['Monday', 'Verify the top five records and note one real gap on each.'],
                  ['Tuesday', 'Call the two no-website businesses with a small, concrete opening question.'],
                  ['Wednesday', 'Audit the two existing sites and contact only where the gap is still real.'],
                  ['Thursday', 'Follow up once with a useful observation, screenshot, or simple recommendation.'],
                  ['Friday', 'Record outcomes, refine the target, and expand only if the first batch is worked.'],
                ].map(([day, action]) => (
                  <li key={day} className="flex gap-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/10 font-mono text-xs font-bold text-lime">
                      {day.slice(0, 1)}
                    </span>
                    <div>
                      <p className="font-display font-bold text-white">{day}</p>
                      <p className="mt-1 text-sm leading-relaxed text-white/70">{action}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-16 sm:py-22">
          <div className="grid gap-5 md:grid-cols-3">
            {[
              { icon: Search, title: 'Run the real search', body: 'Create a free account and use your own ZIP code, city, category, and radius.', href: '/signup', cta: 'Start free' },
              { icon: Target, title: 'Ask for a first territory', body: 'Share what and where you sell. A real person will review your focused request.', href: '/first-territory', cta: 'Build my territory' },
              { icon: Download, title: 'Work the outreach', body: 'Download practical scripts and a simple tracker built for this exact workflow.', href: '/resources/web-design-outreach-kit', cta: 'Get the free kit' },
            ].map((item) => (
              <article key={item.title} className="flex flex-col rounded-2xl border border-sand bg-white p-6">
                <item.icon className="h-6 w-6 text-signal" aria-hidden="true" />
                <h2 className="mt-5 font-display text-xl font-bold">{item.title}</h2>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-soft">{item.body}</p>
                <Link href={item.href} className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-signal hover:underline">
                  {item.cta} <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </article>
            ))}
          </div>

          <div className="mt-12 flex flex-col items-center rounded-3xl border border-sand bg-signal-50 p-8 text-center sm:p-10">
            <Phone className="h-7 w-7 text-signal" aria-hidden="true" />
            <h2 className="mt-4 font-display text-3xl font-extrabold">Keep the first batch small enough to finish.</h2>
            <p className="mt-3 max-w-2xl text-ink-soft">
              Five verified conversations teach you more than five hundred untouched rows. Start with a real market
              when you are ready.
            </p>
            <Link href="/signup" className="mt-6 inline-flex items-center gap-2 rounded-full bg-signal px-6 py-3 font-semibold text-white hover:bg-signal-600">
              Find leads in my territory <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
