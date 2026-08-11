'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  MapPin,
  LayoutDashboard,
  Search,
  Bookmark,
  Bell,
  Clock,
  Download,
  Settings,
  Wrench,
  LogOut,
  Menu,
  X,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { MOCK_PROFILE } from '@/lib/mock-auth'

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Search Leads', href: '/search', icon: Search },
  { label: 'Saved Searches', href: '/saved-searches', icon: Bell },
  { label: 'Saved Leads', href: '/saved', icon: Bookmark },
  { label: 'Search History', href: '/history', icon: Clock },
  { label: 'Exports', href: '/exports', icon: Download },
  { label: 'Settings', href: '/settings', icon: Settings },
]

const ADMIN_ITEM = { label: 'Admin', href: '/admin', icon: Wrench }

interface SidebarContentProps {
  pathname: string
  onLinkClick?: () => void
}

async function handleSignOut() {
  try {
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()
    await supabase.auth.signOut()
  } catch { /* ignore */ }
  window.location.href = '/login'
}

const isSupabaseConfigured =
  typeof process !== 'undefined' &&
  process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder.supabase.co'

function LzLogo({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const tile = size === 'sm' ? 'h-6 w-6 rounded-md' : 'h-8 w-8 rounded-lg'
  const icon = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'
  return (
    <span className={cn('relative flex shrink-0 items-center justify-center bg-signal', tile)}>
      <MapPin className={cn('text-white', icon)} aria-hidden="true" />
      <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-lime ring-2 ring-card" />
    </span>
  )
}

function SidebarContent({ pathname, onLinkClick }: SidebarContentProps) {
  const [isAdmin, setIsAdmin] = useState<boolean>(MOCK_PROFILE.role === 'admin')
  const [plan, setPlan] = useState<string>(MOCK_PROFILE.plan)
  const [name, setName] = useState<string>(MOCK_PROFILE.fullName)
  const [email, setEmail] = useState<string>(MOCK_PROFILE.email)

  useEffect(() => {
    if (!isSupabaseConfigured) return
    async function fetchProfile() {
      try {
        const { createClient } = await import('@/lib/supabase/client')
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        setEmail(user.email ?? '')
        const { data } = await supabase
          .from('users_profile')
          .select('role, plan, full_name')
          .eq('id', user.id)
          .maybeSingle()
        if (data) {
          setIsAdmin(data.role === 'admin')
          setPlan(data.plan ?? 'free')
          setName(data.full_name || (user.email ? user.email.split('@')[0] : 'Account'))
        } else if (user.email) {
          setName(user.email.split('@')[0])
        }
      } catch { /* non-fatal */ }
    }
    fetchProfile()
  }, [])

  const navItems = isAdmin ? [...NAV_ITEMS, ADMIN_ITEM] : NAV_ITEMS
  const initials = name.split(/[\s@.]+/).map((n) => n[0]).filter(Boolean).join('').toUpperCase().slice(0, 2) || 'LZ'
  const isPaid = plan === 'pro' || plan === 'agency'

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex items-center gap-2.5 border-b border-sand px-4 py-5">
        <LzLogo />
        <span className="font-display text-lg font-extrabold tracking-tight text-ink">LeadZipp</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Main navigation">
        <ul className="space-y-0.5" role="list">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onLinkClick}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150',
                    isActive
                      ? 'bg-signal-50 text-signal'
                      : 'text-ink-soft hover:bg-paper-2 hover:text-ink'
                  )}
                >
                  <Icon
                    className={cn('h-4 w-4 shrink-0 transition-colors', isActive ? 'text-signal' : 'text-stone group-hover:text-ink')}
                    aria-hidden="true"
                  />
                  {item.label}
                  {isActive && <ChevronRight className="ml-auto h-3.5 w-3.5 text-signal/70" aria-hidden="true" />}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* User footer */}
      <div className="border-t border-sand px-3 py-4">
        <div className="flex items-center gap-3 rounded-xl p-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-signal text-xs font-bold text-white">
            {initials}
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-sm font-semibold text-ink">{name}</span>
              {isPaid && (
                <span className="shrink-0 rounded-md bg-signal-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-signal-600">
                  {plan}
                </span>
              )}
            </div>
            <span className="truncate text-xs text-stone">{email}</span>
          </div>
          <button
            aria-label="Sign out"
            onClick={handleSignOut}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-stone transition-colors hover:bg-signal-50 hover:text-signal"
          >
            <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const touchStartX = useRef(0)
  const touchCurrentX = useRef(0)
  const drawerCloseButtonRef = useRef<HTMLButtonElement>(null)
  const hamburgerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [drawerOpen])

  useEffect(() => {
    if (drawerOpen) drawerCloseButtonRef.current?.focus()
    else hamburgerRef.current?.focus()
  }, [drawerOpen])

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const handler = (e: MediaQueryListEvent) => { if (e.matches) setDrawerOpen(false) }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return (
    <div className="flex h-dvh overflow-hidden bg-paper">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-sand bg-card lg:flex">
        <SidebarContent pathname={pathname} />
      </aside>

      {/* Mobile drawer backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-forest-900/60 backdrop-blur-sm transition-opacity duration-300 lg:hidden',
          drawerOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        )}
        aria-hidden="true"
        onClick={() => setDrawerOpen(false)}
      />

      {/* Mobile drawer */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-60 bg-card transition-transform duration-300 ease-in-out will-change-transform lg:hidden',
          drawerOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        )}
        aria-label="Mobile navigation"
        aria-modal="true"
        role="dialog"
        aria-hidden={!drawerOpen}
        onTouchStart={(e) => {
          const t = e.touches[0]; if (!t) return
          touchStartX.current = t.clientX; touchCurrentX.current = t.clientX
        }}
        onTouchMove={(e) => {
          const t = e.touches[0]; if (!t) return
          touchCurrentX.current = t.clientX
        }}
        onTouchEnd={() => {
          const delta = touchStartX.current - touchCurrentX.current
          if (delta > 60) setDrawerOpen(false)
          touchStartX.current = 0; touchCurrentX.current = 0
        }}
      >
        <div className="absolute right-3 top-4">
          <button
            ref={drawerCloseButtonRef}
            onClick={() => setDrawerOpen(false)}
            aria-label="Close navigation"
            className="flex h-11 w-11 items-center justify-center rounded-lg text-stone hover:bg-paper-2 hover:text-ink"
          >
            <X className="h-4 w-4 shrink-0" />
          </button>
        </div>
        <SidebarContent pathname={pathname} onLinkClick={() => setDrawerOpen(false)} />
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile topbar */}
        <header className="flex items-center gap-3 border-b border-sand bg-card px-4 py-3 lg:hidden">
          <button
            ref={hamburgerRef}
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation menu"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-paper-2"
          >
            <Menu className="h-5 w-5 shrink-0" />
          </button>
          <div className="flex flex-1 items-center gap-2">
            <LzLogo size="sm" />
            <span className="font-display text-base font-extrabold tracking-tight text-ink">LeadZipp</span>
          </div>
        </header>

        {/* Page content */}
        <main id="main-content" className="flex-1 overflow-y-auto p-6 md:p-8" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  )
}
