import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, Clock } from 'lucide-react'
import { getAllPosts, formatDate } from '@/lib/blog'
import { SiteHeader, SiteFooter } from '@/components/marketing/MarketingChrome'
import { Reveal } from '@/components/landing/Reveal'

export const metadata: Metadata = {
  title: 'Blog — Local lead generation playbooks',
  description:
    'Guides and playbooks for finding local business leads: prospecting by ZIP code, finding businesses without a website, lead scoring, and outreach that books clients.',
  alternates: { canonical: 'https://leadzip.vercel.app/blog' },
  openGraph: {
    title: 'LeadZip Blog — Local lead generation playbooks',
    description: 'Guides for finding and closing local business clients — by ZIP code.',
    url: 'https://leadzip.vercel.app/blog',
    type: 'website',
  },
}

export default function BlogIndex() {
  const posts = getAllPosts()
  const [featured, ...rest] = posts

  return (
    <div className="grain relative min-h-screen bg-paper text-ink">
      <SiteHeader />

      {/* Header */}
      <section className="border-b border-sand bg-paper-2 map-grid">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
          <span className="readout text-signal">The LeadZip blog</span>
          <h1 className="mt-3 max-w-3xl font-display text-4xl font-extrabold leading-[1.02] sm:text-5xl">
            Playbooks for finding local clients.
          </h1>
          <p className="mt-4 max-w-xl text-lg text-ink-soft">
            Practical guides on prospecting by ZIP code, finding businesses that need you, and turning a
            neighborhood into a pipeline.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16">
        {posts.length === 0 ? (
          <p className="text-ink-soft">New posts are on the way. Check back soon.</p>
        ) : (
          <>
            {/* Featured post */}
            {featured && (
              <Reveal>
                <Link href={`/blog/${featured.slug}`} className="group grid overflow-hidden rounded-3xl border border-sand bg-white card-lift md:grid-cols-2">
                  <div className="relative aspect-[16/10] md:aspect-auto">
                    {featured.cover && (
                      <Image src={featured.cover} alt={featured.title} fill sizes="(max-width:768px) 100vw, 50vw" className="object-cover" priority />
                    )}
                  </div>
                  <div className="flex flex-col justify-center p-7 sm:p-10">
                    <div className="flex items-center gap-3">
                      <span className="rounded-full bg-signal-50 px-2.5 py-1 text-xs font-bold text-signal-600">{featured.category}</span>
                      <span className="readout flex items-center gap-1 text-stone"><Clock className="h-3 w-3" />{featured.readingTime}</span>
                    </div>
                    <h2 className="mt-4 font-display text-2xl font-extrabold leading-tight sm:text-3xl group-hover:text-signal-600 transition-colors">
                      {featured.title}
                    </h2>
                    <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">{featured.excerpt}</p>
                    <span className="mt-5 inline-flex items-center gap-2 font-semibold text-signal">
                      Read the guide <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </Link>
              </Reveal>
            )}

            {/* Rest grid */}
            {rest.length > 0 && (
              <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {rest.map((p, i) => (
                  <Reveal key={p.slug} delay={(i % 3) * 0.07}>
                    <Link href={`/blog/${p.slug}`} className="group flex h-full flex-col overflow-hidden rounded-2xl border border-sand bg-white card-lift">
                      <div className="relative aspect-[16/10]">
                        {p.cover && <Image src={p.cover} alt={p.title} fill sizes="(max-width:768px) 100vw, 33vw" className="object-cover" />}
                        <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-bold text-signal-600 backdrop-blur">{p.category}</span>
                      </div>
                      <div className="flex flex-1 flex-col p-5">
                        <h3 className="font-display text-lg font-bold leading-snug group-hover:text-signal-600 transition-colors">{p.title}</h3>
                        <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-soft">{p.excerpt}</p>
                        <div className="mt-4 flex items-center gap-2 readout text-stone">
                          <span>{formatDate(p.date)}</span><span>·</span>
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{p.readingTime}</span>
                        </div>
                      </div>
                    </Link>
                  </Reveal>
                ))}
              </div>
            )}
          </>
        )}

        {/* CTA */}
        <div className="mt-16 rounded-3xl bg-forest px-6 py-12 text-center text-white sm:px-10">
          <h2 className="font-display text-2xl font-extrabold sm:text-3xl">Stop reading. Start prospecting.</h2>
          <p className="mx-auto mt-3 max-w-md text-white/75">Run your first search free — type a ZIP and get a scored list of real local businesses.</p>
          <Link href="/signup" className="mt-6 inline-flex items-center gap-2 rounded-full bg-signal px-6 py-3 font-semibold text-white transition-all hover:bg-signal-600 active:scale-95">
            Find leads free <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <SiteFooter />
    </div>
  )
}
