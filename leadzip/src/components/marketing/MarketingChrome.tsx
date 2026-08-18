import Link from 'next/link'
import { MapPin } from 'lucide-react'
import { getFeaturedPages } from '@/lib/seoPages'
import { CookiePreferencesButton } from './CookiePreferencesButton'

/**
 * The one canonical marketing chrome. Every public marketing page renders
 * SiteHeader + SiteFooter from this module — do not add per-page copies.
 *
 * SiteHeader (mobile menu state) lives in ./SiteHeader.tsx behind a
 * 'use client' boundary and is re-exported here so pages keep importing
 * both from '@/components/marketing/MarketingChrome'. SiteFooter is
 * server-renderable, which keeps the large seoPages data module out of
 * the client bundle on server-component pages.
 */
export { SiteHeader } from './SiteHeader'

// ≥44px touch targets on mobile; compact rows again from md up.
const FOOTER_LINK_CLASS = 'inline-flex min-h-11 items-center hover:text-white md:min-h-0 md:py-1'

const PRODUCT_LINKS = [
  { label: 'Features', href: '/#features' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Web design leads', href: '/web-design-leads' },
  { label: 'Lead lists by city', href: '/leads' },
  { label: 'Compare tools', href: '/compare' },
  { label: 'Free website audit', href: '/free-audit' },
  { label: 'Free outreach kit', href: '/resources/web-design-outreach-kit' },
  { label: 'API', href: '/api-docs' },
  { label: 'Search', href: '/search' },
]

const COMPANY_LINKS = [
  { label: 'About LeadZipp', href: '/about' },
  { label: 'Blog', href: '/blog' },
  { label: 'Scoring methodology', href: '/lead-scoring-methodology' },
  { label: 'Sample territory', href: '/sample-territory' },
  { label: 'How it works', href: '/#how' },
  { label: 'FAQ', href: '/#faq' },
  { label: 'Log in', href: '/login' },
]

const LEGAL_LINKS = [
  { label: 'Privacy', href: '/privacy' },
  { label: 'Terms', href: '/terms' },
]

function FooterColumn({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <div>
      <p className="readout text-lime">{title}</p>
      <ul className="mt-3 text-sm">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className={FOOTER_LINK_CLASS}>
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function SiteFooter() {
  const featuredMarkets = getFeaturedPages()
  return (
    <footer className="bg-forest-900 py-14 text-white/70">
      <div className="mx-auto max-w-6xl px-5">
        <div className="flex flex-col justify-between gap-8 md:flex-row">
          <div className="max-w-xs">
            <Link href="/" aria-label="LeadZipp home" className="inline-flex min-h-11 items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-signal">
                <MapPin className="h-4 w-4 text-white" />
              </span>
              <span className="font-display text-xl font-extrabold text-white">LeadZipp</span>
            </Link>
            <p className="mt-3 text-sm font-semibold text-white/90">
              Built for people who sell to Main Street.
            </p>
            <p className="mt-2 text-sm leading-relaxed">
              Find and score local business leads by ZIP code, city, category, and radius.
            </p>
          </div>
          <nav aria-label="Footer" className="grid grid-cols-2 gap-x-10 gap-y-8 sm:grid-cols-3">
            <FooterColumn title="Product" links={PRODUCT_LINKS} />
            <FooterColumn title="Company" links={COMPANY_LINKS} />
            <div>
              <p className="readout text-lime">Legal</p>
              <ul className="mt-3 text-sm">
                {LEGAL_LINKS.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className={FOOTER_LINK_CLASS}>
                      {link.label}
                    </Link>
                  </li>
                ))}
                <li>
                  <CookiePreferencesButton />
                </li>
              </ul>
            </div>
          </nav>
        </div>

        <nav aria-label="Featured markets" className="mt-12 border-t border-white/10 pt-8">
          <p className="readout text-lime">Top markets</p>
          <ul className="mt-3 grid grid-cols-2 gap-x-6 text-sm sm:grid-cols-3 lg:grid-cols-4">
            {featuredMarkets.map((page) => (
              <li key={page.slug}>
                <Link href={page.path} className={FOOTER_LINK_CLASS}>
                  {page.linkLabel}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-6 text-sm sm:flex-row">
          <p>© {new Date().getFullYear()} LeadZipp. All rights reserved.</p>
          <p className="readout text-white/60">Real data · Google &amp; Yelp</p>
        </div>
      </div>
    </footer>
  )
}
