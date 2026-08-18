'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { MapPin, Menu, X } from 'lucide-react'

/**
 * Canonical marketing nav links. Order is deliberate: product story first
 * (How it works, Features), then the free hook, then evaluation pages.
 * Anchors point at real section ids on the landing page (#how, #features).
 */
const NAV_LINKS = [
  { label: 'How it works', href: '/#how' },
  { label: 'Features', href: '/#features' },
  { label: 'Free audit', href: '/free-audit' },
  { label: 'Compare', href: '/compare' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Blog', href: '/blog' },
]

const MOBILE_LINK_CLASS =
  'flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-ink-soft transition-colors hover:bg-paper-2 hover:text-signal'

export function SiteHeader() {
  const [mobileOpen, setMobileOpen] = useState(false)

  // While the mobile menu is open: Escape closes it and body scroll is locked.
  useEffect(() => {
    if (!mobileOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [mobileOpen])

  const close = () => setMobileOpen(false)

  return (
    <header className="sticky top-0 z-50 border-b border-sand/70 bg-paper/80 backdrop-blur-md">
      <nav aria-label="Main" className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Link href="/" aria-label="LeadZipp home" className="inline-flex min-h-11 items-center gap-2">
          <span className="relative flex h-7 w-7 items-center justify-center rounded-lg bg-signal">
            <MapPin className="h-4 w-4 text-white" />
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-lime ring-2 ring-paper" />
          </span>
          <span className="font-display text-xl font-extrabold tracking-tight">LeadZipp</span>
        </Link>
        <div className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="py-3 text-sm font-medium text-ink-soft transition-colors hover:text-ink"
            >
              {link.label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="hidden min-h-11 items-center text-sm font-semibold text-ink transition-colors hover:text-signal sm:inline-flex"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="inline-flex min-h-11 items-center rounded-full bg-signal px-5 text-sm font-semibold text-white transition-colors hover:bg-signal-600 active:scale-95"
          >
            Start free
          </Link>
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-paper-2 md:hidden"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            aria-controls="site-mobile-menu"
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
            onClick={close}
            aria-hidden="true"
          />
          <div
            id="site-mobile-menu"
            className="absolute inset-x-0 top-16 z-50 border-b border-sand bg-paper px-5 py-4 shadow-lg md:hidden"
          >
            <nav aria-label="Main menu" className="flex flex-col gap-1">
              {NAV_LINKS.map((link) => (
                <Link key={link.href} href={link.href} onClick={close} className={MOBILE_LINK_CLASS}>
                  {link.label}
                </Link>
              ))}
              <hr className="my-2 border-sand" />
              <Link
                href="/login"
                onClick={close}
                className="flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-ink-soft transition-colors hover:bg-paper-2"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                onClick={close}
                className="mt-1 inline-flex min-h-11 items-center justify-center rounded-full bg-signal px-3 text-sm font-semibold text-white transition-colors hover:bg-signal-600 active:scale-95"
              >
                Start free
              </Link>
            </nav>
          </div>
        </>
      )}
    </header>
  )
}
