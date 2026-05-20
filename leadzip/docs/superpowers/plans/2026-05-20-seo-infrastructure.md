# SEO Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build SEO infrastructure to rank for local B2B lead generation queries — fix existing metadata, add 600 programmatic city/category landing pages, and launch a blog with MDX content.

**Architecture:** Programmatic pages use Next.js `generateStaticParams` to pre-render top 600 city+category combinations at build time. Blog uses MDX files in `content/blog/` read via `fs` at build time — no CMS dependency. All new pages are server components with full metadata exports.

**Tech Stack:** Next.js 16 App Router, TypeScript, MDX (`@next/mdx`), Tailwind CSS

---

## File Map

| File | Change |
|------|--------|
| `src/app/pricing/page.tsx` | Extract client parts to `PricingClient`; export server-side `metadata` |
| `src/app/(auth)/login/page.tsx` | Add `metadata` export |
| `src/app/(auth)/signup/page.tsx` | Add `metadata` export |
| `src/app/(auth)/forgot-password/page.tsx` | Add `metadata` export |
| `src/app/(auth)/reset-password/page.tsx` | Add `metadata` export |
| `src/app/sitemap.ts` | Expand with programmatic + blog pages; remove login/signup |
| `src/app/robots.ts` | Explicitly allow `/leads/` and `/blog/` |
| `src/lib/seo/cities.ts` | New — top 20 US cities with name, state, ZIP |
| `src/lib/seo/slugify.ts` | New — category + city → URL slug utilities |
| `src/app/(marketing)/leads/[category]/[city]/page.tsx` | New — programmatic landing pages |
| `src/app/(marketing)/blog/page.tsx` | New — blog post listing |
| `src/app/(marketing)/blog/[slug]/page.tsx` | New — individual blog post |
| `src/app/(marketing)/blog/rss.xml/route.ts` | New — RSS feed |
| `content/blog/*.mdx` | New — 5 initial blog posts |
| `next.config.ts` | Enable MDX support |

---

### Task 1: Fix Metadata on Auth Pages

**Files:**
- Modify: `src/app/(auth)/login/page.tsx`
- Modify: `src/app/(auth)/signup/page.tsx`
- Modify: `src/app/(auth)/forgot-password/page.tsx`
- Modify: `src/app/(auth)/reset-password/page.tsx`

- [ ] **Step 1: Add metadata to login page**

Open `src/app/(auth)/login/page.tsx`. If the file starts with `'use client'`, check if there's a parent layout or if the page itself is a client component. For auth pages that are client components, create a thin server wrapper.

If `login/page.tsx` is already a server component, add at the top (before the default export):

```tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sign In — LeadZip',
  description: 'Sign in to your LeadZip account and start finding local business leads by ZIP code.',
  alternates: { canonical: 'https://leadzip.vercel.app/login' },
  robots: { index: false },
}
```

If the page uses `'use client'`, convert it: rename the existing file to `LoginClient.tsx`, create a new `page.tsx` that imports it:

```tsx
// src/app/(auth)/login/page.tsx
import type { Metadata } from 'next'
import LoginClient from './LoginClient'

export const metadata: Metadata = {
  title: 'Sign In — LeadZip',
  description: 'Sign in to your LeadZip account and start finding local business leads by ZIP code.',
  alternates: { canonical: 'https://leadzip.vercel.app/login' },
  robots: { index: false },
}

export default function LoginPage() {
  return <LoginClient />
}
```

- [ ] **Step 2: Add metadata to signup page**

Same pattern as login. Add to `src/app/(auth)/signup/page.tsx`:

```tsx
export const metadata: Metadata = {
  title: 'Create Free Account — LeadZip',
  description: 'Sign up for LeadZip free. Get 25 searches per month, lead scores, and contact info — no credit card required.',
  alternates: { canonical: 'https://leadzip.vercel.app/signup' },
  robots: { index: true },
}
```

- [ ] **Step 3: Add metadata to forgot-password and reset-password**

`src/app/(auth)/forgot-password/page.tsx`:
```tsx
export const metadata: Metadata = {
  title: 'Reset Password — LeadZip',
  description: 'Reset your LeadZip account password.',
  alternates: { canonical: 'https://leadzip.vercel.app/forgot-password' },
  robots: { index: false },
}
```

`src/app/(auth)/reset-password/page.tsx`:
```tsx
export const metadata: Metadata = {
  title: 'Set New Password — LeadZip',
  description: 'Create a new password for your LeadZip account.',
  alternates: { canonical: 'https://leadzip.vercel.app/reset-password' },
  robots: { index: false },
}
```

- [ ] **Step 4: TypeScript check**

```bash
cd "/Users/ramifakhuri/Projects/Lead gen. website /leadzip" && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
cd "/Users/ramifakhuri/Projects/Lead gen. website /leadzip"
git add src/app/\(auth\)/
git commit -m "feat(seo): add metadata to auth pages"
```

---

### Task 2: Fix Pricing Page Metadata

**Files:**
- Modify: `src/app/pricing/page.tsx`

The pricing page is a `'use client'` component using `useSearchParams()`. Metadata cannot be exported from client components. Solution: move the client-side logic into a child component.

- [ ] **Step 1: Read the current pricing page structure**

```bash
head -20 "/Users/ramifakhuri/Projects/Lead gen. website /leadzip/src/app/pricing/page.tsx"
```

Note whether the file starts with `'use client'` and which hooks it uses.

- [ ] **Step 2: Create `src/app/pricing/PricingClient.tsx`**

Create `src/app/pricing/PricingClient.tsx` and move the entire current content of `pricing/page.tsx` into it, keeping `'use client'` at the top and renaming the default export to `PricingClient`:

