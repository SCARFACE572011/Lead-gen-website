'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Bell,
  Bookmark,
  ChevronDown,
  Clock,
  Download,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  Search,
  Settings,
  TrendingUp,
  Wrench,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { MOCK_PROFILE } from '@/lib/mock-auth'

const NAV_ITEMS = [
  { label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Find leads', href: '/search', icon: Search },
  { label: 'Market gaps', href: '/market-gaps', icon: TrendingUp },
  { label: 'Saved leads', href: '/saved', icon: Bookmark },
  { label: 'Saved searches', href: '/saved-searches', icon: Bell },
  { label: 'History', href: '/history', icon: Clock },
  { label: 'Exports', href: '/exports', icon: Download },
]

const SETTINGS_ITEM = { label: 'Settings', href: '/settings', icon: Settings }
const ADMIN_ITEM = { label: 'Owner', href: '/admin', icon: Wrench }

const isSupabaseConfigured =
  typeof process !== 'undefined' &&
  process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder.supabase.co'

async function handleSignOut() {
  try {
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()
    await supabase.auth.signOut()
  } catch {
    // The redirect still clears the app shell if the local client is unavailable.
  }
  window.location.href = '/login'
}

function LzLogo() {
  return (
    <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-signal">
      <MapPin className="h-4 w-4 text-white" aria-hidden="true" />
      <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-lime ring-2 ring-card" />
    </span>
  )
}

function NavLink({
  item,
  pathname,
  onClick,
  compact = false,
}: {
  item: (typeof NAV_ITEMS)[number]
  pathname: string
  onClick?: () => void
  compact?: boolean
}) {
  const Icon = item.icon
  const active = pathname === item.href || pathname.startsWith(`${item.href}/`)

  return (
    <Link
      href={item.href}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group relative flex items-center gap-2 rounded-xl text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal',
        compact ? 'px-3 py-3' : 'px-3 py-2',
        active
          ? 'bg-signal-50 text-signal-600'
          : 'text-ink-soft hover:bg-paper-2 hover:text-ink'
      )}
    >
      <Icon
        className={cn('h-4 w-4 shrink-0', active ? 'text-signal' : 'text-stone group-hover:text-ink')}
        aria-hidden="true"
      />
      <span>{item.label}</span>
      {!compact && active && (
        <span className="absolute inset-x-3 -bottom-[13px] h-0.5 rounded-full bg-signal" aria-hidden="true" />
      )}
    </Link>
  )
}

interface AccountState {
  name: string
  email: string
  plan: string
  isPlatformAdmin: boolean
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const accountWrapRef = useRef<HTMLDivElement>(null)
  const [account, setAccount] = useState<AccountState>({
    name: isSupabaseConfigured ? '' : MOCK_PROFILE.fullName,
    email: isSupabaseConfigured ? '' : MOCK_PROFILE.email,
    plan: isSupabaseConfigured ? 'free' : MOCK_PROFILE.plan,
    isPlatformAdmin: !isSupabaseConfigured && MOCK_PROFILE.role === 'admin',
  })

