import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Globe2, MapPin, Search } from 'lucide-react'
import { SiteHeader, SiteFooter } from '@/components/marketing/MarketingChrome'
import { Reveal } from '@/components/landing/Reveal'
import BreadcrumbSchema from '@/components/seo/BreadcrumbSchema'
import FaqSchema from '@/components/seo/FaqSchema'
import { SITE_URL } from '@/components/seo/site'
import { CATEGORIES, getAllLocationPages, getLocationGroups } from '@/lib/seoPages'

const TITLE = 'Local Business Lead Lists by City and Category'
const DESCRIPTION =
  'Browse every LeadZipp location page. Scored lead lists for 10 local business categories across 12 US metros, plus city pages for the international markets worldwide search now covers.'
const OG = '/og?title=Lead+lists+by+city+and+category&subtitle=Every+LeadZipp+location+page+in+one+place'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/leads` },
  openGraph: {
    title: `${TITLE} | LeadZipp`,
    description: DESCRIPTION,
    url: `${SITE_URL}/leads`,
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
    question: 'What is on each of these location pages?',
    answer:
      'Each page covers one business category in one metro, or one city in an international market. It explains what that category typically gets wrong online, how the local market is shaped, what a LeadZipp search returns for it, and how to work the resulting list. They are written to be useful before you sign up for anything.',
  },
  {
    question: 'Do I have to use one of these pages to search that area?',
    answer:
      'No. These pages exist so you can see how a market looks before you start. Inside LeadZipp you can search any ZIP code in the United States, or any city and country worldwide, whether or not a page exists for it here.',
  },
  {
    question: 'How much does it cost to run these searches?',
    answer:
      'The free plan includes 25 new live territory searches. Pro includes 100 live searches and 100 business-email credits per billing period, and it starts with a 7-day free trial. Cached reruns and filter refinements are free. A card is required for the trial, and nothing is charged if you cancel before day 7.',
  },
]

export default function LeadsIndex() {
  const { us, intl } = getLocationGroups()
  const total = getAllLocationPages().length

  return (
    <div className="grain relative min-h-screen bg-paper text-ink">
      <SiteHeader />

      <BreadcrumbSchema
        items={[
          { name: 'Home', url: SITE_URL },
          { name: 'Lead lists by location', url: `${SITE_URL}/leads` },
        ]}
      />
      <FaqSchema items={FAQS} />

      <main>
      {/* HERO */}
      <section className="topo relative overflow-hidden text-white">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:py-22">
          <span className="readout inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-lime ring-1 ring-white/15">
            <span className="h-1.5 w-1.5 rounded-full bg-lime" /> {total} location guides
          </span>
          <h1 className="mt-6 max-w-3xl font-display text-[2.4rem] font-extrabold leading-[1.02] tracking-tight sm:text-[3.4rem]">
            Lead lists by city and category.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/75">
            Pick a metro and a trade and see exactly what that market looks like: the gaps you will find,
            who picks up the phone, and what a scored list of those businesses actually contains.
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
          <p className="readout mt-4 text-white/60">
            Free plan: 25 searches / month · Trial needs a card · Cancel before day 7, no charge
          </p>
        </div>
      </section>

      {/* CATEGORY STRIP */}
      <section className="border-y border-sand bg-paper-2 py-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-5">
          <span className="readout flex-shrink-0 text-stone">Categories covered</span>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <span
                key={c.slug}
                className="rounded-full border border-sand bg-paper px-3.5 py-1.5 font-mono text-[13px] text-ink-soft"
              >
                {c.name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* US METROS */}
      <section className="mx-auto max-w-6xl px-5 py-18 sm:py-24">
        <Reveal className="max-w-2xl">
          <span className="readout text-signal">United States</span>
          <h2 className="mt-3 font-display text-3xl font-extrabold leading-tight sm:text-[2.4rem]">
            Every category, in twelve metros.
          </h2>
          <p className="mt-5 text-[17px] leading-relaxed text-ink-soft">
            Each metro page set covers the same ten categories, written for that market. Pick the city you
            work and start with the trade you already know how to sell.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {us.map((group, gi) => (
            <Reveal key={group.key} delay={(gi % 3) * 0.06}>
              <div className="flex h-full flex-col rounded-3xl border border-sand bg-white p-6 card-lift">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-signal-50">
                    <MapPin className="h-4 w-4 text-signal" />
                  </span>
                  <div>
                    <h3 className="font-display text-lg font-extrabold leading-none">{group.label}</h3>
                    <p className="readout mt-1 text-stone">{group.sub}</p>
                  </div>
                </div>
                <ul className="mt-5 flex-1 space-y-1.5">
                  {group.pages.map((p) => (
                    <li key={p.slug}>
                      <Link
                        href={p.path}
                        className="group flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-[14.5px] text-ink-soft transition-colors hover:bg-paper-2 hover:text-signal-600"
                      >
                        <span className="font-medium">{p.linkLabel}</span>
                        <ArrowRight className="h-3.5 w-3.5 flex-shrink-0 text-sand transition-all group-hover:translate-x-0.5 group-hover:text-signal" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* INTERNATIONAL */}
      <section className="map-grid border-y border-sand bg-paper-2 py-18 sm:py-24">
        <div className="mx-auto max-w-6xl px-5">
          <Reveal className="max-w-2xl">
            <span className="readout text-signal">Worldwide</span>
            <h2 className="mt-3 font-display text-3xl font-extrabold leading-tight sm:text-[2.4rem]">
              Search runs outside the US now.
            </h2>
            <p className="mt-5 text-[17px] leading-relaxed text-ink-soft">
              Set a city, pick a country, choose a radius, and you get the same live listings and the same
              opportunity scoring you would get from a ZIP code search. These pages cover the markets
              agencies ask about most.
            </p>
          </Reveal>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {intl.map((group) =>
              group.pages.map((p) => (
                <Link
                  key={p.slug}
                  href={p.path}
                  className="group flex items-center justify-between gap-4 rounded-2xl border border-sand bg-white px-5 py-4 transition-colors hover:border-signal/50"
                >
                  <span className="flex items-center gap-3">
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-forest text-lime transition-colors group-hover:bg-signal group-hover:text-white">
                      <Globe2 className="h-4 w-4" />
                    </span>
                    <span>
                      <span className="block font-display text-[15px] font-bold transition-colors group-hover:text-signal-600">
                        {p.linkLabel.split(',')[0]}
                      </span>
                      <span className="readout text-stone">{group.label}</span>
                    </span>
                  </span>
                  <ArrowRight className="h-4 w-4 flex-shrink-0 text-stone transition-transform group-hover:translate-x-0.5 group-hover:text-signal" />
                </Link>
              ))
            )}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-5 py-18 sm:py-24">
        <span className="readout text-signal">Questions</span>
        <h2 className="mt-3 font-display text-3xl font-extrabold leading-tight sm:text-[2.4rem]">
          Before you pick a city.
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
            Pick a city. Pull the list. Start calling.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-[17px] leading-relaxed text-white/90">
            Free covers 25 new live territory searches. Pro includes 100 live searches, 100 business-email
            credits, bulk ZIP search, and full exports on a 7-day trial. Cached reruns stay free. A card is
            required for the trial, and cancelling before day 7 means no charge.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 font-semibold text-signal transition-transform hover:scale-[1.03] active:scale-95"
            >
              <Search className="h-4 w-4" /> Start free
            </Link>
            <Link
              href="/compare"
              className="inline-flex items-center gap-2 rounded-full border border-white/40 px-7 py-3.5 font-semibold text-white transition-colors hover:bg-white/10"
            >
              Compare the alternatives
            </Link>
          </div>
        </div>
      </section>
      </main>

      <SiteFooter />
    </div>
  )
}