```tsx
'use client'
// ... all existing pricing page content ...
export default function PricingClient() {
  // ... existing component body ...
}
```

- [ ] **Step 3: Replace `src/app/pricing/page.tsx` with a server component**

```tsx
import type { Metadata } from 'next'
import PricingClient from './PricingClient'

export const metadata: Metadata = {
  title: 'Pricing — LeadZip | Free, Pro & Agency Plans',
  description: 'LeadZip free plan: 25 searches/month. Pro plan: unlimited searches, CSV export, CRM integrations. Agency: team seats and white-label exports.',
  alternates: { canonical: 'https://leadzip.vercel.app/pricing' },
  openGraph: {
    title: 'LeadZip Pricing — Free, Pro & Agency',
    description: 'Start free with 25 searches/month. Upgrade to Pro for unlimited local business lead searches and CSV export.',
    images: [{ url: 'https://leadzip.vercel.app/og?title=LeadZip+Pricing', width: 1200, height: 630 }],
  },
}

export default function PricingPage() {
  return <PricingClient />
}
```

- [ ] **Step 4: TypeScript check**

```bash
cd "/Users/ramifakhuri/Projects/Lead gen. website /leadzip" && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
cd "/Users/ramifakhuri/Projects/Lead gen. website /leadzip"
git add src/app/pricing/
git commit -m "feat(seo): add metadata to pricing page via server/client component split"
```

---

### Task 3: SEO Utility Files

**Files:**
- Create: `src/lib/seo/cities.ts`
- Create: `src/lib/seo/slugify.ts`

- [ ] **Step 1: Create `src/lib/seo/cities.ts`**

```bash
mkdir -p "/Users/ramifakhuri/Projects/Lead gen. website /leadzip/src/lib/seo"
```

Create `src/lib/seo/cities.ts`:

```ts
export interface SeoCity {
  name: string
  state: string
  stateAbbr: string
  zip: string
}

export const TOP_CITIES: SeoCity[] = [
  { name: 'New York',       state: 'New York',      stateAbbr: 'NY', zip: '10001' },
  { name: 'Los Angeles',    state: 'California',    stateAbbr: 'CA', zip: '90001' },
  { name: 'Chicago',        state: 'Illinois',      stateAbbr: 'IL', zip: '60601' },
  { name: 'Houston',        state: 'Texas',         stateAbbr: 'TX', zip: '77001' },
  { name: 'Phoenix',        state: 'Arizona',       stateAbbr: 'AZ', zip: '85001' },
  { name: 'Philadelphia',   state: 'Pennsylvania',  stateAbbr: 'PA', zip: '19101' },
  { name: 'San Antonio',    state: 'Texas',         stateAbbr: 'TX', zip: '78201' },
  { name: 'San Diego',      state: 'California',    stateAbbr: 'CA', zip: '92101' },
  { name: 'Dallas',         state: 'Texas',         stateAbbr: 'TX', zip: '75201' },
  { name: 'San Jose',       state: 'California',    stateAbbr: 'CA', zip: '95101' },
  { name: 'Austin',         state: 'Texas',         stateAbbr: 'TX', zip: '78701' },
  { name: 'Jacksonville',   state: 'Florida',       stateAbbr: 'FL', zip: '32099' },
  { name: 'Fort Worth',     state: 'Texas',         stateAbbr: 'TX', zip: '76101' },
  { name: 'Columbus',       state: 'Ohio',          stateAbbr: 'OH', zip: '43085' },
  { name: 'Charlotte',      state: 'North Carolina',stateAbbr: 'NC', zip: '28201' },
  { name: 'Indianapolis',   state: 'Indiana',       stateAbbr: 'IN', zip: '46201' },
  { name: 'San Francisco',  state: 'California',    stateAbbr: 'CA', zip: '94102' },
  { name: 'Seattle',        state: 'Washington',    stateAbbr: 'WA', zip: '98101' },
  { name: 'Denver',         state: 'Colorado',      stateAbbr: 'CO', zip: '80201' },
  { name: 'Nashville',      state: 'Tennessee',     stateAbbr: 'TN', zip: '37201' },
]
```

- [ ] **Step 2: Create `src/lib/seo/slugify.ts`**

Create `src/lib/seo/slugify.ts`:

```ts
/** Convert a display string to a URL-safe slug: "Los Angeles" → "los-angeles" */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Convert a URL slug back to title case: "los-angeles" → "Los Angeles" */
export function deslugify(slug: string): string {
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * Build a canonical programmatic page slug.
 * "Dentists" + "Los Angeles" → "dentists-in-los-angeles"
 */
export function buildLeadPageSlug(category: string, city: string): string {
  return `${slugify(category)}-in-${slugify(city)}`
}
```

- [ ] **Step 3: TypeScript check**

```bash
cd "/Users/ramifakhuri/Projects/Lead gen. website /leadzip" && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
cd "/Users/ramifakhuri/Projects/Lead gen. website /leadzip"
git add src/lib/seo/
git commit -m "feat(seo): add city list and slug utilities for programmatic pages"
```

---

### Task 4: Programmatic Landing Pages

**Files:**
- Create: `src/app/(marketing)/leads/[category]/[city]/page.tsx`

- [ ] **Step 1: Create the route directory**

```bash
mkdir -p "/Users/ramifakhuri/Projects/Lead gen. website /leadzip/src/app/(marketing)/leads/[category]/[city]"
```

- [ ] **Step 2: Create the programmatic page**

Create `src/app/(marketing)/leads/[category]/[city]/page.tsx`:

```tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { TOP_CITIES } from '@/lib/seo/cities'
import { slugify, deslugify } from '@/lib/seo/slugify'
import { LEAD_CATEGORIES } from '@/types/lead'
import { HeroSearchWidget } from '@/components/landing/HeroSearchWidget'

const SEARCHABLE_CATEGORIES = LEAD_CATEGORIES.filter((c) => c !== 'Custom Keyword')

interface Props {
  params: Promise<{ category: string; city: string }>
}

export async function generateStaticParams() {
  const params: { category: string; city: string }[] = []
  for (const cat of SEARCHABLE_CATEGORIES) {
    for (const city of TOP_CITIES) {
      params.push({ category: slugify(cat), city: slugify(city.name) })
    }
  }
  return params
}

export const dynamicParams = true

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category: categorySlug, city: citySlug } = await params
  const categoryName = deslugify(categorySlug)
  const cityData = TOP_CITIES.find((c) => slugify(c.name) === citySlug)
  const cityName = cityData ? cityData.name : deslugify(citySlug)
  const stateName = cityData?.stateAbbr ?? ''

  return {
    title: `Find ${categoryName} Leads in ${cityName}${stateName ? `, ${stateName}` : ''} — LeadZip`,
    description: `Discover ${categoryName} businesses in ${cityName} with ratings, phone numbers, and websites. Search by ZIP code and export your lead list instantly. Free plan available.`,
    alternates: {
      canonical: `https://leadzip.vercel.app/leads/${categorySlug}/${citySlug}`,
    },
    openGraph: {
      title: `Find ${categoryName} Leads in ${cityName} — LeadZip`,
      description: `Search and export ${categoryName} business leads in ${cityName}. Real contact info, lead scores, and website data.`,
    },
  }
}

