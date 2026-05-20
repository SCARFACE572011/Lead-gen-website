'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTheme } from 'next-themes'
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
  Sun,
  Moon,
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

function DarkModeToggle() {
  const { theme, setTheme } = useTheme()
  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      aria-label="Toggle dark mode"
      className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
    >
      <Sun className="h-4 w-4 shrink-0 hidden dark:block" />
      <Moon className="h-4 w-4 shrink-0 dark:hidden" />
    </button>
  )
}

const PLAN_COLORS: Record<string, string> = {
  Pro: 'bg-blue-100 text-blue-700',
  Starter: 'bg-slate-100 text-slate-600',
  Enterprise: 'bg-violet-100 text-violet-700',
}

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

function SidebarContent({ pathname, onLinkClick }: SidebarContentProps) {
  const [isAdmin, setIsAdmin] = useState<boolean>(MOCK_PROFILE.role === 'admin')
  const [plan, setPlan] = useState<string>(MOCK_PROFILE.plan)

  useEffect(() => {
    if (!isSupabaseConfigured) return
    async function fetchRole() {
      try {
        const { createClient } = await import('@/lib/supabase/client')
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data } = await supabase
          .from('users_profile')
          .select('role, plan')
          .eq('id', user.id)
          .maybeSingle()
        if (data) {
          setIsAdmin(data.role === 'admin')
          setPlan(data.plan ?? 'free')
        }
      } catch { /* non-fatal */ }
    }
    fetchRole()
  }, [])

  const navItems = isAdmin ? [...NAV_ITEMS, ADMIN_ITEM] : NAV_ITEMS
  const planColorClass = PLAN_COLORS[plan] ?? 'bg-slate-100 text-slate-600'

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-5 border-b border-slate-100">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 shrink-0">
          <MapPin className="h-4.5 w-4.5 text-white" aria-hidden="true" />
        </div>
        <span className="text-lg font-bold tracking-tight text-slate-900">LeadZip</span>
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
                    'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  )}
                >
                  <Icon
                    className={cn(
                      'h-4 w-4 shrink-0 transition-colors',
                      isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-700'
                    )}
                    aria-hidden="true"
                  />
                  {item.label}
                  {isActive && (
                    <ChevronRight className="ml-auto h-3.5 w-3.5 text-white/60" aria-hidden="true" />
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* User footer */}
      <div className="border-t border-slate-100 px-3 py-4">
        <div className="flex items-center gap-3 rounded-lg p-2">
          {/* Avatar */}
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
            {MOCK_PROFILE.avatarInitials}
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-semibold text-slate-800">
              {MOCK_PROFILE.fullName}
            </span>
            <span
              className={cn(
                'mt-0.5 inline-block w-fit rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                planColorClass
              )}
            >
              {plan}
            </span>
          </div>
          <DarkModeToggle />
          <button
            aria-label="Sign out"
            onClick={handleSignOut}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
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

  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [drawerOpen])

  return (
    <div className="flex h-dvh overflow-hidden bg-slate-50">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
        <SidebarContent pathname={pathname} />
      </aside>

      {/* Mobile drawer backdrop — always rendered, opacity-toggled */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden transition-opacity duration-300',
          drawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        aria-hidden="true"
        onClick={() => setDrawerOpen(false)}
      />

      {/* Mobile drawer */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-60 bg-white transition-transform duration-300 ease-in-out will-change-transform lg:hidden',
          drawerOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full'
        )}
        aria-label="Mobile navigation"
        aria-modal="true"
        role="dialog"
        aria-hidden={!drawerOpen}
        onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; touchCurrentX.current = e.touches[0].clientX }}
        onTouchMove={(e) => { touchCurrentX.current = e.touches[0].clientX }}
        onTouchEnd={() => {
          const delta = touchStartX.current - touchCurrentX.current
          if (delta > 60) setDrawerOpen(false)
          touchStartX.current = 0
          touchCurrentX.current = 0
        }}
      >
        <div className="absolute right-3 top-4">
          <button
            onClick={() => setDrawerOpen(false)}
            aria-label="Close navigation"
            className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
          >
            <X className="h-4 w-4 shrink-0" />
          </button>
        </div>
        <SidebarContent pathname={pathname} onLinkClick={() => setDrawerOpen(false)} />
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile topbar */}
        <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation menu"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <Menu className="h-5 w-5 shrink-0" />
          </button>
          <div className="flex flex-1 items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-blue-600 shrink-0">
              <MapPin className="h-3.5 w-3.5 text-white" aria-hidden="true" />
            </div>
            <span className="text-base font-bold text-slate-900">LeadZip</span>
          </div>
          <DarkModeToggle />
        </header>

        {/* Page content */}
        <main
          id="main-content"
          className="flex-1 overflow-y-auto p-6 md:p-8"
          tabIndex={-1}
        >
          {children}
        </main>
      </div>
    </div>
  )
}
