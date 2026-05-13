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
            ? 'bg-white/95 backdrop-blur-md border-b border-[#E2E8F0] shadow-sm'
            : 'bg-white',
        )}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link
              href="/"
              className="flex items-center gap-2 group"
              aria-label="LeadZip home"
            >
              <div className="w-8 h-8 rounded-lg bg-[#0F172A] flex items-center justify-center shadow-sm group-hover:bg-[#0369A1] transition-colors duration-200">
                <MapPin className="w-4 h-4 text-white" />
              </div>
              <span className="text-[#0F172A] font-bold text-xl tracking-tight">
                Lead<span className="text-[#0369A1]">Zip</span>
              </span>
            </Link>

            {/* Desktop nav links */}
            <nav className="hidden md:flex items-center gap-6">
              {NAV_LINKS.map(link => (
                <button
                  key={link.href}
                  onClick={() => handleNavClick(link.href)}
                  className="text-sm font-medium text-slate-600 hover:text-[#0F172A] transition-colors duration-150 cursor-pointer"
                >
                  {link.label}
                </button>
              ))}
            </nav>

            {/* Desktop CTA buttons */}
            <div className="hidden md:flex items-center gap-3">
              <Link
                href="/login"
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-[#0F172A] transition-colors duration-150"
              >
                Login
              </Link>
              <Link
                href="/signup"
                className="px-4 py-2 text-sm font-semibold text-white bg-[#0369A1] hover:bg-[#0284C7] rounded-xl transition-colors duration-150 shadow-sm"
              >
                Start Free
              </Link>
            </div>

            {/* Mobile hamburger */}
            <button
              className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
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
            className="md:hidden fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div className="md:hidden fixed top-16 left-0 right-0 z-50 bg-white border-b border-[#E2E8F0] shadow-lg px-4 py-4">
            <nav className="flex flex-col gap-1">
              {NAV_LINKS.map(link => (
                <button
                  key={link.href}
                  onClick={() => handleNavClick(link.href)}
                  className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-[#0369A1] transition-colors duration-150"
                >
                  {link.label}
                </button>
              ))}
              <hr className="my-2 border-[#E2E8F0]" />
              <Link
                href="/login"
                onClick={() => setMobileOpen(false)}
                className="px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors duration-150"
              >
                Login
              </Link>
              <Link
                href="/signup"
                onClick={() => setMobileOpen(false)}
                className="mt-1 px-3 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#0369A1] hover:bg-[#0284C7] text-center transition-colors duration-150"
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