export default async function LeadCategoryCityPage({ params }: Props) {
  const { category: categorySlug, city: citySlug } = await params

  const categoryName = deslugify(categorySlug)
  const cityData = TOP_CITIES.find((c) => slugify(c.name) === citySlug)
  const cityName = cityData ? cityData.name : deslugify(citySlug)
  const stateAbbr = cityData?.stateAbbr ?? ''
  const defaultZip = cityData?.zip ?? ''

  // Validate that the category is real
  const isValidCategory = SEARCHABLE_CATEGORIES.some(
    (c) => slugify(c) === categorySlug
  )
  if (!isValidCategory) notFound()

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: `How many ${categoryName} businesses are in ${cityName}?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `LeadZip searches Google Places and OpenStreetMap to find ${categoryName} businesses in and around ${cityName}. A typical search returns 20–100+ results depending on the area and search radius.`,
        },
      },
      {
        '@type': 'Question',
        name: `What information does LeadZip show for ${categoryName} leads in ${cityName}?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Each lead includes the business name, address, phone number, website (if available), Google rating, review count, distance from your target ZIP code, and a lead score from 0–100.`,
        },
      },
      {
        '@type': 'Question',
        name: `Can I export ${categoryName} leads from ${cityName} to Excel or CSV?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Yes. Pro and Agency plan users can export saved leads to CSV, which opens directly in Excel, Google Sheets, or any CRM. Free plan users can save up to 25 leads.`,
        },
      },
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <main className="min-h-screen bg-white">
        {/* Breadcrumb */}
        <nav className="mx-auto max-w-3xl px-4 pt-6 text-sm text-slate-400" aria-label="Breadcrumb">
          <ol className="flex items-center gap-1.5">
            <li><Link href="/" className="hover:text-slate-600">Home</Link></li>
            <li>/</li>
            <li><Link href="/search" className="hover:text-slate-600">Leads</Link></li>
            <li>/</li>
            <li className="text-slate-700 font-medium">{categoryName} in {cityName}</li>
          </ol>
        </nav>

        {/* Hero */}
        <section className="mx-auto max-w-3xl px-4 py-12">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl mb-4">
            Find {categoryName} Leads in {cityName}{stateAbbr ? `, ${stateAbbr}` : ''}
          </h1>
          <p className="text-lg text-slate-600 mb-8 leading-relaxed">
            LeadZip finds {categoryName.toLowerCase()} businesses in {cityName} with real contact
            info — phone numbers, websites, ratings, and lead scores. Search by ZIP code,
            filter by radius, and export your list to CSV or your CRM in one click.
          </p>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
            <p className="text-sm font-semibold text-slate-700 mb-4">
              Search {categoryName} leads near {cityName}:
            </p>
            <HeroSearchWidget defaultZip={defaultZip} defaultCategory={categoryName} />
          </div>
        </section>

        {/* Why LeadZip */}
        <section className="mx-auto max-w-3xl px-4 pb-12">
          <h2 className="text-xl font-bold text-slate-900 mb-4">
            Why LeadZip for {categoryName} Leads in {cityName}?
          </h2>
          <ul className="space-y-3 text-slate-600">
            <li className="flex gap-3">
              <span className="text-[#0369A1] font-bold mt-0.5">✓</span>
              <span>Real data from Google Places — ratings, review counts, phone numbers, and websites for each {categoryName.toLowerCase()} business</span>
            </li>
            <li className="flex gap-3">
              <span className="text-[#0369A1] font-bold mt-0.5">✓</span>
              <span>Lead scores (0–100) highlight the best opportunities based on online presence, ratings, and contact info availability</span>
            </li>
            <li className="flex gap-3">
              <span className="text-[#0369A1] font-bold mt-0.5">✓</span>
              <span>Export to CSV, HubSpot, or Salesforce — or save leads and track your outreach status directly in LeadZip</span>
            </li>
          </ul>
        </section>

        {/* FAQ */}
        <section className="mx-auto max-w-3xl px-4 pb-16">
          <h2 className="text-xl font-bold text-slate-900 mb-6">Frequently Asked Questions</h2>
          <div className="space-y-6">
            {jsonLd.mainEntity.map((item, i) => (
              <div key={i}>
                <h3 className="text-base font-semibold text-slate-900 mb-2">{item.name}</h3>
                <p className="text-slate-600 text-sm leading-relaxed">{item.acceptedAnswer.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="bg-[#0369A1] py-12">
          <div className="mx-auto max-w-3xl px-4 text-center">
            <h2 className="text-2xl font-bold text-white mb-3">
              Ready to find {categoryName} leads in {cityName}?
            </h2>
            <p className="text-blue-100 mb-6">Free plan — 25 searches per month, no credit card required.</p>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-8 py-3 text-base font-semibold text-[#0369A1] hover:bg-blue-50 transition-colors"
            >
              Start Free →
            </Link>
          </div>
        </section>
      </main>
    </>
  )
}
```

- [ ] **Step 3: Update `HeroSearchWidget` to accept optional default values**

Open `src/components/landing/HeroSearchWidget.tsx` and add `defaultZip` and `defaultCategory` props:

```tsx
interface HeroSearchWidgetProps {
  defaultZip?: string
  defaultCategory?: string
}

export function HeroSearchWidget({ defaultZip = '', defaultCategory = '' }: HeroSearchWidgetProps) {
  const [zip, setZip] = useState(defaultZip)
  const [category, setCategory] = useState(defaultCategory)
  // ... rest unchanged
}
```

- [ ] **Step 4: TypeScript check**

```bash
cd "/Users/ramifakhuri/Projects/Lead gen. website /leadzip" && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
cd "/Users/ramifakhuri/Projects/Lead gen. website /leadzip"
git add src/app/\(marketing\)/leads/ src/components/landing/HeroSearchWidget.tsx
git commit -m "feat(seo): programmatic landing pages for 600 city+category combinations"
```

---

### Task 5: Blog Infrastructure + MDX Setup

**Files:**
- Modify: `next.config.ts`
- Create: `src/app/(marketing)/blog/page.tsx`
- Create: `src/app/(marketing)/blog/[slug]/page.tsx`
- Create: `src/app/(marketing)/blog/rss.xml/route.ts`
- Create: `content/blog/` directory with 5 MDX posts

- [ ] **Step 1: Install MDX dependencies**

```bash
cd "/Users/ramifakhuri/Projects/Lead gen. website /leadzip" && npm install next-mdx-remote gray-matter
```

Expected: packages installed, no peer dependency errors

- [ ] **Step 2: Verify `next.config.ts` needs no changes**

Blog posts are rendered at runtime using `next-mdx-remote` — they are NOT treated as Next.js pages. The `.tsx` files in `src/app/(marketing)/blog/` handle routing. No `@next/mdx` compiler or `pageExtensions` change is needed. `next.config.ts` stays as-is.

- [ ] **Step 3: Create blog utility — `src/lib/blog.ts`**

Create `src/lib/blog.ts`:

```ts
import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'

export interface BlogPost {
  slug: string
  title: string
  description: string
  publishedAt: string
  category: string
  readingTimeMinutes: number
}

const BLOG_DIR = path.join(process.cwd(), 'content/blog')

export function getAllPosts(): BlogPost[] {
  if (!fs.existsSync(BLOG_DIR)) return []
  const files = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith('.mdx'))
  return files
    .map((filename) => {
      const slug = filename.replace(/\.mdx$/, '')
      const raw = fs.readFileSync(path.join(BLOG_DIR, filename), 'utf8')
      const { data } = matter(raw)
      const wordCount = raw.split(/\s+/).length
      return {
        slug,
        title: data.title ?? slug,
        description: data.description ?? '',
        publishedAt: data.publishedAt ?? '',
        category: data.category ?? 'General',
        readingTimeMinutes: Math.max(1, Math.round(wordCount / 200)),
      }
    })
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
}

export function getPostContent(slug: string): { frontmatter: BlogPost; content: string } | null {
  const filePath = path.join(BLOG_DIR, `${slug}.mdx`)
  if (!fs.existsSync(filePath)) return null
  const raw = fs.readFileSync(filePath, 'utf8')
  const { data, content } = matter(raw)
  const wordCount = content.split(/\s+/).length
  return {
    frontmatter: {
      slug,
      title: data.title ?? slug,
      description: data.description ?? '',
      publishedAt: data.publishedAt ?? '',
      category: data.category ?? 'General',
      readingTimeMinutes: Math.max(1, Math.round(wordCount / 200)),
    },
    content,
  }
}
```

- [ ] **Step 4: Create blog listing page — `src/app/(marketing)/blog/page.tsx`**

```tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { getAllPosts } from '@/lib/blog'

export const metadata: Metadata = {
  title: 'Blog — LeadZip | Local Lead Generation Tips & Outreach Strategies',
  description: 'Guides, templates, and strategies for finding and converting local business leads. Learn how to use ZIP code targeting, cold outreach, and lead scoring.',
  alternates: { canonical: 'https://leadzip.vercel.app/blog' },
  openGraph: {
    title: 'LeadZip Blog — Lead Generation Tips',
    description: 'Guides and strategies for local B2B lead generation.',
  },
}

export default function BlogPage() {
  const posts = getAllPosts()

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 mb-2">Blog</h1>
        <p className="text-slate-500 mb-12">Lead generation tips, outreach templates, and strategies for local B2B prospecting.</p>

        {posts.length === 0 ? (
          <p className="text-slate-400">No posts yet — check back soon.</p>
        ) : (
          <div className="space-y-8">
            {posts.map((post) => (
              <article key={post.slug} className="border-b border-slate-100 pb-8 last:border-0">
                <Link href={`/blog/${post.slug}`} className="group">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#0369A1]">{post.category}</span>
                  <h2 className="mt-1 text-xl font-bold text-slate-900 group-hover:text-[#0369A1] transition-colors">
                    {post.title}
                  </h2>
                  <p className="mt-2 text-slate-500 leading-relaxed">{post.description}</p>
                  <div className="mt-3 flex items-center gap-3 text-xs text-slate-400">
                    <span>{new Date(post.publishedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                    <span>·</span>
                    <span>{post.readingTimeMinutes} min read</span>
                  </div>
                </Link>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
```

- [ ] **Step 5: Create blog post page — `src/app/(marketing)/blog/[slug]/page.tsx`**

```tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { MDXRemote } from 'next-mdx-remote/rsc'
import { getAllPosts, getPostContent } from '@/lib/blog'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.slug }))
}

export const dynamicParams = false

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const post = getPostContent(slug)
  if (!post) return {}
  const { frontmatter: fm } = post
  return {
    title: `${fm.title} — LeadZip Blog`,
    description: fm.description,
    alternates: { canonical: `https://leadzip.vercel.app/blog/${slug}` },
    openGraph: {
      title: fm.title,
      description: fm.description,
      type: 'article',
      publishedTime: fm.publishedAt,
      images: [{ url: `https://leadzip.vercel.app/og?title=${encodeURIComponent(fm.title)}`, width: 1200, height: 630 }],
    },
  }
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params
  const post = getPostContent(slug)
  if (!post) notFound()
  const { frontmatter: fm, content } = post

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: fm.title,
    description: fm.description,
    datePublished: fm.publishedAt,
    author: { '@type': 'Organization', name: 'LeadZip' },
    publisher: { '@type': 'Organization', name: 'LeadZip', url: 'https://leadzip.vercel.app' },
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="min-h-screen bg-white">
        <article className="mx-auto max-w-2xl px-4 py-16">
          <nav className="text-sm text-slate-400 mb-8">
            <Link href="/blog" className="hover:text-slate-600">← Blog</Link>
          </nav>
          <span className="text-xs font-semibold uppercase tracking-wider text-[#0369A1]">{fm.category}</span>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">{fm.title}</h1>
          <div className="mt-3 flex items-center gap-3 text-sm text-slate-400 mb-10">
            <span>{new Date(fm.publishedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
            <span>·</span>
            <span>{fm.readingTimeMinutes} min read</span>
          </div>
          <div className="prose prose-slate max-w-none prose-headings:font-bold prose-a:text-[#0369A1]">
            <MDXRemote source={content} />
          </div>
          <div className="mt-16 rounded-2xl bg-[#F0F9FF] border border-[#0369A1]/20 p-8 text-center">
            <h2 className="text-xl font-bold text-slate-900 mb-2">Ready to find local business leads?</h2>
            <p className="text-slate-500 mb-4">Free plan — 25 searches per month, no credit card required.</p>
            <Link href="/signup" className="inline-flex items-center gap-2 rounded-xl bg-[#0369A1] px-6 py-3 text-sm font-semibold text-white hover:bg-[#0284C7] transition-colors">
              Start Free →
            </Link>
          </div>
        </article>
      </main>
    </>
  )
}
```

Note: `next-mdx-remote` was installed in Step 1 of this task.

- [ ] **Step 6: Create RSS feed — `src/app/(marketing)/blog/rss.xml/route.ts`**

```ts
import { getAllPosts } from '@/lib/blog'

