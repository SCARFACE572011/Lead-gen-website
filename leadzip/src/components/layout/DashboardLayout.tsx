'use client'

import { useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Menu } from 'lucide-react'
import { Toaster } from 'sonner'
import Sidebar from './Sidebar'
import { MOCK_PROFILE } from '@/lib/mock-auth'

interface DashboardLayoutProps {
  children: React.ReactNode
  currentPath?: string
}

export default function DashboardLayout({ children, currentPath }: DashboardLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const hamburgerRef = useRef<HTMLButtonElement>(null)
  const pathname = usePathname()
  const activePath = currentPath ?? pathname ?? '/dashboard'

  const user = {
    name: MOCK_PROFILE.fullName,
    email: MOCK_PROFILE.email,
    plan: MOCK_PROFILE.plan,
    role: MOCK_PROFILE.role,
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Sidebar */}
      <Sidebar
        currentPath={activePath}
        user={user}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        triggerRef={hamburgerRef}
      />

      {/* Main content area — offset by sidebar width on desktop */}
      <div className="lg:pl-60">
        {/* Mobile top bar */}
        <header className="lg:hidden sticky top-0 z-20 flex items-center gap-3 px-4 py-3 bg-white border-b border-[#E2E8F0]">
          <button
            ref={hamburgerRef}
            onClick={() => setMobileOpen(true)}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Open navigation"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-[#0F172A] flex items-center justify-center">
              <svg
                className="w-3.5 h-3.5 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z"
                />
              </svg>
            </div>
            <span className="text-[#0F172A] font-bold text-base tracking-tight">LeadZip</span>
          </div>
        </header>

        {/* Page content */}
        <main className="min-h-screen">
          <div className="px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>

      {/* Toast notifications */}
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            fontFamily: '"Plus Jakarta Sans", sans-serif',
            fontSize: '14px',
          },
        }}
      />
    </div>
  )
}
