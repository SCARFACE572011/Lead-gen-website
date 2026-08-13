'use client'

import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import {
  LayoutDashboard,
  Search,
  Bookmark,
  Clock,
  Download,
  Settings,
  Wrench,
  MapPin,
  LogOut,
  ChevronRight,
  TrendingUp,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard',      href: '/dashboard',        icon: LayoutDashboard },
  { label: 'Search Leads',   href: '/search',           icon: Search },
  { label: 'Market Gaps',    href: '/market-gaps',      icon: TrendingUp },
  { label: 'Saved Leads',    href: '/saved',            icon: Bookmark },
  { label: 'Search History', href: '/history',          icon: Clock },
  { label: 'Exports',        href: '/exports',          icon: Download },
  { label: 'Settings',       href: '/settings',         icon: Settings },
]

const ADMIN_ITEMS: NavItem[] = [
  { label: 'Admin Panel', href: '/admin', icon: Wrench },
]

interface SidebarProps {
  currentPath: string
  user: {
    name: string
    email: string
    plan: string
    role: string
  }
  mobileOpen?: boolean
  onMobileClose?: () => void
  triggerRef?: React.RefObject<HTMLButtonElement | null>
}

function NavLink({
  item,
  isActive,
  onClick,
}: {
  item: NavItem
  isActive: boolean
  onClick?: () => void
}) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
        isActive
          ? 'bg-signal-50 text-signal'
          : 'text-ink-soft hover:bg-paper-2 hover:text-ink',
      )}
    >
      <Icon className={cn('w-4 h-4 flex-shrink-0', isActive ? 'text-signal' : 'text-stone')} />
      <span>{item.label}</span>
      {isActive && <ChevronRight className="w-3.5 h-3.5 ml-auto text-signal/70" />}
    </Link>
  )
}

function SidebarContent({
  currentPath,
  user,
  onLinkClick,
}: {
  currentPath: string
  user: SidebarProps['user']
  onLinkClick?: () => void
}) {
  const [searchCount, setSearchCount] = useState(0)
  const [workspaceName, setWorkspaceName] = useState<string | null>(null)

  useEffect(() => {
    try {
      const history = JSON.parse(localStorage.getItem('leadzip_search_history') ?? '[]')
      const now = new Date()
      const thisMonth = history.filter((h: { createdAt: string }) => {
        const d = new Date(h.createdAt)
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
      })
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSearchCount(thisMonth.length)
    } catch {}
  }, [])

  useEffect(() => {
    fetch('/api/workspace')
      .then(r => r.json())
      .then(d => { if (d.workspace?.name) setWorkspaceName(d.workspace.name) })
      .catch(() => {})
  }, [])

  const initials = user.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-sand">
        <Link
          href="/dashboard"
          onClick={onLinkClick}
          className="flex items-center gap-2.5 group"
        >
          <span className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-signal flex-shrink-0 shadow-sm transition-transform duration-200 group-hover:scale-105">
            <MapPin className="w-4 h-4 text-white" />
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-lime ring-2 ring-card" />
          </span>
          <div className="flex flex-col leading-none">
            <span className="font-display text-ink font-extrabold text-lg tracking-tight">LeadZipp</span>
          </div>
        </Link>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(item => (
          <NavLink
            key={item.href}
            item={item}
            isActive={
              item.href === '/dashboard'
                ? currentPath === '/dashboard' || currentPath === '/'
                : currentPath.startsWith(item.href)
            }
            onClick={onLinkClick}
          />
        ))}

        {/* Admin Section */}
        {user.role === 'admin' && (
          <div className="pt-4">
            <p className="px-3 pb-1.5 text-[10px] font-semibold tracking-widest uppercase text-stone">
              Admin
            </p>
            {ADMIN_ITEMS.map(item => (
              <NavLink
                key={item.href}
                item={item}
                isActive={currentPath.startsWith(item.href)}
                onClick={onLinkClick}
              />
            ))}
          </div>
        )}
      </nav>

      {/* Usage Counter */}
      <div className="px-3 py-3 mx-2 mb-2 rounded-xl bg-paper-2 border border-sand">
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs text-stone">Searches this month</span>
          <span className="font-mono text-xs font-medium text-ink">{searchCount}/25</span>
        </div>
        <div className="w-full h-1.5 bg-sand rounded-full overflow-hidden">
          <div className="h-full bg-signal rounded-full transition-all" style={{ width: `${Math.min((searchCount / 25) * 100, 100)}%` }} />
        </div>
        <p className="text-xs text-stone mt-1">Free plan · 25 searches/mo</p>
      </div>

      {/* User Profile Footer */}
      <div className="px-3 py-4 border-t border-sand">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-paper-2 transition-colors cursor-default">
          {/* Avatar */}
          <div className="w-8 h-8 rounded-lg bg-signal flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-semibold">{initials}</span>
          </div>
          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-semibold text-ink truncate">{user.name}</p>
              {user.plan === 'pro' && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-signal-50 text-signal text-[10px] font-semibold tracking-wide flex-shrink-0">
                  PRO
                </span>
              )}
              {user.plan === 'agency' && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-forest/10 text-forest text-[10px] font-semibold tracking-wide flex-shrink-0">
                  AGENCY
                </span>
              )}
            </div>
            <p className="text-xs text-stone truncate">{user.email}</p>
            {workspaceName && (
              <p className="text-[10px] text-forest font-medium truncate">Team: {workspaceName}</p>
            )}
          </div>
        </div>

        {/* Sign Out */}
        <button
          className="w-full mt-1 flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-stone hover:bg-red-50 hover:text-red-600 transition-all duration-150"
          onClick={async () => {
            try {
              const { createClient } = await import('@/lib/supabase/client')
              const supabase = createClient()
              await supabase.auth.signOut()
            } catch { /* ignore */ }
            window.location.href = '/login'
          }}
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  )
}

