'use client'

import { useState } from 'react'
import Link from 'next/link'
import { MapPin, Menu, X } from 'lucide-react'
import { COOKIE_PREFERENCES_EVENT } from '@/components/CookieConsent'

export function SiteHeader() {
  const [mobileOpen, setMobileOpen] = useState(false)
  return (
    <header className="sticky top-0 z-50 border-b border-sand/70 bg-paper/80 backdrop-blur-md">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Link href="/" className="flex items-center gap-2">
          <span className="relative flex h-7 w-7 items-center justify-center rounded-lg bg-signal">
            <MapPin className="h-4 w-4 text-white" />
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-lime ring-2 ring-paper" />
          </span>
          <span className="font-display text-xl font-extrabold tracking-tight">LeadZipp</span>
        </Link>
        <div className="hidden items-center gap-8 md:flex">
          <Link href="/#how" className="text-sm font-medium text-ink-soft transition-colors hover:text-ink">How it works</Link>
          <Link href="/#features" className="text-sm font-medium text-ink-soft transition-colors hover:text-ink">Features</Link>
          <Link href="/pricing" className="text-sm font-medium text-ink-soft transition-colors hover:text-ink">Pricing</Link>
          <Link href="/blog" className="text-sm font-medium text-ink-soft transition-colors hover:text-ink">Blog</Link>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="hidden text-sm font-semibold text-ink transition-colors hover:text-signal sm:block">Log in</Link>
          <Link href="/signup" className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper transition-transform hover:scale-[1.03] active:scale-95">
            Start free
          </Link>
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-paper-2 md:hidden"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-x-0 bottom-0 top-16 z-40 bg-ink/20 backdrop-blur-sm md:hidden"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-x-0 top-16 z-50 border-b border-sand bg-paper px-5 py-4 shadow-lg md:hidden">
            <nav className="flex flex-col gap-1">
              <Link href="/" onClick={() => setMobileOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-medium text-ink-soft transition-colors hover:bg-paper-2 hover:text-signal">Home</Link>
              <Link href="/#features" onClick={() => setMobileOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-medium text-ink-soft transition-colors hover:bg-paper-2 hover:text-signal">Features</Link>
              <Link href="/pricing" onClick={() => setMobileOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-medium text-ink-soft transition-colors hover:bg-paper-2 hover:text-signal">Pricing</Link>
              <Link href="/blog" onClick={() => setMobileOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-medium text-ink-soft transition-colors hover:bg-paper-2 hover:text-signal">Blog</Link>
              <hr className="my-2 border-sand" />
              <Link href="/login" onClick={() => setMobileOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-medium text-ink-soft transition-colors hover:bg-paper-2">Log in</Link>
              <Link href="/signup" onClick={() => setMobileOpen(false)} className="mt-1 rounded-full bg-ink px-3 py-2.5 text-center text-sm font-semibold text-paper transition-transform hover:scale-[1.02] active:scale-95">Start free</Link>
            </nav>
          </div>
        </>
      )}
    </header>
  )
}

export function SiteFooter() {
  return (
    <footer className="bg-forest-900 py-14 text-white/70">
      <div className="mx-auto max-w-6xl px-5">
        <div className="flex flex-col justify-between gap-8 md:flex-row">
          <div className="max-w-xs">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-signal">
                <MapPin className="h-4 w-4 text-white" />
              </span>
              <span className="font-display text-xl font-extrabold text-white">LeadZipp</span>
            </div>
            <p className="mt-4 text-sm leading-relaxed">
              Find and score local business leads by ZIP code, city, category, and radius.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
            <div>
              <p className="readout text-lime">Product</p>
              <ul className="mt-4 space-y-2.5 text-sm">
                <li><Link href="/#features" className="hover:text-white">Features</Link></li>
                <li><Link href="/pricing" className="hover:text-white">Pricing</Link></li>
                <li><Link href="/web-design-leads" className="hover:text-white">Web design leads</Link></li>
                <li><Link href="/leads" className="hover:text-white">Lead lists by city</Link></li>
                <li><Link href="/compare" className="hover:text-white">Compare tools</Link></li>
                <li><Link href="/api-docs" className="hover:text-white">API</Link></li>
                <li><Link href="/search" className="hover:text-white">Search</Link></li>
              </ul>
            </div>
            <div>
              <p className="readout text-lime">Learn</p>
              <ul className="mt-4 space-y-2.5 text-sm">
                <li><Link href="/blog" className="hover:text-white">Blog</Link></li>
                <li><Link href="/lead-scoring-methodology" className="hover:text-white">Scoring methodology</Link></li>
                <li><Link href="/sample-territory" className="hover:text-white">Sample territory</Link></li>
                <li><Link href="/resources/web-design-outreach-kit" className="hover:text-white">Outreach kit</Link></li>
                <li><Link href="/about" className="hover:text-white">About LeadZipp</Link></li>
                <li><Link href="/#how" className="hover:text-white">How it works</Link></li>
                <li><Link href="/#faq" className="hover:text-white">FAQ</Link></li>
              </ul>
            </div>
            <div>
              <p className="readout text-lime">Legal</p>
              <ul className="mt-4 space-y-2.5 text-sm">
                <li><Link href="/privacy" className="hover:text-white">Privacy</Link></li>
                <li><Link href="/terms" className="hover:text-white">Terms</Link></li>
                <li>
                  <button
                    onClick={() => window.dispatchEvent(new Event(COOKIE_PREFERENCES_EVENT))}
                    className="hover:text-white"
                  >
                    Cookie preferences
                  </button>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-6 text-sm sm:flex-row">
          <p>© {new Date().getFullYear()} LeadZipp. Built for people who sell to Main Street.</p>
          <p className="readout text-white/40">Real data · Google &amp; Yelp</p>
        </div>
      </div>
    </footer>
  )
}
