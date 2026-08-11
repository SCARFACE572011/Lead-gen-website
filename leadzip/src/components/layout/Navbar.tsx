'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { MapPin, Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_LINKS = [
  { label: 'Home',     href: '#hero' },
  { label: 'Features', href: '#features' },
  { label: 'Pricing',  href: '#pricing' },
]

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  function handleNavClick(href: string) {
    setMobileOpen(false)
    if (href.startsWith('#')) {
      const el = document.querySelector(href)
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <>
      <header
        className={cn(
          'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
          scrolled
            ? 'bg-paper/80 backdrop-blur-md border-b border-sand shadow-sm'
            : 'bg-paper',
        )}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link
              href="/"
              className="flex items-center gap-2 group"
              aria-label="LeadZipp home"
            >
              <span className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-signal shadow-sm transition-transform duration-200 group-hover:scale-105">
                <MapPin className="w-4 h-4 text-white" />
                <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-lime ring-2 ring-paper" />
              </span>
              <span className="font-display text-ink font-extrabold text-xl tracking-tight">
                LeadZipp
              </span>
            </Link>

            {/* Desktop nav links */}
            <nav className="hidden md:flex items-center gap-6">
              {NAV_LINKS.map(link => (
                <button
                  key={link.href}
                  onClick={() => handleNavClick(link.href)}
                  className="text-sm font-medium text-ink-soft hover:text-ink transition-colors duration-150 cursor-pointer"
                >
                  {link.label}
                </button>
              ))}
            </nav>

            {/* Desktop CTA buttons */}
            <div className="hidden md:flex items-center gap-3">
              <Link
                href="/login"
                className="px-4 py-2 text-sm font-semibold text-ink hover:text-signal transition-colors duration-150"
              >
                Login
              </Link>
              <Link
                href="/signup"
                className="px-4 py-2 text-sm font-semibold text-paper bg-ink hover:scale-[1.03] active:scale-95 rounded-full transition-transform duration-150 shadow-sm"
              >
                Start Free
              </Link>
            </div>

            {/* Mobile hamburger */}
            <button
              className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg text-ink-soft hover:bg-paper-2 transition-colors"
              onClick={() => setMobileOpen(v => !v)}
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile menu overlay */}
      {mobileOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 bg-ink/20 backdrop-blur-sm z-40"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div className="md:hidden fixed top-16 left-0 right-0 z-50 bg-paper border-b border-sand shadow-lg px-4 py-4">
            <nav className="flex flex-col gap-1">
              {NAV_LINKS.map(link => (
                <button
                  key={link.href}
                  onClick={() => handleNavClick(link.href)}
                  className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-ink-soft hover:bg-paper-2 hover:text-signal transition-colors duration-150"
                >
                  {link.label}
                </button>
              ))}
              <hr className="my-2 border-sand" />
              <Link
                href="/login"
                onClick={() => setMobileOpen(false)}
                className="px-3 py-2.5 rounded-lg text-sm font-medium text-ink-soft hover:bg-paper-2 transition-colors duration-150"
              >
                Login
              </Link>
              <Link
                href="/signup"
                onClick={() => setMobileOpen(false)}
                className="mt-1 px-3 py-2.5 rounded-full text-sm font-semibold text-paper bg-ink text-center transition-transform duration-150 hover:scale-[1.02] active:scale-95"
              >
                Start Free
              </Link>
            </nav>
          </div>
        </>
      )}
    </>
  )
}