export default function Sidebar({
  currentPath,
  user,
  mobileOpen = false,
  onMobileClose,
  triggerRef,
}: SidebarProps) {
  const touchStartX = useRef(0)
  const touchCurrentX = useRef(0)
  const drawerCloseButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  useEffect(() => {
    if (mobileOpen) {
      drawerCloseButtonRef.current?.focus()
    } else {
      triggerRef?.current?.focus()
    }
  }, [mobileOpen, triggerRef])

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const handler = (e: MediaQueryListEvent) => {
      if (e.matches && onMobileClose) onMobileClose()
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [onMobileClose])

  return (
    <>
      {/* Desktop Sidebar — fixed left, always visible */}
      <aside
        className="hidden lg:flex flex-col fixed left-0 top-0 bottom-0 w-60 bg-card border-r border-sand z-30"
        style={{ boxShadow: '1px 0 0 #E7E1D4' }}
      >
        <SidebarContent currentPath={currentPath} user={user} />
      </aside>

      {/* Mobile Sidebar — always in DOM, animated with CSS transforms */}
      <>
        {/* Backdrop */}
        <div
          className={cn(
            'lg:hidden fixed inset-0 bg-ink/60 backdrop-blur-sm z-40 transition-opacity duration-300',
            mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          )}
          onClick={onMobileClose}
          aria-hidden="true"
        />

        {/* Drawer */}
        <aside
          className={cn(
            'lg:hidden fixed left-0 top-0 bottom-0 w-72 bg-card z-50 shadow-2xl',
            'transition-transform duration-300 ease-in-out will-change-transform',
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          )}
          onTouchStart={(e) => {
            const t = e.touches[0]
            if (!t) return
            touchStartX.current = t.clientX
            touchCurrentX.current = t.clientX
          }}
          onTouchMove={(e) => {
            const t = e.touches[0]
            if (!t) return
            touchCurrentX.current = t.clientX
          }}
          onTouchEnd={() => {
            const delta = touchStartX.current - touchCurrentX.current
            if (delta > 60 && onMobileClose) onMobileClose()
            touchStartX.current = 0
            touchCurrentX.current = 0
          }}
        >
          <button
            ref={drawerCloseButtonRef}
            onClick={onMobileClose}
            className="absolute top-4 right-4 w-11 h-11 flex items-center justify-center rounded-lg text-stone hover:text-ink hover:bg-paper-2 transition-colors z-10"
            aria-label="Close sidebar"
          >
            <X className="w-4 h-4" />
          </button>

          <SidebarContent
            currentPath={currentPath}
            user={user}
            onLinkClick={onMobileClose}
          />
        </aside>
      </>
    </>
  )
}
