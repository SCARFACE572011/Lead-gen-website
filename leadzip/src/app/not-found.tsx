import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { SiteHeader, SiteFooter } from '@/components/marketing/MarketingChrome'

export const metadata: Metadata = {
  title: 'Page not found',
  robots: { index: false, follow: false },
}

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <SiteHeader />
      <main id="main-content" className="map-grid flex flex-1 items-center">
        <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:py-28">
          <p className="readout text-signal">404 · Off the map</p>
          <h1 className="mt-4 max-w-2xl font-display text-5xl font-extrabold leading-[1.02] tracking-tight sm:text-7xl">
            This street is not on our map.
          </h1>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-ink-soft">
            The page you are looking for moved, changed, or never existed.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link
              href="/free-audit"
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-signal px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-transform hover:scale-[1.03] active:scale-95"
            >
              Score any local business while you are here
              <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
            </Link>
          </div>
          <nav aria-label="Helpful links" className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/"
              className="inline-flex min-h-11 items-center rounded-full border border-sand bg-white px-5 text-sm font-semibold text-ink transition-colors hover:border-signal hover:text-signal"
            >
              Back to home
            </Link>
            <Link
              href="/leads"
              className="inline-flex min-h-11 items-center rounded-full border border-sand bg-white px-5 text-sm font-semibold text-ink transition-colors hover:border-signal hover:text-signal"
            >
              Lead lists by city
            </Link>
            <Link
              href="/pricing"
              className="inline-flex min-h-11 items-center rounded-full border border-sand bg-white px-5 text-sm font-semibold text-ink transition-colors hover:border-signal hover:text-signal"
            >
              Pricing
            </Link>
          </nav>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