export async function GET() {
  const posts = getAllPosts()
  const baseUrl = 'https://leadzip.vercel.app'

  const items = posts
    .map(
      (post) => `
    <item>
      <title><![CDATA[${post.title}]]></title>
      <description><![CDATA[${post.description}]]></description>
      <link>${baseUrl}/blog/${post.slug}</link>
      <guid>${baseUrl}/blog/${post.slug}</guid>
      <pubDate>${new Date(post.publishedAt).toUTCString()}</pubDate>
    </item>`
    )
    .join('')

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>LeadZip Blog</title>
    <link>${baseUrl}/blog</link>
    <description>Lead generation tips, outreach templates, and strategies for local B2B prospecting.</description>
    <language>en-us</language>
    <atom:link href="${baseUrl}/blog/rss.xml" rel="self" type="application/rss+xml"/>
    ${items}
  </channel>
</rss>`

  return new Response(rss, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
  })
}
```

- [ ] **Step 7: TypeScript check**

```bash
cd "/Users/ramifakhuri/Projects/Lead gen. website /leadzip" && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 8: Commit**

```bash
cd "/Users/ramifakhuri/Projects/Lead gen. website /leadzip"
git add next.config.ts src/lib/blog.ts src/app/\(marketing\)/blog/ src/lib/seo/
git commit -m "feat(seo): blog infrastructure with MDX, listing page, post page, and RSS feed"
```

---

### Task 6: Initial Blog Content (5 Posts)

**Files:**
- Create: `content/blog/find-dentist-leads-by-zip.mdx`
- Create: `content/blog/cold-outreach-templates-contractors.mdx`
- Create: `content/blog/best-categories-local-lead-generation.mdx`
- Create: `content/blog/export-leads-hubspot-salesforce.mdx`
- Create: `content/blog/local-seo-vs-lead-generation.mdx`

- [ ] **Step 1: Create the content directory**

```bash
mkdir -p "/Users/ramifakhuri/Projects/Lead gen. website /leadzip/content/blog"
```

- [ ] **Step 2: Create post 1 — Find dentist leads by ZIP**

Create `content/blog/find-dentist-leads-by-zip.mdx`:

```mdx
---
title: "How to Find Dentist Leads in Any City Using ZIP Codes"
description: "A step-by-step guide to finding dental office leads in your target city using ZIP code targeting, lead scoring, and contact enrichment."
publishedAt: "2026-05-20"
category: "How-To"
---

Dental offices are one of the most valuable lead categories for web design agencies, local SEO firms, and marketing consultants. They have recurring revenue, often lack strong digital presence, and respond well to outreach that addresses their specific gap — whether that's a missing website, poor Google ratings, or no online booking.

## Why Dentists Are High-Value Leads

Most dental practices were founded by clinicians, not marketers. That means:

- **40–60% have no website** or a website built in 2010 that isn't mobile-friendly
- **Most don't run Google Ads** — even though patients search "dentist near me" every day
- **They have recurring revenue** — meaning they can afford and justify ongoing services

A dental practice with 3 stars and no website is a lead score of 90+ in LeadZip. That's your best prospect.

## Step 1: Search by ZIP Code

Open LeadZip and enter the ZIP code for the city you're targeting. Set the radius to 25 miles to capture a metro area, or 5–10 miles for a tight geographic focus.

Select **Dentists** from the category dropdown and hit Search.

## Step 2: Filter for High-Opportunity Leads

Use the **No Website** filter to instantly surface the best prospects — dental offices with zero online presence. These are your warmest cold leads because the need is obvious and demonstrable.

Alternatively, use the **Min Rating** filter set to 3.0–3.5 stars. These practices have enough reviews to show they're active businesses, but their online presence isn't helping them compete.

## Step 3: Check Lead Scores

LeadZip's lead score (0–100) factors in:
- Phone availability (+15)
- Website presence or absence (+20 if no website — that's your opportunity)
- Rating and review count (+25)
- Distance from target ZIP (+15)

Leads scoring 70+ are your priority. Leads scoring 90+ usually have no website and a decent rating — the perfect cold outreach target.

## Step 4: Find the Email

Once you've saved your top leads, click **Find Email** on any lead with a website. LeadZip will attempt to find a verified contact email for the domain using public data sources.

For leads without websites, use the phone number to call and get the decision-maker's name, then search LinkedIn.

## Step 5: Export and Outreach

Export your lead list to CSV and import it into your CRM, or use LeadZip's HubSpot and Salesforce integrations to push leads directly.

A good outreach message for dental leads mentions:
1. That you found them specifically (not a bulk blast)
2. The specific gap you noticed (no website, low reviews, etc.)
3. One concrete outcome ("We helped a dental office in [city] go from 3 stars to 4.6 in 6 months")

Start with 20–30 leads per outreach batch, track your response rate, and refine your message before scaling.
```

- [ ] **Step 3: Create post 2 — Cold outreach templates for contractors**

Create `content/blog/cold-outreach-templates-contractors.mdx`:

```mdx
---
title: "Cold Outreach Templates for Contractor Leads"
description: "5 proven email and voicemail templates for reaching out to general contractors and home service businesses found on LeadZip."
publishedAt: "2026-05-19"
category: "Outreach"
---

General contractors are one of the largest lead categories for web design, local SEO, and marketing agencies. They're often busy, skeptical of marketing pitches, and respond best to direct, specific outreach that shows you've done your homework.

These templates are written for contractors found on LeadZip — meaning you already know their business name, location, rating, and whether they have a website.

## Template 1: No Website (Email)

**Subject:** [Business Name] — quick question

Hi [Name],

I was looking for contractors in [city] and came across [Business Name] on Google. Great reviews — you're clearly doing solid work.

I noticed you don't have a website yet. That's actually common for contractors who get most of their work through referrals, but it's leaving a lot of revenue on the table. Homeowners in your area are searching Google every day for contractors, and right now they're finding your competitors instead.

I build websites for contractors specifically — fast, mobile-friendly, and set up to show up in local searches. Would you be open to a 10-minute call to see if it might make sense?

[Your name]
[Phone]

---

## Template 2: Low Rating (Email)

**Subject:** Helping [Business Name] get more 5-star reviews

Hi [Name],

I found [Business Name] on Google and saw you have some great work in your portfolio, but your rating is sitting at [X] stars — which means you might be losing jobs to competitors with higher ratings even when your work is better.

I help contractors set up a simple review system that gets happy customers to leave Google reviews automatically after each job. Most of my clients see a noticeable rating improvement within 60 days.

Happy to show you how it works — do you have 10 minutes this week?

[Your name]

---

## Template 3: Phone Script (Voicemail)

"Hi, this is [your name]. I came across [Business Name] on Google — you've got great reviews. I work with contractors in [city] on websites and local SEO, and I think there's a real opportunity to get you showing up higher in search results when homeowners are looking for [service type]. I'll keep this brief — if you want to hear more, give me a call back at [number]. No pressure. Thanks."

---

## Template 4: Follow-Up Email (Day 5)

**Subject:** Re: [Business Name]

Hi [Name],

Just following up on my note from last week. I know you're busy — running a contracting business leaves little time for marketing follow-ups.

I'll make this easy: I built a similar site for [Contractor Name] in [nearby city] last year. They went from page 3 on Google to showing up in the top 3 results for "[service] [city]" within 4 months.

If you're curious, I can put together a free audit of what's holding [Business Name] back online. Just reply here and I'll send it over.

[Your name]

---

## Template 5: LinkedIn Connection Request

"Hi [Name] — I found [Business Name] while researching contractors in [city] for a client. Impressive review count. I work with home service businesses on digital presence and thought it'd be worth connecting."

---

## Tips for Higher Response Rates

- **Personalize the subject line** — include the business name every time
- **Reference something specific** — their rating, location, or a gap you noticed
- **Keep it short** — contractors read email on their phone between jobs
- **Call in the morning** — 7–9am before jobs start is the best time to reach decision-makers
- **Follow up exactly twice** — once at day 5, once at day 12, then move on
```

- [ ] **Step 4: Create posts 3, 4, 5**

Create `content/blog/best-categories-local-lead-generation.mdx`:

```mdx
---
title: "The Best Business Categories for Local B2B Lead Generation"
description: "Which business types convert best for web design, SEO, and marketing agency cold outreach? A data-driven breakdown by category."
publishedAt: "2026-05-18"
category: "Strategy"
---

Not all business categories are equal for lead generation. Some have high concentrations of businesses with no websites. Others have owners who respond well to cold outreach. And some just have the budget to pay for ongoing services.

Here's a breakdown of the top categories in LeadZip, ranked by cold outreach suitability for web design and marketing agencies.

## Tier 1: Highest Conversion Potential

### Dentists and Medical Clinics
High revenue, often lacking digital presence, and easy to demonstrate value. A dental office with no website or a 3-star rating has an obvious, demonstrable problem. They also have recurring revenue to support ongoing marketing spend.

**Best filter:** No Website + Rating 3.5–4.5

### Contractors and Home Services
Enormous market, high variance in digital maturity. The best contractors get all their work from referrals and have no online presence — which means massive opportunity for the first agency to reach them.

**Best filter:** No Website, or Has Website + Min Rating 3.0

### Auto Shops
High local intent searches ("auto repair near me") and most shops are still operating from Yellow Pages-era marketing. A good Google presence alone can significantly increase walk-in traffic.

## Tier 2: Strong Potential

### Law Firms
Higher average revenue per client means more budget for marketing. Solo practitioners and small firms are often the best prospects — they're big enough to afford services but small enough that the owner handles vendor decisions.

### Restaurants
High volume but lower margins. Better for reputation management and review-building services than full websites. Look for restaurants with 3.0–3.5 stars and 20+ reviews.

### Gyms and Fitness Studios
Post-pandemic recovery created a wave of fitness studios with outdated websites and poor local SEO. Membership-based revenue makes them willing to invest in customer acquisition.

## Tier 3: Niche but Profitable

### Veterinarians
Highly loyal customer base, high lifetime value. Practices with low ratings or no website stand out sharply — pet owners research vets carefully before choosing.

### Chiropractors
Insurance billing creates steady revenue but limited marketing sophistication. Great market for local SEO and Google Ads management.

## Using Lead Scores to Prioritize

LeadZip assigns a score from 0–100 based on phone availability, website presence, rating, and review count. For cold outreach, focus on:

- **Score 80–100:** Top priority — clear gap, established business
- **Score 60–79:** Good prospects — some online presence but room to improve
- **Score below 60:** Lower priority unless you have a very specific offer for their situation
```

Create `content/blog/export-leads-hubspot-salesforce.mdx`:

```mdx
---
title: "How to Export Leads from LeadZip to HubSpot and Salesforce"
description: "Step-by-step guide to exporting your LeadZip lead list to HubSpot CRM, Salesforce, or a CSV file for use in any other tool."
publishedAt: "2026-05-17"
category: "How-To"
---

Once you've found and saved your leads in LeadZip, the next step is getting them into your sales workflow. LeadZip supports three export formats: CSV (works with any tool), HubSpot CRM, and Salesforce.

## Exporting to CSV

CSV is the universal format — it works with Excel, Google Sheets, HubSpot, Salesforce, Mailchimp, Close, Pipedrive, and virtually every other tool.

1. Go to **Saved Leads** in the left sidebar
2. Select the leads you want to export (use the checkbox to select all, or pick individual leads)
3. Click the **Export** button in the toolbar
4. Choose **Download CSV**

The CSV includes: business name, category, address, city, state, ZIP, phone, website, rating, review count, lead score, status, and any notes you've added.

## Exporting to HubSpot

LeadZip can push leads directly to your HubSpot account as Contacts.

1. Go to **Settings → Integrations** and connect your HubSpot account
2. On the Saved Leads page, select the leads you want to push
3. Click **Export → Send to HubSpot**

Each lead is created as a HubSpot Contact with:
- First/last name (parsed from business name where possible)
- Company name
- Phone number
- Website URL
- A custom property for LeadZip score

## Exporting to Salesforce

Salesforce export works the same way — connect your account in Settings first, then push from Saved Leads.

Leads are created as Salesforce Leads (not Contacts) with standard field mappings. Custom fields like lead score are mapped to a custom Salesforce field that you create during the integration setup.

## Best Practices

- **Tag leads before exporting** — use LeadZip's status labels (New, Contacted, Qualified) to filter your export to only the leads ready for outreach
- **Export in batches of 25–50** — smaller batches are easier to track and follow up on
- **Add notes before exporting** — notes sync to HubSpot/Salesforce as a Contact Note, giving your sales team context
```

Create `content/blog/local-seo-vs-lead-generation.mdx`:

```mdx
---
title: "Local SEO vs. Lead Generation: What's the Difference?"
description: "Local SEO and lead generation are often confused. Here's how they differ, when to use each, and how tools like LeadZip fit into your growth strategy."
publishedAt: "2026-05-16"
category: "Strategy"
---

If you're trying to grow a local service business — or sell services to one — you'll hear "local SEO" and "lead generation" used interchangeably. They're not the same thing, and confusing them leads to wasted time and money.

## What Is Local SEO?

Local SEO is the practice of optimizing your online presence so you appear in search results when people near you search for your type of business.

**Goal:** Be found by customers who are already looking for what you offer.

**How it works:**
- Optimize your Google Business Profile (formerly Google My Business)
- Get consistent name/address/phone citations across directories
- Earn positive Google reviews
- Build location-specific pages on your website

**Timeline:** 3–12 months to see meaningful results

**Who needs it:** Any business that wants to be found by local customers searching Google

## What Is Lead Generation?

Lead generation is the process of proactively identifying and reaching out to potential customers — people who may need your services but haven't searched for you yet.

**Goal:** Build a pipeline of prospects before they're actively searching.

**How it works:**
- Search for businesses that match your ideal customer profile
- Evaluate them based on need (no website, low rating, missing contact info)
- Reach out with a targeted message

**Timeline:** Results can come within days of first outreach

**Who needs it:** Service businesses looking to grow faster than inbound SEO allows

## How LeadZip Fits In

LeadZip is a lead generation tool — it finds businesses that might need your services, not businesses that are looking for you.

Use LeadZip when you're:
- Starting a new agency and need clients fast
- Entering a new market or city
- Launching a new service (e.g., Google Ads management) and need prospects who would benefit from it
- Running a cold email or cold calling campaign

Use local SEO when you're:
- Building a long-term inbound marketing strategy
- Helping a client get found by their local customers
- Complementing outbound efforts with passive lead flow

## The Best Strategy Uses Both

The most effective growth strategy combines both approaches:

1. **Use LeadZip to fill your pipeline now** — find 50 high-potential leads this week, start outreach, book meetings
2. **Invest in local SEO for 6–12 months** — so that inbound leads start flowing without ongoing effort

Think of lead generation as your salary and SEO as your investment portfolio. You need the salary now, but the portfolio grows while you sleep.
```

- [ ] **Step 5: TypeScript check + build**

```bash
cd "/Users/ramifakhuri/Projects/Lead gen. website /leadzip" && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 6: Commit**

```bash
cd "/Users/ramifakhuri/Projects/Lead gen. website /leadzip"
git add content/blog/
git commit -m "feat(seo): 5 initial blog posts targeting lead generation keywords"
```

---

### Task 7: Sitemap Expansion + Robots Update

**Files:**
- Modify: `src/app/sitemap.ts`
- Modify: `src/app/robots.ts`

- [ ] **Step 1: Update `src/app/sitemap.ts`**

Replace the entire file contents:

```ts
import type { MetadataRoute } from 'next'
import { TOP_CITIES } from '@/lib/seo/cities'
import { LEAD_CATEGORIES } from '@/types/lead'
import { slugify } from '@/lib/seo/slugify'
import { getAllPosts } from '@/lib/blog'

const BASE_URL = 'https://leadzip.vercel.app'
const SEARCHABLE_CATEGORIES = LEAD_CATEGORIES.filter((c) => c !== 'Custom Keyword')

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL,               lastModified: now, changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${BASE_URL}/pricing`,  lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE_URL}/blog`,     lastModified: now, changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${BASE_URL}/privacy`,  lastModified: now, changeFrequency: 'yearly',  priority: 0.2 },
    { url: `${BASE_URL}/terms`,    lastModified: now, changeFrequency: 'yearly',  priority: 0.2 },
  ]

  const programmaticPages: MetadataRoute.Sitemap = SEARCHABLE_CATEGORIES.flatMap((cat) =>
    TOP_CITIES.map((city) => ({
      url: `${BASE_URL}/leads/${slugify(cat)}/${slugify(city.name)}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    }))
  )

  const blogPosts: MetadataRoute.Sitemap = getAllPosts().map((post) => ({
    url: `${BASE_URL}/blog/${post.slug}`,
    lastModified: new Date(post.publishedAt),
    changeFrequency: 'yearly' as const,
    priority: 0.7,
  }))

  return [...staticPages, ...programmaticPages, ...blogPosts]
}
```

- [ ] **Step 2: Update `src/app/robots.ts`**

Replace the file contents:

```ts
import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/leads/', '/blog/', '/pricing', '/privacy', '/terms'],
        disallow: ['/dashboard/', '/admin/', '/api/', '/search/', '/saved/', '/history/', '/exports/', '/settings/', '/login', '/signup'],
      },
    ],
    sitemap: 'https://leadzip.vercel.app/sitemap.xml',
  }
}
```

- [ ] **Step 3: TypeScript check**

```bash
cd "/Users/ramifakhuri/Projects/Lead gen. website /leadzip" && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
cd "/Users/ramifakhuri/Projects/Lead gen. website /leadzip"
git add src/app/sitemap.ts src/app/robots.ts
git commit -m "feat(seo): expand sitemap with 600 programmatic pages + blog posts; update robots"
```

---

### Task 8: Deploy + Verify

- [ ] **Step 1: Final TypeScript check**

```bash
cd "/Users/ramifakhuri/Projects/Lead gen. website /leadzip" && npx tsc --noEmit
```

Expected: no output

- [ ] **Step 2: Deploy to Vercel**

```bash
cd "/Users/ramifakhuri/Projects/Lead gen. website /leadzip" && vercel --prod
```

Expected: Build succeeds. Build will generate ~600 static pages — allow 2–3 minutes.

- [ ] **Step 3: Verify sitemap**

Open `https://leadzip.vercel.app/sitemap.xml` and confirm it contains entries for:
- `/leads/dentists/los-angeles`
- `/blog/find-dentist-leads-by-zip`
- `/pricing`

- [ ] **Step 4: Verify RSS feed**

Open `https://leadzip.vercel.app/blog/rss.xml` and confirm it returns valid XML with 5 items.

- [ ] **Step 5: Submit sitemap to Google Search Console**

Go to Google Search Console → Sitemaps → add `https://leadzip.vercel.app/sitemap.xml`. This signals Google to crawl the 600 new pages.
