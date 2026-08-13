import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight, ArrowLeft, Check, MapPin, Search, Sparkles, Globe2 } from 'lucide-react'
import { SiteHeader, SiteFooter } from '@/components/marketing/MarketingChrome'
import BreadcrumbSchema from '@/components/seo/BreadcrumbSchema'
import FaqSchema from '@/components/seo/FaqSchema'
import { SITE_URL } from '@/components/seo/site'
import { getAllLocationSlugs, getLocationPage } from '@/lib/seoPages'
import { getAllPosts } from '@/lib/blog'

/**
 * Programmatic location landing pages.
 *
 * One route serves two families that share a clean URL space:
 *   /leads/plumbers-in-atlanta   category x US metro
 *   /leads/london-uk             international city
 *
 * All copy is composed in src/lib/seoPages.ts. The FAQ rendered here and the
 * FAQPage JSON-LD are fed from the same array, so the structured data always
 * mirrors the visible text verbatim.
 */

export const dynamicParams = false

export function generateStaticParams() {
  return getAllLocationSlugs().map((slug) => ({ slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const page = getLocationPage(slug)
  if (!page) return { title: 'Not found', robots: { index: false, follow: false } }

  const url = `${SITE_URL}${page.path}`
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

export default async function LeadsLocationPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const page = getLocationPage(slug)
  if (!page) notFound()

  const posts = getAllPosts()
  const related = page.relatedPosts
    .map((s) => posts.find((p) => p.slug === s))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))

  const url = `${SITE_URL}${page.path}`

  return (
    <div className="grain relative min-h-screen bg-paper text-ink">
      <SiteHeader />

      <BreadcrumbSchema
        items={[
          { name: 'Home', url: SITE_URL },
          { name: 'Lead lists by location', url: `${SITE_URL}/leads` },
          { name: page.breadcrumbName, url },
        ]}
      />
      <FaqSchema items={page.faqs} />

      {/* ================= HERO ================= */}
      <section className="topo relative overflow-hidden text-white">
        <div className="mx-auto grid max-w-6xl items-start gap-12 px-5 py-14 sm:py-20 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <nav aria-label="Breadcrumb" className="readout flex flex-wrap items-center gap-2 text-white/50">
              <Link href="/leads" className="inline-flex items-center gap-1.5 transition-colors hover:text-lime">
                <ArrowLeft className="h-3 w-3" /> All locations
              </Link>
              <span aria-hidden>/</span>
              <span className="text-lime">{page.eyebrow}</span>
            </nav>

            <h1 className="mt-6 font-display text-[2.2rem] font-extrabold leading-[1.02] tracking-tight sm:text-[3.1rem]">
              {page.h1}
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/75">{page.lede}</p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="/signup?plan=pro"
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

          {/* Search recipe */}
          <div className="rounded-3xl border border-white/12 bg-white/[0.06] p-6 backdrop-blur-sm sm:p-7">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-signal">
                {page.kind === 'intl' ? (
                  <Globe2 className="h-4 w-4 text-white" />
                ) : (
                  <MapPin className="h-4 w-4 text-white" />
                )}
              </span>
              <p className="readout text-lime">Run this search</p>
            </div>
            <dl className="mt-5 divide-y divide-white/10">
              {page.recipe.map((row) => (
                <div key={row.label} className="flex items-baseline justify-between gap-4 py-2.5">
                  <dt className="readout text-white/45">{row.label}</dt>
                  <dd className="text-right font-display text-[15px] font-bold text-white">{row.value}</dd>
                </div>
              ))}
            </dl>
            <Link
              href="/signup?plan=pro"
              className="mt-5 flex items-center justify-center gap-2 rounded-full bg-lime px-5 py-2.5 text-sm font-bold text-forest-900 transition-transform hover:scale-[1.02] active:scale-95"
            >
              Open this search <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ================= CONTEXT ================= */}
      <section className="border-b border-sand bg-paper">
        <div className="mx-auto max-w-3xl px-5 py-16 sm:py-20">
          {page.context.map((para, i) => (
            <p
              key={i}
              className={
                i === 0
                  ? 'text-lg leading-relaxed text-ink-soft sm:text-[1.19rem]'
                  : 'mt-6 text-lg leading-relaxed text-ink-soft sm:text-[1.19rem]'
              }
            >
              {para}
            </p>
          ))}

          <div className="mt-10 rounded-2xl border border-sand bg-paper-2 p-6">
            <p className="readout text-signal">{page.areasLabel}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {page.areas.map((a) => (
                <span
                  key={a}
                  className="rounded-full border border-sand bg-white px-3.5 py-1.5 font-mono text-[13px] text-ink-soft"
                >
                  {a}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ================= GAPS / MARKET ================= */}
      <section className="map-grid border-b border-sand bg-paper-2 py-18 sm:py-24">
        <div className="mx-auto max-w-6xl px-5">
          <div className="max-w-2xl">
            <span className="readout text-signal">{page.gaps.eyebrow}</span>
            <h2 className="mt-3 font-display text-3xl font-extrabold leading-tight sm:text-[2.4rem]">
              {page.gaps.heading}
            </h2>
            {page.gaps.body && (
              <p className="mt-5 text-[17px] leading-relaxed text-ink-soft">{page.gaps.body}</p>
            )}
          </div>

          {page.gaps.cards && (
            <div className="mt-12 grid gap-5 sm:grid-cols-2">
              {page.gaps.cards.map((card, i) => (
                <div
                  key={card.title}
                  className="h-full rounded-2xl border border-sand bg-white p-6 transition-colors hover:border-signal/40"
                >
                  <span className="font-mono text-sm font-bold text-signal">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <h3 className="mt-3 font-display text-lg font-bold leading-snug">{card.title}</h3>
                  <p className="mt-2 text-[14.5px] leading-relaxed text-ink-soft">{card.body}</p>
                </div>
              ))}
            </div>
          )}

          {page.gaps.bullets && (
            <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {page.gaps.bullets.map((b) => (
                <div
                  key={b}
                  className="flex items-center gap-3 rounded-2xl border border-sand bg-white px-5 py-4"
                >
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-signal-50">
                    <Sparkles className="h-4 w-4 text-signal" />
                  </span>
                  <span className="font-display text-[15px] font-bold capitalize">{b}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ================= WHAT YOU GET ================= */}
      <section className="mx-auto max-w-6xl px-5 py-18 sm:py-24">
        <div className="max-w-2xl">
          <span className="readout text-signal">{page.benefits.eyebrow}</span>
          <h2 className="mt-3 font-display text-3xl font-extrabold leading-tight sm:text-[2.4rem]">
            {page.benefits.heading}
          </h2>
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {page.benefits.cards?.map((card) => (
            <div key={card.title} className="h-full rounded-2xl border border-sand bg-white p-6 card-lift">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-forest text-lime">
                <Check className="h-5 w-5" />
              </span>
              <h3 className="mt-5 font-display text-lg font-bold leading-snug">{card.title}</h3>
              <p className="mt-2 text-[14.5px] leading-relaxed text-ink-soft">{card.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ================= ROTATING VARIANT SECTION ================= */}
      <section className="topo relative overflow-hidden py-18 text-white sm:py-24">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <span className="readout text-lime">{page.variant.eyebrow}</span>
            <h2 className="mt-3 font-display text-3xl font-extrabold leading-tight sm:text-[2.4rem]">
              {page.variant.heading}
            </h2>
            {page.variant.body && (
              <p className="mt-5 max-w-md text-[17px] leading-relaxed text-white/70">{page.variant.body}</p>
            )}
          </div>
          <ul className="space-y-3">
            {page.variant.bullets?.map((b) => (
              <li
                key={b}
                className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.05] p-4"
              >
                <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-lime">
                  <Check className="h-3 w-3 text-forest-900" />
                </span>
                <span className="text-[15px] leading-relaxed text-white/85">{b}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ================= FAQ ================= */}
      <section className="border-b border-sand bg-paper py-18 sm:py-24">
        <div className="mx-auto max-w-3xl px-5">
          <span className="readout text-signal">Questions</span>
          <h2 className="mt-3 font-display text-3xl font-extrabold leading-tight sm:text-[2.4rem]">
            {page.kind === 'intl'
              ? `Searching ${page.linkLabel.split(',')[0]}, answered`
              : `${page.breadcrumbName}: the common questions`}
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
      <section className="border-b border-sand bg-paper-2 py-18 sm:py-24">
        <div className="mx-auto max-w-6xl px-5">
          <div className="grid gap-10 md:grid-cols-2">
            {[page.siblingsPrimary, page.siblingsSecondary].map((group) => (
              <div key={group.heading}>
                <h2 className="font-display text-xl font-extrabold">{group.heading}</h2>
                <ul className="mt-5 space-y-2.5">
                  {group.links.map((l) => (
                    <li key={l.href}>
                      <Link
                        href={l.href}
                        className="group flex items-center justify-between gap-4 rounded-xl border border-sand bg-white px-5 py-3.5 transition-colors hover:border-signal/50"
                      >
                        <span>
                          <span className="block font-display text-[15px] font-bold transition-colors group-hover:text-signal-600">
                            {l.label}
                          </span>
                          <span className="readout text-stone">{l.sub}</span>
                        </span>
                        <ArrowRight className="h-4 w-4 flex-shrink-0 text-stone transition-transform group-hover:translate-x-0.5 group-hover:text-signal" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {related.length > 0 && (
            <div className="mt-14">
              <h2 className="font-display text-xl font-extrabold">Guides that pair with this list</h2>
              <div className="mt-5 grid gap-5 sm:grid-cols-3">
                {related.map((p) => (
                  <Link
                    key={p.slug}
                    href={`/blog/${p.slug}`}
                    className="group flex h-full flex-col rounded-2xl border border-sand bg-white p-5 card-lift"
                  >
                    <span className="readout text-signal">{p.category}</span>
                    <h3 className="mt-2 font-display text-[15px] font-bold leading-snug transition-colors group-hover:text-signal-600">
                      {p.title}
                    </h3>
                    <p className="mt-2 flex-1 text-[13.5px] leading-relaxed text-ink-soft line-clamp-3">
                      {p.excerpt}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="mt-12 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-sand pt-8 text-sm">
            <Link href="/leads" className="font-semibold text-signal hover:underline">
              Browse every location page
            </Link>
            <Link href="/compare" className="font-semibold text-signal hover:underline">
              Compare LeadZipp with other tools
            </Link>
            <Link href="/pricing" className="font-semibold text-signal hover:underline">
              Plans and pricing
            </Link>
            <Link href="/blog" className="font-semibold text-signal hover:underline">
              The blog
            </Link>
          </div>
        </div>
      </section>

      {/* ================= FINAL CTA ================= */}
      <section className="relative overflow-hidden bg-signal py-18 text-white sm:py-24">
        <div className="grain absolute inset-0 opacity-40" />
        <div className="relative mx-auto max-w-3xl px-5 text-center">
          <h2 className="font-display text-3xl font-extrabold leading-[1.05] sm:text-[2.9rem]">
            {page.ctaHeading}
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-[17px] leading-relaxed text-white/85">{page.ctaBody}</p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/signup?plan=pro"
              className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 font-semibold text-signal transition-transform hover:scale-[1.03] active:scale-95"
            >
              <Search className="h-4 w-4" /> Start free
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 rounded-full border border-white/40 px-7 py-3.5 font-semibold text-white transition-colors hover:bg-white/10"
            >
              See pricing
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  )
}
