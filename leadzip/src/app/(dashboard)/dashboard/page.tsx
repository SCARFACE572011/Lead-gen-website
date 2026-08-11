import Link from 'next/link'
import { Search, ShieldCheck } from 'lucide-react'
import { StatsCards } from '@/components/dashboard/StatsCards'
import { LeadChart } from '@/components/dashboard/LeadChart'
import { DashboardRecentSearches } from '@/components/dashboard/DashboardRecentSearches'
import { MOCK_PROFILE } from '@/lib/mock-auth'
import { SearchHistory } from '@/types/lead'

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

const MOCK_STATS = {
  totalLeads: 847,
  savedLeads: 23,
  exportedLeads: 5,
  searchesThisMonth: 12,
}

const MOCK_SEARCHES: SearchHistory[] = [
  {
    id: 'sh_001',
    userId: 'user_demo_001',
    zipCode: '90210',
    radius: 25,
    category: 'Restaurants',
    keyword: '',
    resultCount: 34,
    createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
  },
  {
    id: 'sh_002',
    userId: 'user_demo_001',
    zipCode: '10001',
    radius: 10,
    category: 'Dentists',
    keyword: '',
    resultCount: 18,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
  },
  {
    id: 'sh_003',
    userId: 'user_demo_001',
    zipCode: '60601',
    radius: 50,
    category: 'Contractors',
    keyword: 'remodeling',
    resultCount: 52,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 28).toISOString(),
  },
  {
    id: 'sh_004',
    userId: 'user_demo_001',
    zipCode: '77001',
    radius: 25,
    category: 'HVAC Services',
    keyword: '',
    resultCount: 9,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
  },
  {
    id: 'sh_005',
    userId: 'user_demo_001',
    zipCode: '85001',
    radius: 100,
    category: 'Hair & Beauty Salons',
    keyword: '',
    resultCount: 87,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 120).toISOString(),
  },
]

const CHART_FALLBACK = [
  { name: 'Restaurants', value: 45 },
  { name: 'Contractors', value: 38 },
  { name: 'Salons', value: 22 },
  { name: 'Dentists', value: 18 },
  { name: 'Auto Shops', value: 15 },
]

const isSupabaseConfigured =
  process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder.supabase.co'

interface PageProps {
  searchParams: Promise<{ payment?: string }>
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const params = await searchParams
  const paymentSuccess = params.payment === 'success'
  const greeting = getGreeting()

  let stats = MOCK_STATS
  let searches: SearchHistory[] = MOCK_SEARCHES
  let firstName = MOCK_PROFILE.fullName.split(' ')[0]

  if (isSupabaseConfigured) {
    try {
      const { createClient } = await import('@/lib/supabase/server')
      const supabase = await createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      const userId = user?.id

      if (userId) {
        const [usageRes, searchRes, profileRes] = await Promise.all([
          supabase
            .from('usage_limits')
            .select('*')
            .eq('user_id', userId)
            .single(),
          supabase
            .from('search_history')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(5),
          supabase
            .from('users_profile')
            .select('*')
            .eq('id', userId)
            .single(),
        ])

        if (usageRes.data) {
          stats = {
            totalLeads: (usageRes.data.searches_this_month ?? 0) * 10,
            savedLeads: usageRes.data.saved_leads_count ?? 0,
            exportedLeads: usageRes.data.exports_count ?? 0,
            searchesThisMonth: usageRes.data.searches_this_month ?? 0,
          }
        }

        if (searchRes.data && searchRes.data.length > 0) {
          searches = searchRes.data.map((s) => ({
            id: s.id,
            userId: s.user_id,
            zipCode: s.zip_code,
            category: s.category ?? '',
            radius: s.radius ?? 25,
            keyword: s.keyword ?? '',
            resultCount: s.result_count ?? 0,
            createdAt: s.created_at,
          }))
        }

        if (profileRes.data) {
          const fullName =
            profileRes.data.full_name || user?.email || 'User'
          firstName = fullName.split(' ')[0]
        } else if (user?.email) {
          firstName = user.email.split('@')[0]
        }
      }
    } catch {
      // Non-fatal — fall back to mock data
    }
  }

  const categoryCount: Record<string, number> = {}
  for (const s of searches) {
    if (s.category) categoryCount[s.category] = (categoryCount[s.category] ?? 0) + (s.resultCount || 1)
  }
  const CHART_DATA = Object.entries(categoryCount).length > 0
    ? Object.entries(categoryCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([name, value]) => ({ name, value }))
    : CHART_FALLBACK

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      {/* Payment success banner */}
      {paymentSuccess && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4">
          <span className="text-lg" aria-hidden="true">🎉</span>
          <p className="text-sm font-semibold text-emerald-800">
            Welcome to Pro! Your plan is now active.
          </p>
        </div>
      )}

      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {greeting}, {firstName}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Here&apos;s what&apos;s happening with your leads today.
          </p>
        </div>
        <Link
          href="/search"
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-blue-700 hover:shadow-md active:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        >
          <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
          Search New Leads
        </Link>
      </div>

      {/* Stats row */}
      <StatsCards stats={stats} />

      {/* Two-column section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Recent Searches (60%) */}
        <div className="lg:col-span-3">
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="text-sm font-semibold text-slate-800">Recent Searches</h2>
              <Link
                href="/history"
                className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
              >
                View all
              </Link>
            </div>
            <div className="px-4 py-2">
              <DashboardRecentSearches searches={searches} />
            </div>
          </div>
        </div>

        {/* Lead Quality Chart (40%) */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="text-sm font-semibold text-slate-800">Leads by Category</h2>
              <p className="mt-0.5 text-xs text-slate-400">Based on recent searches</p>
            </div>
            <div className="px-4 pb-4 pt-3">
              <LeadChart data={CHART_DATA} />
            </div>
          </div>
        </div>
      </div>

      {/* Compliance / Tips card */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100">
            <ShieldCheck className="h-5 w-5 text-amber-700" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-amber-900">Compliance Notice</h3>
            <p className="mt-1 text-sm leading-relaxed text-amber-800">
              LeadZipp provides publicly available business data for prospecting purposes.
              Always comply with CAN-SPAM, TCPA, and local regulations when contacting leads.
              Do not contact businesses on the National Do Not Call Registry without prior consent.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
