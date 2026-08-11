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
    <div className="mx-auto max-w-7xl space-y-7">
      {/* Payment success banner */}
      {paymentSuccess && (
        <div className="flex items-center gap-3 rounded-2xl border border-lime/50 bg-lime/15 px-5 py-4">
          <span className="text-lg" aria-hidden="true">🎉</span>
          <p className="text-sm font-semibold text-forest">
            Welcome to Pro! Your plan is now active.
          </p>
        </div>
      )}

      {/* Page header */}
      <div className="grain relative overflow-hidden rounded-3xl border border-sand bg-card p-6 map-grid sm:p-7">
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="readout text-signal">{greeting}</span>
            <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-ink sm:text-[2rem]">
              Welcome back, {firstName}
            </h1>
            <p className="mt-1.5 text-sm text-ink-soft">
              Here&apos;s what&apos;s happening with your leads today.
            </p>
          </div>
          <Link
            href="/search"
            className="inline-flex items-center gap-2 self-start rounded-full bg-signal px-5 py-3 text-sm font-semibold text-white transition-all hover:bg-signal-600 active:scale-95 sm:self-auto"
          >
            <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
            Search new leads
          </Link>
        </div>
      </div>

      {/* Stats row */}
      <StatsCards stats={stats} />

      {/* Two-column section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Recent Searches (60%) */}
        <div className="lg:col-span-3">
          <div className="rounded-2xl border border-sand bg-card">
            <div className="flex items-center justify-between border-b border-sand px-5 py-4">
              <h2 className="font-display text-base font-bold text-ink">Recent searches</h2>
              <Link
                href="/history"
                className="text-xs font-semibold text-signal transition-colors hover:text-signal-600"
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
          <div className="rounded-2xl border border-sand bg-card">
            <div className="border-b border-sand px-5 py-4">
              <h2 className="font-display text-base font-bold text-ink">Leads by category</h2>
              <p className="readout mt-1 text-stone">Based on recent searches</p>
            </div>
            <div className="px-4 pb-4 pt-3">
              <LeadChart data={CHART_DATA} />
            </div>
          </div>
        </div>
      </div>

      {/* Compliance / Tips card */}
      <div className="rounded-2xl border border-sand bg-paper-2 p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-forest text-lime">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h3 className="font-display text-sm font-bold text-ink">Compliance notice</h3>
            <p className="mt-1 text-sm leading-relaxed text-ink-soft">
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
