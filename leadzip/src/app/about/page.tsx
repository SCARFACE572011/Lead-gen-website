import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Database, Gauge, MapPin, Search } from 'lucide-react'
import { SiteFooter, SiteHeader } from '@/components/marketing/MarketingChrome'
import BreadcrumbSchema from '@/components/seo/BreadcrumbSchema'
import JsonLd from '@/components/seo/JsonLd'
import { SITE_URL } from '@/components/seo/site'

const TITLE = 'About LeadZipp: Local Business Lead Intelligence'
const DESCRIPTION =
  'Learn what LeadZipp is, who it is built for, where its local business data comes from, and how its transparent opportunity scoring works.'
const URL = `${SITE_URL}/about`
const OG = '/og?title=About+LeadZipp&subtitle=Local+business+lead+intelligence,+built+for+Main+Street+sales'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: URL },
  openGraph: {
    title: `${TITLE} | LeadZipp`,
    description: DESCRIPTION,
    url: URL,
    type: 'website',
    images: [{ url: OG, width: 1200, height: 630, alt: 'About LeadZipp' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${TITLE} | LeadZipp`,
    description: DESCRIPTION,
    images: [OG],
  },
}

const aboutSchema = {
  '@context': 'https://schema.org',
  '@type': 'AboutPage',
  '@id': `${URL}#page`,
  url: URL,
  name: TITLE,
  description: DESCRIPTION,
  about: { '@id': `${SITE_URL}/#software` },
  isPartOf: { '@id': `${SITE_URL}/#website` },
  inLanguage: 'en-US',
}

const PRINCIPLES = [
  {
    icon: Database,
    title: 'Current listings over stale databases',
    body: 'LeadZipp searches live business-listing sources when you run a search. It is designed for territory work where a recently opened shop or a newly missing website matters.',
  },
  {
    icon: Gauge,
    title: 'Explainable scores over black boxes',
    body: 'The opportunity score is based on visible signals such as website presence, review footprint, rating, phone availability, proximity, and category match. The full weights are public.',
  },
  {
    icon: MapPin,
    title: 'Geography before job titles',
    body: 'LeadZipp starts with a ZIP code, city, category, and radius. It is for people whose buyers have storefronts, service areas, or local listings rather than corporate org charts.',
  },
]

export default function AboutPage() {
  return (
    <div className="grain relative min-h-screen bg-paper text-ink">
      <SiteHeader />
      <BreadcrumbSchema
        items={[
          { name: 'Home', url: SITE_URL },
          { name: 'About LeadZipp', url: URL },
        ]}
      />
      <JsonLd data={aboutSchema} />

      <main>
        <section className="topo relative overflow-hidden text-white">
          <div className="mx-auto max-w-4xl px-5 py-16 text-center sm:py-22">
            <span className="readout inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-lime ring-1 ring-white/15">
              <span className="h-1.5 w-1.5 rounded-full bg-lime" /> About the product
            </span>
            <h1 className="mt-6 font-display text-[2.5rem] font-extrabold leading-[1.02] tracking-tight sm:text-[3.6rem]">
              What is LeadZipp?
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/80">
              LeadZipp is local business lead-generation software for agencies, freelancers, and sales teams.
              It finds businesses by ZIP code or city, ranks the clearest sales opportunities, and turns the
              results into a list you can call, email, export, or send to your CRM.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-5 py-16 sm:py-22">
          <p className="readout text-signal">The short answer</p>
          <h2 className="mt-3 font-display text-3xl font-extrabold leading-tight">
            A lead finder built for businesses on a map.
          </h2>
          <div className="mt-6 space-y-5 text-[17px] leading-relaxed text-ink-soft">
            <p>
              Most B2B prospecting products begin with a company database, then filter people by title,
              headcount, or industry. LeadZipp begins with a place. You choose an area and a business category;
              LeadZipp returns the local businesses trading there with phone numbers, websites, ratings, review
              counts, and a 0–100 opportunity score.
            </p>
            <p>
              The product is especially useful when you sell websites, local SEO, reputation management,
              advertising, payments, insurance, or another service where public signs of need are visible before
              the first conversation. A missing website or thin review profile is not just data; it is a concrete
              reason to reach out.
            </p>
          </div>
        </section>

        <section className="border-y border-sand bg-paper-2 py-16 sm:py-22">
          <div className="mx-auto max-w-6xl px-5">
            <p className="readout text-signal">How LeadZipp is different</p>
            <h2 className="mt-3 max-w-2xl font-display text-3xl font-extrabold leading-tight">
              Built around three product principles.
            </h2>
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {PRINCIPLES.map((item) => (
                <article key={item.title} className="rounded-2xl border border-sand bg-white p-6">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-forest text-lime">
                    <item.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-5 font-display text-lg font-bold">{item.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{item.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-5 py-16 sm:py-22">
          <p className="readout text-signal">Name and identity</p>
          <h2 className="mt-3 font-display text-3xl font-extrabold leading-tight">LeadZipp, with two p&apos;s.</h2>
          <p className="mt-5 text-[17px] leading-relaxed text-ink-soft">
            LeadZipp is the official product name and <strong className="text-ink">leadzipp.com</strong> is its
            official website. People sometimes search for “LeadZip” or “Lead Zipp”; those spellings refer to the
            same LeadZipp local business leads platform.
          </p>

          <div className="mt-10 rounded-3xl border border-signal/25 bg-signal-50 p-7 sm:p-8">
            <h2 className="font-display text-2xl font-extrabold">See the method, then test the data.</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
              Read every scoring weight or run a free search against live local listings. No credit card is
              required for the free plan.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link href="/lead-scoring-methodology" className="inline-flex items-center justify-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white">
                View the methodology <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/signup" className="inline-flex items-center justify-center gap-2 rounded-full bg-signal px-5 py-2.5 text-sm font-semibold text-white">
                <Search className="h-4 w-4" /> Find leads free
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
