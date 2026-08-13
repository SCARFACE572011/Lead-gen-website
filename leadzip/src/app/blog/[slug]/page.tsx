import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { ArrowLeft, ArrowRight, Clock } from 'lucide-react'
import { getPost, getAllPosts, getAllPostSlugs, formatDate } from '@/lib/blog'
import { SiteHeader, SiteFooter } from '@/components/marketing/MarketingChrome'
import BlogPostingSchema from '@/components/seo/BlogPostingSchema'
import BreadcrumbSchema from '@/components/seo/BreadcrumbSchema'

const SITE = 'https://leadzipp.com'

export function generateStaticParams() {
  return getAllPostSlugs().map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const post = getPost(slug)
  if (!post) return { title: 'Not found', robots: { index: false, follow: false } }
  // Fall back to the branded dynamic /og image when a post has no cover.
  const ogImage = post.cover || `/og?title=${encodeURIComponent(post.title)}`
  return {
    title: post.title,
    description: post.description,
    keywords: post.keywords,
    alternates: { canonical: `${SITE}/blog/${post.slug}` },
    openGraph: {
      title: post.title,
      description: post.description,
      url: `${SITE}/blog/${post.slug}`,
      type: 'article',
      publishedTime: post.date,
      authors: [post.author],
      images: [{ url: ogImage, width: 1200, height: 630, alt: post.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.description,
      images: [ogImage],
    },
  }
}

export default async function BlogPost({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = getPost(slug)
  if (!post) notFound()

  const related = getAllPosts().filter((p) => p.slug !== post.slug).slice(0, 3)

  return (
    <div className="grain relative min-h-screen bg-paper text-ink">
      <SiteHeader />
      <BlogPostingSchema post={post} />
      <BreadcrumbSchema
        items={[
          { name: 'Home', url: SITE },
          { name: 'Blog', url: `${SITE}/blog` },
          { name: post.title, url: `${SITE}/blog/${post.slug}` },
        ]}
      />

      <main>
      <article className="mx-auto max-w-3xl px-5 py-12 sm:py-16">
        <Link href="/blog" className="inline-flex items-center gap-1.5 text-sm font-medium text-stone transition-colors hover:text-signal">
          <ArrowLeft className="h-4 w-4" /> All posts
        </Link>

        <div className="mt-6 flex items-center gap-3">
          <span className="rounded-full bg-signal-50 px-2.5 py-1 text-xs font-bold text-signal-600">{post.category}</span>
          <span className="readout flex items-center gap-1 text-stone"><Clock className="h-3 w-3" />{post.readingTime}</span>
        </div>

        <h1 className="mt-4 font-display text-3xl font-extrabold leading-[1.05] tracking-tight sm:text-[2.75rem]">
          {post.title}
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-ink-soft">{post.description}</p>
        <div className="mt-5 flex items-center gap-2 readout text-stone">
          <span>{post.author}</span><span>·</span><span>{formatDate(post.date)}</span>
        </div>

        {post.cover && (
          <div className="relative mt-8 aspect-[16/9] overflow-hidden rounded-2xl border border-sand">
            <Image src={post.cover} alt={post.title} fill sizes="(max-width:768px) 100vw, 768px" className="object-cover" priority />
          </div>
        )}

        <div className="article-body mt-10" dangerouslySetInnerHTML={{ __html: post.html }} />

        {/* Inline CTA */}
        <div className="mt-12 rounded-2xl border border-signal/30 bg-signal-50 p-6 sm:p-8">
          <h2 className="font-display text-xl font-bold text-ink">Find these leads in your area</h2>
          <p className="mt-2 text-[15px] text-ink-soft">
            LeadZipp turns any ZIP code into a scored list of real local businesses — free to start.
          </p>
          <Link href="/signup" className="mt-4 inline-flex items-center gap-2 rounded-full bg-signal px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-signal-600 active:scale-95">
            Start free <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </article>

      {/* Related */}
      {related.length > 0 && (
        <section className="border-t border-sand bg-paper-2 py-14">
          <div className="mx-auto max-w-6xl px-5">
            <h2 className="font-display text-2xl font-extrabold">Keep reading</h2>
            <div className="mt-6 grid gap-6 sm:grid-cols-3">
              {related.map((p) => (
                <Link key={p.slug} href={`/blog/${p.slug}`} className="group flex h-full flex-col overflow-hidden rounded-2xl border border-sand bg-white card-lift">
                  <div className="relative aspect-[16/10]">
                    {p.cover && <Image src={p.cover} alt={p.title} fill sizes="(max-width:768px) 100vw, 33vw" className="object-cover" />}
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <h3 className="font-display text-base font-bold leading-snug group-hover:text-signal-600 transition-colors">{p.title}</h3>
                    <p className="mt-2 flex-1 text-sm text-ink-soft line-clamp-2">{p.excerpt}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
      </main>

      <SiteFooter />
    </div>
  )
}
