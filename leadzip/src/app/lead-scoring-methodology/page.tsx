import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Calculator, Check, Search } from 'lucide-react'
import { SiteFooter, SiteHeader } from '@/components/marketing/MarketingChrome'
import BreadcrumbSchema from '@/components/seo/BreadcrumbSchema'
import FaqSchema from '@/components/seo/FaqSchema'
import JsonLd from '@/components/seo/JsonLd'
import { SITE_URL } from '@/components/seo/site'

const TITLE = 'Local Business Lead Scoring Methodology'
const DESCRIPTION =
  'See exactly how LeadZipp scores local business leads from 0 to 100 using website, review, rating, reachability, proximity, and category signals.'
const URL = `${SITE_URL}/lead-scoring-methodology`
const OG = '/og?title=Local+business+lead+scoring&subtitle=Every+signal+and+weight,+explained'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: URL },
  openGraph: {
    title: `${TITLE} | LeadZipp`,
    description: DESCRIPTION,
    url: URL,
    type: 'article',
    images: [{ url: OG, width: 1200, height: 630, alt: 'LeadZipp local business lead scoring methodology' }],
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
    question: 'What is a local business lead score?',
    answer:
      'A local business lead score ranks a prospect by how actionable the sales opportunity is. LeadZipp uses a 0–100 scale. Website gaps, a thin review footprint, a fixable rating, phone reachability, proximity, and category relevance can all add points.',
  },
  {
    question: 'Does a high LeadZipp score mean the business is bad?',
    answer:
      'No. It means the business has visible digital gaps that may create a sales opening. A busy contractor with no website can be an excellent business and a high-opportunity lead at the same time.',
  },
  {
    question: 'What is the difference between opportunity score and digital health score?',
    answer:
      'Opportunity score is for the seller: higher means there may be more to fix and a clearer reason to contact the business. Digital health score is for the business owner: higher means the listing, website, and conversion setup are stronger.',
  },
  {
    question: 'Is the scoring model AI-generated or a black box?',
    answer:
      'No. The opportunity score is deterministic. The same input produces the same score, and every point comes from the published rules on this page.',
  },
]

const methodologySchema = {
  '@context': 'https://schema.org',
  '@type': 'TechArticle',
  '@id': `${URL}#article`,
  url: URL,
  headline: TITLE,
  description: DESCRIPTION,
  datePublished: '2026-08-13',
  dateModified: '2026-08-13',
  author: { '@id': `${SITE_URL}/#organization` },
  publisher: { '@id': `${SITE_URL}/#organization` },
  mainEntityOfPage: { '@id': URL },
  about: ['local business leads', 'lead scoring', 'sales prospecting'],
  inLanguage: 'en-US',
}

const REVIEW_ROWS = [
  ['Fewer than 5 reviews', '+20'],
  ['5–14 reviews', '+15'],
  ['15–39 reviews', '+10'],
  ['40–99 reviews', '+5'],
  ['100 or more reviews', '+2'],
]

const RATING_ROWS = [
  ['No rating', '+10'],
  ['Below 2.0', '+5'],
  ['2.0–2.9', '+18'],
  ['3.0–3.79', '+15'],
  ['3.8–4.39', '+8'],
  ['4.4 or higher', '+3'],
]