  useEffect(() => {
    if (!isSupabaseConfigured) return

    async function fetchAccount() {
      try {
        const { createClient } = await import('@/lib/supabase/client')
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data } = await supabase
          .from('users_profile')
          .select('plan, full_name')
          .eq('id', user.id)
          .maybeSingle()

        let isPlatformAdmin = false
        try {
          const accessResponse = await fetch('/api/admin/access', { cache: 'no-store' })
          if (accessResponse.ok) {
            const access = await accessResponse.json() as { isPlatformAdmin?: boolean }
            isPlatformAdmin = access.isPlatformAdmin === true
          }
        } catch {
          // Fail closed: customer plans never imply owner access.
        }

        const email = user.email ?? ''
        setAccount({
          email,
          name: data?.full_name || (email ? email.split('@')[0] : 'Account'),
          plan: data?.plan ?? 'free',
          isPlatformAdmin,
        })
      } catch {
        // The shell remains usable and owner navigation stays hidden.
      }
    }

    void fetchAccount()
  }, [])

  useEffect(() => {
    if (!accountOpen) return
    const onPointerDown = (event: MouseEvent) => {
      if (accountWrapRef.current && !accountWrapRef.current.contains(event.target as Node)) {
        setAccountOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [accountOpen])

  useEffect(() => {
    if (!menuOpen) return
    closeButtonRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false)
        window.setTimeout(() => menuButtonRef.current?.focus(), 0)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [menuOpen])

  const planLabel = account.plan === 'agency' ? 'Agency' : account.plan === 'pro' ? 'Pro' : 'Free'
  const initials = account.name
    .split(/[\s@.]+/)
    .map((part) => part[0])
    .filter(Boolean)
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'LZ'
  const mobileItems = [
    ...NAV_ITEMS,
    SETTINGS_ITEM,
    ...(account.isPlatformAdmin ? [ADMIN_ITEM] : []),
  ]

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-paper">
      <header className="relative z-40 shrink-0 border-b border-sand bg-card/95 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-[1720px] items-center gap-4 px-4 sm:px-6">
          <Link
            href="/dashboard"
            className="flex shrink-0 items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
            aria-label="LeadZipp dashboard"
          >
            <LzLogo />
            <span className="font-display text-lg font-extrabold tracking-tight text-ink">LeadZipp</span>
          </Link>

          <nav className="mx-auto hidden items-center gap-0.5 xl:flex" aria-label="Workspace navigation">
            {NAV_ITEMS.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} />
            ))}
          </nav>

          <div className="ml-auto hidden items-center gap-2 xl:flex">
            {account.isPlatformAdmin && (
              <NavLink item={ADMIN_ITEM} pathname={pathname} />
            )}
            <Link
              href="/settings"
              aria-label="Settings"
              aria-current={pathname.startsWith('/settings') ? 'page' : undefined}
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal',
                pathname.startsWith('/settings')
                  ? 'bg-signal-50 text-signal'
                  : 'text-stone hover:bg-paper-2 hover:text-ink'
              )}
            >
              <Settings className="h-4 w-4" aria-hidden="true" />
            </Link>

            <div ref={accountWrapRef} className="relative">
              <button
                onClick={() => setAccountOpen((open) => !open)}
                className="flex items-center gap-2 rounded-xl border border-sand bg-card py-1.5 pl-1.5 pr-2.5 text-left transition-colors hover:bg-paper-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
                aria-expanded={accountOpen}
                aria-haspopup="menu"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink text-xs font-bold text-white">
                  {initials}
                </span>
                <span className="hidden max-w-32 2xl:block">
                  <span className="block truncate text-xs font-semibold text-ink">{account.name || 'Account'}</span>
                  <span className="block text-[10px] font-bold uppercase tracking-wide text-signal-600">{planLabel}</span>
                </span>
                <ChevronDown className={cn('h-3.5 w-3.5 text-stone transition-transform', accountOpen && 'rotate-180')} aria-hidden="true" />
              </button>

              {accountOpen && (
                <div role="menu" className="absolute right-0 top-full mt-2 w-64 overflow-hidden rounded-2xl border border-sand bg-card p-2 shadow-xl">
                  <div className="border-b border-sand px-3 pb-3 pt-2">
                    <p className="truncate text-sm font-semibold text-ink">{account.name || 'Account'}</p>
                    <p className="truncate text-xs text-stone">{account.email}</p>
                    <span className="mt-2 inline-flex rounded-full bg-signal-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-signal-600">
                      {planLabel} plan
                    </span>
                  </div>
                  <Link role="menuitem" href="/settings" className="mt-1 flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-ink-soft hover:bg-paper-2 hover:text-ink">
                    <Settings className="h-4 w-4 text-stone" aria-hidden="true" />
                    Account settings
                  </Link>
                  <button role="menuitem" onClick={handleSignOut} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-ink-soft hover:bg-signal-50 hover:text-signal">
                    <LogOut className="h-4 w-4 text-stone" aria-hidden="true" />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>

          <button
            ref={menuButtonRef}
            onClick={() => setMenuOpen(true)}
            aria-label="Open workspace menu"
            aria-expanded={menuOpen}
            className="ml-auto flex h-11 w-11 items-center justify-center rounded-xl text-ink-soft hover:bg-paper-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal xl:hidden"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </header>

      {menuOpen && (
        <div className="fixed inset-0 z-50 xl:hidden" role="dialog" aria-modal="true" aria-label="Workspace menu">
          <button className="absolute inset-0 bg-forest-900/55 backdrop-blur-sm" onClick={() => setMenuOpen(false)} aria-label="Close workspace menu" />
          <div className="absolute inset-x-3 top-3 max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-3xl border border-sand bg-card p-3 shadow-2xl sm:left-auto sm:w-[420px]">
            <div className="flex items-center gap-2 border-b border-sand px-2 pb-3">
              <LzLogo />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{account.name || 'LeadZipp workspace'}</p>
                <p className="truncate text-xs text-stone">{account.email || `${planLabel} plan`}</p>
              </div>
              <button ref={closeButtonRef} onClick={() => setMenuOpen(false)} aria-label="Close workspace menu" className="flex h-11 w-11 items-center justify-center rounded-xl text-stone hover:bg-paper-2 hover:text-ink">
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <nav className="grid gap-1 py-3 sm:grid-cols-2" aria-label="Mobile workspace navigation">
              {mobileItems.map((item) => (
                <NavLink key={item.href} item={item} pathname={pathname} compact onClick={() => setMenuOpen(false)} />
              ))}
            </nav>
            <button onClick={handleSignOut} className="flex w-full items-center gap-2 rounded-xl border-t border-sand px-3 py-3 text-left text-sm font-medium text-ink-soft hover:bg-signal-50 hover:text-signal">
              <LogOut className="h-4 w-4 text-stone" aria-hidden="true" />
              Sign out
            </button>
          </div>
        </div>
      )}

      <main id="main-content" className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8 lg:py-7" tabIndex={-1}>
        {children}
      </main>
    </div>
  )
}
