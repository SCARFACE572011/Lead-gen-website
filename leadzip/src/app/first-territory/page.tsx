import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Check, MapPin, Search, Target } from 'lucide-react'
import { FirstTerritoryForm } from '@/components/marketing/FirstTerritoryForm'
import { SiteFooter, SiteHeader } from '@/components/marketing/MarketingChrome'
import BreadcrumbSchema from '@/components/seo/BreadcrumbSchema'
import JsonLd from '@/components/seo/JsonLd'
import { SITE_URL } from '@/components/seo/site'

const TITLE = 'Build My First Sales Territory'
const DESCRIPTION =
  'Tell LeadZipp where and what you sell. We will help you shape a focused first territory, prioritize the most useful local-business prospects, and choose a practical outreach angle.'
const URL = `${SITE_URL}/first-territory`
const OG = '/og?title=Build+my+first+sales+territory&subtitle=A+focused+local+prospecting+plan,+reviewed+by+a+real+person'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: URL },
  openGraph: {
    title: `${TITLE} | LeadZipp`,
    description: DESCRIPTION,
    url: URL,
    type: 'website',
    images: [{ url: OG, width: 1200, height: 630, alt: 'Build a first sales territory with LeadZipp' }],
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
  '@type': 'ContactPage',
  '@id': `${URL}#page`,
  url: URL,
  name: TITLE,
  description: DESCRIPTION,
  isPartOf: { '@id': `${SITE_URL}/#website` },
  about: { '@id': `${SITE_URL}/#software` },
  inLanguage: 'en-US',
}

const DELIVERABLES = [
  'A tight geography instead of an unworkable whole-city list',
  'A business category matched to the service you sell',
  'Visible buying signals to use in the first conversation',
  'A short first batch you can actually work this week',
]

export default function FirstTerritoryPage() {
  return (
    <div className="grain relative min-h-screen bg-paper text-ink">
      <SiteHeader />
      <BreadcrumbSchema
        items={[
          { name: 'Home', url: SITE_URL },
          { name: 'Build my first territory', url: URL },
        ]}
      />
      <JsonLd data={pageSchema} />

      <main>
        <section className="topo relative overflow-hidden text-white">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 sm:py-22 lg:grid-cols-[1fr_0.9fr]">
            <div>
              <span className="readout inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-lime ring-1 ring-white/15">
                <span className="h-1.5 w-1.5 rounded-full bg-lime" /> Founder-led setup
              </span>
              <h1 className="mt-6 max-w-3xl font-display text-[2.55rem] font-extrabold leading-[1.01] tracking-tight sm:text-[3.8rem]">
                Build a first territory you can finish—not another giant list.
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/78">
                Tell us where you sell, who you want to reach, and what you offer. We will review the request and
                help you narrow it into a useful first batch of local prospects with a reason to contact each one.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  href="#request"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-signal px-6 py-3 font-semibold text-white transition-colors hover:bg-signal-600"
                >
                  Start my request <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </a>
                <Link
                  href="/sample-territory"
                  className="inline-flex items-center justify-center rounded-full border border-white/25 px-6 py-3 font-semibold text-white transition-colors hover:bg-white/10"
                >
                  Preview the sample
                </Link>
              </div>
              <p className="readout mt-4 text-white/45">No purchase required · Human-reviewed · One focused market</p>
            </div>

            <div className="rounded-3xl border border-white/15 bg-white/[0.07] p-6 backdrop-blur-sm sm:p-8">
              <p className="readout text-lime">What we help define</p>
              <ul className="mt-5 space-y-4">
                {DELIVERABLES.map((item) => (
                  <li key={item} className="flex gap-3 text-[15px] leading-relaxed text-white/85">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-lime text-forest">
                      <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="border-b border-sand bg-paper-2 py-8">
          <div className="mx-auto grid max-w-6xl gap-6 px-5 sm:grid-cols-3">
            {[
              { icon: MapPin, label: '01 · Pick the patch', text: 'One ZIP, neighborhood, or tightly defined city segment.' },
              { icon: Target, label: '02 · Define the buyer', text: 'One business type whose visible gaps match your offer.' },
              { icon: Search, label: '03 · Work the batch', text: 'Prioritize a manageable list and contact the best fits first.' },
            ].map((item) => (
              <div key={item.label} className="flex gap-3">
                <item.icon className="mt-0.5 h-5 w-5 shrink-0 text-signal" aria-hidden="true" />
                <div>
                  <p className="readout text-ink">{item.label}</p>
                  <p className="mt-1 text-sm leading-relaxed text-ink-soft">{item.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="request" className="mx-auto grid max-w-6xl gap-12 px-5 py-16 sm:py-22 lg:grid-cols-[0.72fr_1fr]">
          <div className="lg:pt-5">
            <p className="readout text-signal">The request</p>
            <h2 className="mt-3 font-display text-3xl font-extrabold leading-tight sm:text-[2.5rem]">
              Give us enough context to make the territory useful.
            </h2>
            <p className="mt-5 text-[17px] leading-relaxed text-ink-soft">
              This is for a focused first pass, not a promise that every business will buy. Public listing signals
              help reveal need; your offer, proof, timing, and outreach still decide the result.
            </p>
            <div className="mt-8 rounded-2xl border border-sand bg-white p-5">
              <p className="font-display font-bold">Want to do it yourself?</p>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                Create a free account and run the territory directly, or read the sample report before you choose.
              </p>
              <div className="mt-4 flex flex-wrap gap-4 text-sm font-semibold">
                <Link href="/signup" className="text-signal hover:underline">Start free</Link>
                <Link href="/sample-territory" className="text-ink hover:underline">View sample</Link>
              </div>
            </div>
          </div>
          <FirstTerritoryForm />
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