function ScoreTable({ caption, rows }: { caption: string; rows: string[][] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-sand bg-white">
      <table className="w-full text-left text-sm">
        <caption className="border-b border-sand bg-paper-2 px-5 py-3 text-left font-display text-base font-bold text-ink">
          {caption}
        </caption>
        <tbody className="divide-y divide-sand">
          {rows.map(([signal, points]) => (
            <tr key={signal}>
              <th scope="row" className="px-5 py-3 font-medium text-ink-soft">{signal}</th>
              <td className="px-5 py-3 text-right font-mono font-bold text-signal">{points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function LeadScoringMethodologyPage() {
  return (
    <div className="grain relative min-h-screen bg-paper text-ink">
      <SiteHeader />
      <BreadcrumbSchema
        items={[
          { name: 'Home', url: SITE_URL },
          { name: 'Lead scoring methodology', url: URL },
        ]}
      />
      <FaqSchema items={FAQS} />
      <JsonLd data={methodologySchema} />

      <main id="main-content">
        <section className="topo relative overflow-hidden text-white">
          <div className="mx-auto max-w-4xl px-5 py-16 text-center sm:py-22">
            <span className="readout inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-lime ring-1 ring-white/15">
              <Calculator className="h-3.5 w-3.5" aria-hidden="true" /> Transparent methodology
            </span>
            <h1 className="mt-6 font-display text-[2.45rem] font-extrabold leading-[1.02] tracking-tight sm:text-[3.55rem]">
              How LeadZipp scores local business leads.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/80">
              Every lead gets an explainable 0–100 opportunity score. There is no hidden model: the exact
              signals and weights are published below.
            </p>
            <p className="readout mt-5 text-white/60">Methodology updated August 13, 2026</p>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-5 py-16 sm:py-22">
          <p className="readout text-signal">What the number means</p>
          <h2 className="mt-3 font-display text-3xl font-extrabold leading-tight">
            Digital weakness can be a sales opportunity.
          </h2>
          <div className="mt-6 space-y-5 text-[17px] leading-relaxed text-ink-soft">
            <p>
              Traditional lead scoring often rewards company size or engagement. Local prospecting needs a
              different question: <strong className="text-ink">which business has a visible problem you can
              credibly help solve?</strong> LeadZipp therefore gives more opportunity points to signals such as
              no website, very few reviews, and a middling rating.
            </p>
            <p>
              A high score does not judge the quality of the company. It says the listing shows a clear opening
              for a relevant service provider. A successful plumber with no website may be both a good business
              and an excellent web-design prospect.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {[
              ['80–100', 'Hot lead', 'The clearest visible gaps and a practical way to make contact.'],
              ['50–79', 'Warm lead', 'Several useful signals, but the opening may need more research.'],
              ['0–49', 'Low priority', 'A stronger digital presence or fewer immediately actionable signals.'],
            ].map(([range, label, body]) => (
              <div key={range} className="rounded-2xl border border-sand bg-paper-2 p-5">
                <p className="font-mono text-xl font-bold text-signal">{range}</p>
                <h3 className="mt-2 font-display font-bold">{label}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-y border-sand bg-paper-2 py-16 sm:py-22">
          <div className="mx-auto max-w-5xl px-5">
            <p className="readout text-signal">The exact opportunity-score weights</p>
            <h2 className="mt-3 font-display text-3xl font-extrabold leading-tight">Every point, line by line.</h2>
            <p className="mt-5 max-w-3xl text-[16px] leading-relaxed text-ink-soft">
              Points are added, then the result is capped at 100. Category match and proximity are calculated
              relative to the search the user actually ran.
            </p>

            <div className="mt-10 grid gap-5 md:grid-cols-2">
              <ScoreTable caption="Website and reachability" rows={[
                ['Valid phone number', '+15'],
                ['No website listed', '+35'],
                ['Website listed', '+5'],
                ['Category matches the search', '+10'],
              ]} />
              <ScoreTable caption="Proximity within the search radius" rows={[
                ['Closest 20% of radius', '+12'],
                ['20–40% of radius', '+9'],
                ['40–80% of radius', '+5'],
                ['Outer 20% of radius', '+2'],
              ]} />
              <ScoreTable caption="Review footprint" rows={REVIEW_ROWS} />
              <ScoreTable caption="Rating gap" rows={RATING_ROWS} />
            </div>

            <div className="mt-6 rounded-2xl border border-sand bg-white p-6">
              <h3 className="font-display text-lg font-bold">Why very low ratings do not receive the most points</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
                A rating below 2.0 may indicate a defunct listing, spam, or a business with problems that a
                marketing service cannot solve. The strongest rating opportunity sits between 2.0 and 3.79,
                where the reputation gap is visible but the listing is more likely to be workable.
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-5 py-16 sm:py-22">
          <p className="readout text-signal">Two scores, two audiences</p>
          <h2 className="mt-3 font-display text-3xl font-extrabold leading-tight">
            Opportunity score is not digital health score.
          </h2>
          <p className="mt-5 text-[17px] leading-relaxed text-ink-soft">
            LeadZipp deliberately keeps these measures separate. Opportunity score helps a seller decide whom
            to contact first. Digital health score helps a business owner understand what is working online.
            As one rises, the other often falls.
          </p>

          <div className="mt-8 overflow-hidden rounded-2xl border border-sand bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-forest text-white">
                <tr>
                  <th className="px-5 py-4 font-display text-base">Digital health pillar</th>
                  <th className="px-5 py-4 text-right font-display text-base">Maximum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand">
                {[
                  ['Google Maps profile completeness and reputation', '30 points'],
                  ['Website quality, security, domain, and availability', '35 points'],
                  ['Conversion signals such as contact path, mobile readiness, speed, and analytics', '35 points'],
                ].map(([pillar, points]) => (
                  <tr key={pillar}>
                    <th scope="row" className="px-5 py-4 font-medium leading-relaxed text-ink-soft">{pillar}</th>
                    <td className="px-5 py-4 text-right font-mono font-bold text-signal">{points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-8 rounded-2xl border border-signal/25 bg-signal-50 p-6">
            <h3 className="font-display text-lg font-bold">What the model does not use</h3>
            <ul className="mt-4 space-y-3">
              {[
                'Private financial, demographic, or personal data',
                'Guessed revenue, headcount, or owner identity',
                'Email opens, tracking pixels, or hidden behavioral profiles',
                'A generative-AI judgment that cannot be explained',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-[15px] text-ink-soft">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-signal" aria-hidden="true" /> {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="border-t border-sand bg-paper-2 py-16 sm:py-22">
          <div className="mx-auto max-w-3xl px-5">
            <p className="readout text-signal">Questions</p>
            <h2 className="mt-3 font-display text-3xl font-extrabold leading-tight">Lead scoring FAQ.</h2>
            <div className="mt-10 divide-y divide-sand rounded-3xl border border-sand bg-white">
              {FAQS.map((item) => (
                <details key={item.question} className="group px-6 py-5">
                  <summary className="cursor-pointer list-none font-display text-[17px] font-semibold leading-snug">
                    {item.question}
                  </summary>
                  <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">{item.answer}</p>
                </details>
              ))}
            </div>

            <div className="mt-10 flex flex-col items-center rounded-3xl bg-forest px-6 py-10 text-center text-white sm:px-10">
              <h2 className="font-display text-2xl font-extrabold">Put the model against a real ZIP code.</h2>
              <p className="mt-3 max-w-lg text-white/75">
                Run a live search, sort by opportunity score, and inspect every signal yourself.
              </p>
              <Link href="/signup" className="mt-6 inline-flex items-center gap-2 rounded-full bg-signal px-6 py-3 font-semibold text-white">
                <Search className="h-4 w-4" /> Find local business leads <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
