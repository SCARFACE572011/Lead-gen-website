import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LogoutButton } from './LogoutButton'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Top nav */}
      <header className="h-14 bg-white border-b border-[#E2E8F0] flex items-center justify-between px-6 sticky top-0 z-30">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#0369A1] to-[#0F172A] flex items-center justify-center">
            <span className="text-white text-xs font-bold">LZ</span>
          </div>
          <span className="text-sm font-bold text-[#0F172A]">LeadZip Owner</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-[#64748B]">{user.email}</span>
          <LogoutButton />
        </div>
      </header>
      <main className="p-6">{children}</main>
    </div>
  )
}
