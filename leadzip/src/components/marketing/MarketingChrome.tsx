import Link from 'next/link'
import { MapPin } from 'lucide-react'

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-sand/70 bg-paper/80 backdrop-blur-md">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Link href="/" className="flex items-center gap-2">
          <span className="relative flex h-7 w-7 items-center justify-center rounded-lg bg-signal">
            <MapPin className="h-4 w-4 text-white" />
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-lime ring-2 ring-paper" />
          </span>
          <span className="font-display text-xl font-extrabold tracking-tight">LeadZip</span>
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
        </div>
      </nav>
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
              <span className="font-display text-xl font-extrabold text-white">LeadZip</span>
            </div>
            <p className="mt-4 text-sm leading-relaxed">
              Turn any ZIP code into a map of local businesses that need what you sell.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
            <div>
              <p className="readout text-lime">Product</p>
              <ul className="mt-4 space-y-2.5 text-sm">
                <li><Link href="/#features" className="hover:text-white">Features</Link></li>
                <li><Link href="/pricing" className="hover:text-white">Pricing</Link></li>
                <li><Link href="/api-docs" className="hover:text-white">API</Link></li>
                <li><Link href="/search" className="hover:text-white">Search</Link></li>
              </ul>
            </div>
            <div>
              <p className="readout text-lime">Learn</p>
              <ul className="mt-4 space-y-2.5 text-sm">
                <li><Link href="/blog" className="hover:text-white">Blog</Link></li>
                <li><Link href="/#how" className="hover:text-white">How it works</Link></li>
                <li><Link href="/#faq" className="hover:text-white">FAQ</Link></li>
              </ul>
            </div>
            <div>
              <p className="readout text-lime">Legal</p>
              <ul className="mt-4 space-y-2.5 text-sm">
                <li><Link href="/privacy" className="hover:text-white">Privacy</Link></li>
                <li><Link href="/terms" className="hover:text-white">Terms</Link></li>
              </ul>
            </div>
          </div>
        </div>
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-6 text-sm sm:flex-row">
          <p>© {new Date().getFullYear()} LeadZip. Built for people who sell to Main Street.</p>
          <p className="readout text-white/40">Real data · Google &amp; Yelp</p>
        </div>
      </div>
    </footer>
  )
}
