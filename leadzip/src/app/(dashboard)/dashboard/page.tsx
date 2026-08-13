import Link from 'next/link'
import { Search, ShieldCheck } from 'lucide-react'
import { StatsCards } from '@/components/dashboard/StatsCards'
import { LeadChart } from '@/components/dashboard/LeadChart'
import { DashboardRecentSearches } from '@/components/dashboard/DashboardRecentSearches'
import { MOCK_PROFILE } from '@/lib/mock-auth'
import { TrialStartedTracker, type BillingPeriod } from '@/lib/analytics'
import { SearchHistory } from '@/types/lead'

// A period longer than this is an annual subscription. Stripe's success_url
// carries the plan but not the billing period, so it is derived from the synced
// subscription row instead.
const ANNUAL_PERIOD_THRESHOLD_MS = 45 * 24 * 60 * 60 * 1000

/**
 * Keep arbitrary query-string values out of the dataLayer. Only the plans we
 * actually sell are reported; anything else becomes 'unknown'.
 */
function normalizePlan(value: string | null | undefined): string {
  return value === 'pro' || value === 'agency' ? value : 'unknown'
}

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
  searchParams: Promise<{
    payment?: string
    session_id?: string
    plan?: string
    billing?: string
  }>
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const params = await searchParams
  const paymentSuccess = params.payment === 'success'
  const checkoutSessionId = params.session_id ?? null
  const greeting = getGreeting()

  // Feeds the trial_started conversion. Seeded from the success_url, then
  // upgraded with whatever Stripe and the synced subscription row confirm.
  let conversionPlan = normalizePlan(params.plan)
  // Checkout puts the real billing period on the success URL, so trust it and
  // only fall back to inferring one from the subscription period length below.
  let conversionBilling: BillingPeriod =
    params.billing === 'annual' || params.billing === 'monthly' ? params.billing : 'unknown'

  // Mock data is ONLY acceptable when Supabase is not configured (local/dev
  // without a backend). A real logged-in user must never see fabricated numbers.
  let stats = MOCK_STATS
  let searches: SearchHistory[] = MOCK_SEARCHES
  let firstName = MOCK_PROFILE.fullName.split(' ')[0]

  if (isSupabaseConfigured) {
    // Real instance: start from a clean zero/empty state and only overwrite
    // with the user's real rows below.
    stats = { totalLeads: 0, savedLeads: 0, exportedLeads: 0, searchesThisMonth: 0 }
    searches = []
    firstName = 'there'
    try {
      const { createClient } = await import('@/lib/supabase/server')
      const supabase = await createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      const userId = user?.id

      // Webhook-free subscription activation: when a buyer returns from Stripe
      // Checkout (?payment=success&session_id=...), verify the session and
      // upgrade their plan here — no webhook endpoint required. Idempotent and
      // non-fatal; runs before the profile read so the new plan shows at once.
      if (userId && paymentSuccess && checkoutSessionId) {
        try {
          const { confirmCheckoutSession } = await import('@/lib/stripe/subscriptionSync')
          const confirmed = await confirmCheckoutSession(checkoutSessionId, userId)
          if (confirmed.plan) conversionPlan = normalizePlan(confirmed.plan)
        } catch {
          // Non-fatal — the Stripe webhook (if configured) is the backstop.
        }

        // Resolve the billing period for the conversion event from the row the
        // confirm step just wrote. Purely for reporting: a failure here degrades
        // the event to billing:'unknown' and nothing else.
        try {
          const { data: sub } = await supabase
            .from('subscriptions')
            .select('plan, current_period_start, current_period_end')
            .eq('user_id', userId)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          if (sub?.plan) conversionPlan = normalizePlan(sub.plan)

          if (conversionBilling === 'unknown') {
            const start = Date.parse(sub?.current_period_start ?? '')
            const end = Date.parse(sub?.current_period_end ?? '')
            if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
              conversionBilling =
                end - start > ANNUAL_PERIOD_THRESHOLD_MS ? 'annual' : 'monthly'
            }
          }
        } catch {
          // Leave billing as 'unknown'.
        }
      }

      if (userId) {
        // usage_limits / users_profile use .maybeSingle(): a brand-new user has
        // no row yet, and .single() errors on zero rows (which previously left
        // the mock 847/23/5/12 numbers in place). Every metric defaults to 0.
        const [usageRes, searchRes, profileRes, totalsRes] = await Promise.all([
          supabase
            .from('usage_limits')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle(),
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
            .maybeSingle(),
          supabase
            .from('search_history')
            .select('result_count')
            .eq('user_id', userId),
        ])

        // "Total leads found" is a real aggregate: the sum of result counts
        // across every search this user has run (0 when they've run none) —
        // never the old searches_this_month * 10 fabrication.
        const totalLeads = (totalsRes.data ?? []).reduce(
          (sum, r) => sum + (r.result_count ?? 0),
          0,
        )

        stats = {
          totalLeads,
          savedLeads: usageRes.data?.saved_leads_count ?? 0,
          exportedLeads: usageRes.data?.exports_count ?? 0,
          searchesThisMonth: usageRes.data?.searches_this_month ?? 0,
        }

        // Real recent searches, otherwise the empty state — never MOCK_SEARCHES.
        searches = (searchRes.data ?? []).map((s) => ({
          id: s.id,
          userId: s.user_id,
          zipCode: s.zip_code,
          category: s.category ?? '',
          radius: s.radius ?? 25,
          keyword: s.keyword ?? '',
          resultCount: s.result_count ?? 0,
          createdAt: s.created_at,
        }))

        const fullName = profileRes.data?.full_name || user?.email || ''
        firstName =
          fullName.split(' ')[0] ||
          (user?.email ? user.email.split('@')[0] : 'there')
      }
    } catch {
      // Non-fatal — keep the clean zero/empty state (set above); a configured
      // instance must not fall back to fabricated numbers.
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
    : isSupabaseConfigured
      ? [] // Real user with no searches yet → LeadChart shows its empty state.
      : CHART_FALLBACK

  return (
    <div className="mx-auto max-w-7xl space-y-7">
      {/* Primary conversion. Renders nothing; fires trial_started on the client
          exactly once per Stripe Checkout session (deduped on session_id), so a
          refresh or a revisit with ?payment=success still attached is silent. */}
      {paymentSuccess && (
        <TrialStartedTracker
          sessionId={checkoutSessionId}
          plan={conversionPlan}
          billing={conversionBilling}
        />
      )}

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
            <span className="text-sm font-semibold text-signal">{greeting}</span>
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
              <p className="mt-1 text-xs text-stone">Based on recent searches</p>
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
