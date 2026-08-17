import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ArrowRight, Check, Info, MapPin, Search } from 'lucide-react'
import { SiteHeader, SiteFooter } from '@/components/marketing/MarketingChrome'
import BreadcrumbSchema from '@/components/seo/BreadcrumbSchema'
import FaqSchema from '@/components/seo/FaqSchema'
import { SITE_URL } from '@/components/seo/site'
import {
  COMPARISONS,
  COMPARISON_DISCLAIMER,
  getAllComparisonSlugs,
  getComparison,
} from '@/lib/comparePages'
import { getAllPosts } from '@/lib/blog'

/**
 * Comparison pages. Every competitor claim rendered here comes from
 * src/lib/comparePages.ts, which documents the accuracy rules those claims
 * were written under. The visible disclaimer at the foot of the comparison
 * is required on every page in this family.
 */

export const dynamicParams = false

export function generateStaticParams() {
  return getAllComparisonSlugs().map((slug) => ({ slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const page = getComparison(slug)
  if (!page) return { title: 'Not found', robots: { index: false, follow: false } }

  const url = `${SITE_URL}/compare/${page.slug}`
  const ogImage = `/og?title=${encodeURIComponent(page.ogTitle)}&subtitle=${encodeURIComponent(page.ogSubtitle)}`

  return {
    title: page.metaTitle,
    description: page.metaDescription,
    alternates: { canonical: url },
    openGraph: {
      title: `${page.metaTitle} | LeadZipp`,
      description: page.metaDescription,
      url,
      type: 'website',
      images: [{ url: ogImage, width: 1200, height: 630, alt: page.ogTitle }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${page.metaTitle} | LeadZipp`,
      description: page.metaDescription,
      images: [ogImage],
    },
  }
}

export default async function ComparePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const page = getComparison(slug)
  if (!page) notFound()

  const others = COMPARISONS.filter((c) => c.slug !== page.slug)
  const posts = getAllPosts()
  const related = ['local-lead-generation-guide', 'how-to-get-web-design-clients', 'lead-scoring-explained']
    .map((s) => posts.find((p) => p.slug === s))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))

  return (
    <div className="grain relative min-h-screen bg-paper text-ink">
      <SiteHeader />

      <main>
      <BreadcrumbSchema
        items={[
          { name: 'Home', url: SITE_URL },
          { name: 'Compare', url: `${SITE_URL}/compare` },
          { name: `LeadZipp vs ${page.competitor}`, url: `${SITE_URL}/compare/${page.slug}` },
        ]}
      />
      <FaqSchema items={page.faqs} />

      {/* ================= HERO ================= */}
      <section className="topo relative overflow-hidden text-white">
        <div className="mx-auto max-w-4xl px-5 py-14 text-center sm:py-20">
          <nav aria-label="Breadcrumb" className="readout flex items-center justify-center gap-2 text-white/50">
            <Link href="/compare" className="inline-flex items-center gap-1.5 transition-colors hover:text-lime">
              <ArrowLeft className="h-3 w-3" /> All comparisons
            </Link>
          </nav>

          <h1 className="mt-6 font-display text-[2.3rem] font-extrabold leading-[1.02] tracking-tight sm:text-[3.2rem]">
            {page.h1}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/75">{page.lede}</p>

          <div className="mx-auto mt-9 max-w-2xl rounded-2xl border border-lime/30 bg-lime/[0.08] p-5">
            <p className="readout text-lime">The short answer</p>
            <p className="mt-2 font-display text-lg font-bold leading-snug text-white sm:text-xl">
              {page.verdict}
            </p>
          </div>
        </div>
      </section>

      {/* ================= SIDE BY SIDE PANELS ================= */}
      <section className="border-b border-sand bg-paper py-18 sm:py-24">
        <div className="mx-auto max-w-6xl px-5">
          <div className="grid items-start gap-6 lg:grid-cols-2">
            {/* LeadZipp */}
            <div className="h-full rounded-3xl border border-signal/30 bg-signal-50 p-7 sm:p-8">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-signal">
                  <MapPin className="h-4 w-4 text-white" />
                </span>
                <span className="font-display text-lg font-extrabold">LeadZipp</span>
              </div>
              <h2 className="mt-5 font-display text-2xl font-extrabold leading-tight">
                {page.leadzippPanel.heading}
              </h2>
              <p className="mt-4 text-[15.5px] leading-relaxed text-ink-soft">{page.leadzippPanel.body}</p>
              <ul className="mt-6 space-y-3">
                {page.leadzippPanel.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2.5 text-[14.5px] leading-relaxed">
                    <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-signal" />
                    <span className="text-ink-soft">{b}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Competitor */}
            <div className="h-full rounded-3xl border border-sand bg-white p-7 sm:p-8">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-forest text-lime">
                  <Search className="h-4 w-4" />
                </span>
                <span className="font-display text-lg font-extrabold">{page.competitor}</span>
              </div>
              <h2 className="mt-5 font-display text-2xl font-extrabold leading-tight">
                {page.competitorPanel.heading}
              </h2>
              <p className="mt-4 text-[15.5px] leading-relaxed text-ink-soft">{page.competitorPanel.body}</p>
              <ul className="mt-6 space-y-3">
                {page.competitorPanel.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2.5 text-[14.5px] leading-relaxed">
                    <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-forest" />
                    <span className="text-ink-soft">{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ================= DIFFERENCE TABLE ================= */}
      <section className="map-grid border-b border-sand bg-paper-2 py-18 sm:py-24">
        <div className="mx-auto max-w-6xl px-5">
          <div className="max-w-2xl">
            <span className="readout text-signal">Side by side</span>
            <h2 className="mt-3 font-display text-3xl font-extrabold leading-tight sm:text-[2.4rem]">
              Where the two actually differ
            </h2>
            <p className="mt-5 text-[17px] leading-relaxed text-ink-soft">
              No scored feature matrix and no invented checkmarks. Each row describes what the two products
              are built to do, so you can match it against your own work.
            </p>
          </div>

          <div
            className="mt-12 overflow-x-auto"
            tabIndex={0}
            role="region"
            aria-label={`Feature comparison table: LeadZipp vs ${page.competitor}`}
          >
            <table className="w-full min-w-[720px] border-separate border-spacing-0 overflow-hidden rounded-2xl border border-sand bg-white text-left">
              <thead>
                <tr className="bg-forest text-white">
                  <th scope="col" className="readout px-5 py-4 font-normal text-lime">
                    Dimension
                  </th>
                  <th scope="col" className="px-5 py-4 font-display text-[15px] font-bold">
                    LeadZipp
                  </th>
                  <th scope="col" className="px-5 py-4 font-display text-[15px] font-bold">
                    {page.competitor}
                  </th>
                </tr>
              </thead>
              <tbody>
                {page.rows.map((row, i) => (
                  <tr key={row.dimension} className={i % 2 === 1 ? 'bg-paper-2/60' : ''}>
                    <th
                      scope="row"
                      className="border-t border-sand px-5 py-4 align-top font-display text-[14.5px] font-bold"
                    >
                      {row.dimension}
                    </th>
                    <td className="border-t border-sand px-5 py-4 align-top text-[14.5px] leading-relaxed text-ink-soft">
                      {row.leadzipp}
                    </td>
                    <td className="border-t border-sand px-5 py-4 align-top text-[14.5px] leading-relaxed text-ink-soft">
                      {row.competitor}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex items-start gap-2.5 text-[13.5px] text-stone">
            <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <p>{COMPARISON_DISCLAIMER}</p>
          </div>
        </div>
      </section>

      {/* ================= CHOOSE X IF ================= */}
      <section className="mx-auto max-w-6xl px-5 py-18 sm:py-24">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-sand bg-white p-7 sm:p-8 card-lift">
            <h2 className="font-display text-2xl font-extrabold">{page.chooseCompetitor.heading}</h2>
            <ul className="mt-6 space-y-3">
              {page.chooseCompetitor.items.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-[15px] leading-relaxed">
                  <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-forest" />
                  <span className="text-ink-soft">{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-3xl border border-signal-bright bg-forest p-7 text-white sm:p-8 signal-glow">
            <h2 className="font-display text-2xl font-extrabold text-lime">{page.chooseLeadzipp.heading}</h2>
            <ul className="mt-6 space-y-3">
              {page.chooseLeadzipp.items.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-[15px] leading-relaxed">
                  <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-lime" />
                  <span className="text-white/85">{item}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/signup?plan=pro"
              className="mt-7 inline-flex items-center gap-2 rounded-full bg-signal px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-signal-600 active:scale-95"
            >
              Start your 7-day free trial <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* Overlap */}
        <div className="mt-12 rounded-3xl border border-sand bg-paper-2 p-7 sm:p-8">
          <span className="readout text-signal">Where they overlap</span>
          <p className="mt-3 text-[17px] leading-relaxed text-ink-soft">{page.overlap}</p>
        </div>
      </section>

      {/* ================= FAQ ================= */}
      <section className="border-y border-sand bg-paper-2 py-18 sm:py-24">
        <div className="mx-auto max-w-3xl px-5">
          <span className="readout text-signal">Questions</span>
          <h2 className="mt-3 font-display text-3xl font-extrabold leading-tight sm:text-[2.4rem]">
            LeadZipp and {page.competitorShort}, answered
          </h2>
          <div className="mt-10 divide-y divide-sand rounded-3xl border border-sand bg-white">
            {page.faqs.map((f) => (
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
        </div>
      </section>

      {/* ================= INTERNAL LINKS ================= */}
      <section className="mx-auto max-w-6xl px-5 py-18 sm:py-24">
        <div className="grid gap-10 md:grid-cols-2">
          <div>
            <h2 className="font-display text-xl font-extrabold">Other comparisons</h2>
            <ul className="mt-5 space-y-2.5">
              {others.map((c) => (
                <li key={c.slug}>
                  <Link
                    href={`/compare/${c.slug}`}
                    className="group flex items-center justify-between gap-4 rounded-xl border border-sand bg-white px-5 py-3.5 transition-colors hover:border-signal/50"
                  >
                    <span>
                      <span className="block font-display text-[15px] font-bold transition-colors group-hover:text-signal-600">
                        LeadZipp vs {c.competitor}
                      </span>
                      <span className="readout text-stone">{c.competitorShort}</span>
                    </span>
                    <ArrowRight className="h-4 w-4 flex-shrink-0 text-stone transition-transform group-hover:translate-x-0.5 group-hover:text-signal" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="font-display text-xl font-extrabold">Guides worth reading next</h2>
            <ul className="mt-5 space-y-2.5">
              {related.map((p) => (
                <li key={p.slug}>
                  <Link
                    href={`/blog/${p.slug}`}
                    className="group flex items-center justify-between gap-4 rounded-xl border border-sand bg-white px-5 py-3.5 transition-colors hover:border-signal/50"
                  >
                    <span>
                      <span className="block font-display text-[15px] font-bold leading-snug transition-colors group-hover:text-signal-600">
                        {p.title}
                      </span>
                      <span className="readout text-stone">{p.category}</span>
                    </span>
                    <ArrowRight className="h-4 w-4 flex-shrink-0 text-stone transition-transform group-hover:translate-x-0.5 group-hover:text-signal" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-sand pt-8 text-sm">
          <Link href="/leads" className="font-semibold text-signal hover:underline">
            Lead lists by city and category
          </Link>
          <Link href="/pricing" className="font-semibold text-signal hover:underline">
            Plans and pricing
          </Link>
          <Link href="/api-docs" className="font-semibold text-signal hover:underline">
            The API
          </Link>
          <Link href="/blog" className="font-semibold text-signal hover:underline">
            The blog
          </Link>
        </div>
      </section>

      {/* ================= FINAL CTA ================= */}
      <section className="relative overflow-hidden bg-signal py-18 text-white sm:py-24">
        <div className="grain absolute inset-0 opacity-40" />
        <div className="relative mx-auto max-w-3xl px-5 text-center">
          <h2 className="font-display text-3xl font-extrabold leading-[1.05] sm:text-[2.9rem]">
            {page.ctaHeading}
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-[17px] leading-relaxed text-white/85">
            Free gives you 25 new live territory searches. Pro adds 100 live searches, 100 business-email
            credits, bulk ZIP search, and full exports on a 7-day free trial. Cached reruns stay free. A card
            is required to start the trial, and cancelling before day 7 means no charge.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/signup?plan=pro"
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
      </main>

      <SiteFooter />
    </div>
  )
}
