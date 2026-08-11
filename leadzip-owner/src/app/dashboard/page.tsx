'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { StatCard } from '@/components/StatCard'
import { UserDetailSheet } from '@/components/UserDetailSheet'
import { RefreshCw, Download, Search, ChevronUp, ChevronDown, ExternalLink, Loader2, Copy, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PLAN_PRICES } from '@/lib/pricing'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import type { UserRow, AdminAction, BillingSubscription } from '@/types'

const PLAN_COLORS: Record<string, string> = { free: '#94A3B8', pro: '#0369A1', agency: '#F59E0B' }
const STRIPE_STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700',
  trialing: 'bg-blue-50 text-blue-700',
  past_due: 'bg-orange-50 text-orange-700',
  cancelled: 'bg-red-50 text-red-700',
  canceled: 'bg-red-50 text-red-700',
}

function cap(s: string) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : '' }
function fmtDate(d: string) { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }
function fmtMoney(n: number) { return `$${n.toLocaleString('en-US', { minimumFractionDigits: 0 })}` }

// ─────────────────────────────────────────────────────────────────────────────
// Badges
// ─────────────────────────────────────────────────────────────────────────────

function PlanBadge({ plan }: { plan: string }) {
  const s: Record<string, string> = { free: 'bg-slate-100 text-slate-600', pro: 'bg-blue-50 text-blue-700', agency: 'bg-amber-50 text-amber-700' }
  return <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', s[plan] ?? s.free)}>{cap(plan)}</span>
}

function StripeBadge({ status }: { status: string }) {
  return (
    <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', STRIPE_STATUS_COLORS[status] ?? 'bg-slate-100 text-slate-600')}>
      {cap(status.replace('_', ' '))}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full',
      status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700')}>
      {cap(status)}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Copy button
// ─────────────────────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={copy} className="text-slate-400 hover:text-slate-600 transition-colors ml-1">
      {copied ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main dashboard
// ─────────────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [currentUserId, setCurrentUserId] = useState('')
  const [stats, setStats] = useState<Record<string, unknown> | null>(null)
  const [users, setUsers] = useState<{ users: UserRow[]; total: number; page: number; totalPages: number } | null>(null)
  const [billing, setBilling] = useState<{ subscriptions: BillingSubscription[]; summary: Record<string, number> } | null>(null)
  const [atRisk, setAtRisk] = useState<Record<string, unknown[]> | null>(null)
  const [analytics, setAnalytics] = useState<Record<string, unknown> | null>(null)
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null)
  const [usersLoaded, setUsersLoaded] = useState(false)
  const [billingLoaded, setBillingLoaded] = useState(false)
  const [atRiskLoaded, setAtRiskLoaded] = useState(false)
  const [analyticsLoaded, setAnalyticsLoaded] = useState(false)
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [billingStatusFilter, setBillingStatusFilter] = useState('')
  const [localSearch, setLocalSearch] = useState('')

  const [usersQuery, setUsersQuery] = useState({
    page: 1, search: '', plan: '', status: '', sort: 'created_at', order: 'desc'
  })
  const searchRef = useRef<string>('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Get current user
  useEffect(() => {
    fetch('/api/users?limit=1&page=1')
      .then(r => r.json())
      .catch(() => null)
    // get session user id via supabase client
    import('@/lib/supabase/client').then(({ createClient }) => {
      createClient().auth.getUser().then(({ data }) => {
        if (data.user) setCurrentUserId(data.user.id)
      })
    })
  }, [])

  // Load overview stats
  useEffect(() => {
    fetch('/api/stats').then(r => r.json()).then(setStats).catch(() => null)
  }, [])

  const loadUsers = useCallback(async (query: typeof usersQuery) => {
    setLoadingUsers(true)
    const params = new URLSearchParams({
      page: String(query.page), limit: '25',
      ...(query.search && { search: query.search }),
      ...(query.plan && { plan: query.plan }),
      ...(query.status && { status: query.status }),
      sort: query.sort, order: query.order,
    })
    const data = await fetch(`/api/users?${params}`).then(r => r.json()).catch(() => null)
    setUsers(data)
    setLoadingUsers(false)
  }, [])

  const loadBilling = useCallback(async (statusFilter: string) => {
    const params = statusFilter ? `?status=${statusFilter}` : ''
    const data = await fetch(`/api/billing${params}`).then(r => r.json()).catch(() => null)
    setBilling(data)
  }, [])

  function handleTabChange(tab: string) {
    if (tab === 'users' && !usersLoaded) { setUsersLoaded(true); loadUsers(usersQuery) }
    if (tab === 'billing' && !billingLoaded) { setBillingLoaded(true); loadBilling('') }
    if (tab === 'atrisk' && !atRiskLoaded) {
      setAtRiskLoaded(true)
      fetch('/api/at-risk').then(r => r.json()).then(setAtRisk).catch(() => null)
    }
    if (tab === 'analytics' && !analyticsLoaded) {
      setAnalyticsLoaded(true)
      fetch('/api/analytics').then(r => r.json()).then(setAnalytics).catch(() => null)
    }
  }

  function handleSearchChange(value: string) {
    searchRef.current = value
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const next = { ...usersQuery, search: searchRef.current, page: 1 }
      setUsersQuery(next)
      loadUsers(next)
    }, 300)
  }

  function handleSort(col: string) {
    const next = { ...usersQuery, sort: col, order: usersQuery.sort === col && usersQuery.order === 'asc' ? 'desc' : 'asc', page: 1 }
    setUsersQuery(next)
    loadUsers(next)
  }

  async function handleUserAction(userId: string, action: AdminAction) {
    const res = await fetch(`/api/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: action.type, ...(action as Record<string, unknown>) }),
    })
    if (!res.ok) return
    const { user: updated } = await res.json()
    if (updated) {
      setUsers(prev => prev ? {
        ...prev,
        users: prev.users.map(u => u.id === userId ? { ...u, ...updated } : u)
      } : prev)
      setSelectedUser(prev => prev?.id === userId ? { ...prev, ...updated } : prev)
    }
  }

  async function handleDeactivateUser(userId: string) {
    await handleUserAction(userId, { type: 'set_status', status: 'deactivated' })
    if (atRisk) {
      setAtRisk(prev => prev ? {
        ...prev,
        pastDue: (prev.pastDue as Record<string, unknown>[]).map(u => (u as Record<string, unknown>).id === userId ? { ...u as Record<string, unknown>, user_status: 'deactivated' } : u)
      } : prev)
    }
  }

  async function handleDeactivateAllPastDue() {
    const pastDue = (atRisk?.pastDue ?? []) as Record<string, unknown>[]
    const active = pastDue.filter(u => u.user_status !== 'deactivated')
    await Promise.all(active.map(u => handleDeactivateUser(u.id as string)))
    fetch('/api/at-risk').then(r => r.json()).then(setAtRisk).catch(() => null)
  }

  function handleExportCsv() {
    const params = new URLSearchParams({
      ...(usersQuery.search && { search: usersQuery.search }),
      ...(usersQuery.plan && { plan: usersQuery.plan }),
      ...(usersQuery.status && { status: usersQuery.status }),
    })
    window.open(`/api/users/export?${params}`, '_blank')
  }

  const metrics = (stats?.metrics ?? {}) as Record<string, number>
  const alertFeed = (stats?.alertFeed ?? {}) as Record<string, number>

  // ───────────────────────────────────────────────────────────────────────────
  // Overview tab
  // ───────────────────────────────────────────────────────────────────────────

  function renderOverview() {
    const signupTrend = (stats?.signupTrend ?? []) as { date: string; count: number }[]
    const planDist = (stats?.planDistribution ?? {}) as Record<string, number>
    const total = planDist.free + planDist.pro + planDist.agency || 1
    const pieData = [
      { name: 'Free', value: planDist.free ?? 0 },
      { name: 'Pro', value: planDist.pro ?? 0 },
      { name: 'Agency', value: planDist.agency ?? 0 },
    ]

    if (!stats) return <Spinner />

    return (
      <div className="space-y-6">
        {/* Metric cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          <StatCard title="Total Users" value={metrics.totalUsers?.toLocaleString() ?? '—'} subtitle={`+${metrics.growthPct ?? 0}% vs last month`} />
          <StatCard title="MRR" value={fmtMoney(metrics.mrr ?? 0)} accent="blue" />
          <StatCard title="ARR" value={fmtMoney(metrics.arr ?? 0)} accent="blue" />
          <StatCard title="Active Subs" value={(metrics.activeSubscribers ?? 0).toLocaleString()} accent="green" />
          <StatCard title="Churn Rate" value={`${metrics.churnRate ?? 0}%`} subtitle="last 30 days" />
          <StatCard title="New Today" value={(metrics.newSignupsToday ?? 0).toLocaleString()} subtitle={`${metrics.newSignupsThisMonth ?? 0} this month`} />
        </div>

        {/* Alert feed */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-5">
          <h3 className="text-sm font-bold text-[#0F172A] mb-4">Alert Feed</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <AlertCard color="red" emoji="🔴" label="Past Due" count={alertFeed.pastDueCount ?? 0} note="payment failed" />
            <AlertCard color="yellow" emoji="🟡" label="Trials Expiring" count={alertFeed.trialsExpiring ?? 0} note="in ≤7 days" />
            <AlertCard color="orange" emoji="🟠" label="Cancelled" count={alertFeed.cancelledToday ?? 0} note="last 24h" />
            <AlertCard color="green" emoji="🟢" label="New Paid" count={alertFeed.newPaidToday ?? 0} note="today" />
          </div>
        </div>

        {/* Signup trend + plan dist */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-white rounded-xl border border-[#E2E8F0] p-5">
            <h3 className="text-sm font-bold text-[#0F172A] mb-4">New Signups — Last 30 Days</h3>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={signupTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94A3B8' }} tickFormatter={d => d.slice(5)} interval={6} />
                <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="count" stroke="#0369A1" strokeWidth={2} dot={false} name="Signups" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-5">
            <h3 className="text-sm font-bold text-[#0F172A] mb-4">Plan Distribution</h3>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value">
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={PLAN_COLORS[entry.name.toLowerCase()] ?? '#94A3B8'} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-2 space-y-1">
              {pieData.map(p => (
                <div key={p.name} className="flex justify-between text-xs">
                  <span className="text-slate-500">{p.name}</span>
                  <span className="font-medium text-[#0F172A]">{p.value} ({Math.round((p.value / total) * 100)}%)</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Users tab
  // ───────────────────────────────────────────────────────────────────────────

  function renderUsers() {
    return (
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={localSearch}
              onChange={e => { setLocalSearch(e.target.value); handleSearchChange(e.target.value) }}
              placeholder="Search by email or name..."
              className="w-full pl-9 pr-3 h-9 rounded-lg border border-[#E2E8F0] bg-white text-sm text-[#0F172A] placeholder:text-slate-400 outline-none focus:border-[#0369A1] focus:ring-1 focus:ring-[#0369A1]/20"
            />
          </div>
          <select value={usersQuery.plan} onChange={e => { const next = { ...usersQuery, plan: e.target.value, page: 1 }; setUsersQuery(next); loadUsers(next) }}
            className="h-9 rounded-lg border border-[#E2E8F0] bg-white text-sm text-[#0F172A] px-3 outline-none focus:border-[#0369A1]">
            <option value="">All Plans</option>
            <option value="free">Free</option>
            <option value="pro">Pro</option>
            <option value="agency">Agency</option>
          </select>
          <select value={usersQuery.status} onChange={e => { const next = { ...usersQuery, status: e.target.value, page: 1 }; setUsersQuery(next); loadUsers(next) }}
            className="h-9 rounded-lg border border-[#E2E8F0] bg-white text-sm text-[#0F172A] px-3 outline-none focus:border-[#0369A1]">
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="deactivated">Deactivated</option>
          </select>
          <button onClick={handleExportCsv} className="h-9 px-3 rounded-lg border border-[#E2E8F0] bg-white text-sm text-[#0F172A] hover:bg-slate-50 transition-colors flex items-center gap-1.5">
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
          <button onClick={() => loadUsers(usersQuery)} className="h-9 w-9 rounded-lg border border-[#E2E8F0] bg-white hover:bg-slate-50 transition-colors flex items-center justify-center">
            <RefreshCw className={cn('w-3.5 h-3.5 text-slate-500', loadingUsers && 'animate-spin')} />
          </button>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
          {loadingUsers ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-[#0369A1]" /></div>
          ) : !users?.users.length ? (
            <div className="text-center py-16 text-sm text-slate-400">No users found</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                  <SortTh label="User" col="email" current={usersQuery.sort} order={usersQuery.order} onSort={handleSort} />
                  <SortTh label="Plan" col="plan" current={usersQuery.sort} order={usersQuery.order} onSort={handleSort} />
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Status</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Searches</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Saved</th>
                  <SortTh label="Joined" col="created_at" current={usersQuery.sort} order={usersQuery.order} onSort={handleSort} />
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {users.users.map(u => (
                  <tr key={u.id} className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0369A1] to-[#0F172A] flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {u.email.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-[#0F172A] truncate max-w-[160px]">{u.full_name || u.email}</div>
                          {u.full_name && <div className="text-xs text-slate-400 truncate max-w-[160px]">{u.email}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3"><PlanBadge plan={u.plan} /></td>
                    <td className="px-4 py-3"><StatusBadge status={u.status} /></td>
                    <td className="px-4 py-3 text-xs text-slate-600">{(u.usage?.searches_this_month ?? 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">{(u.usage?.saved_leads_count ?? 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{fmtDate(u.created_at)}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => setSelectedUser(u)} className="text-xs font-medium text-[#0369A1] hover:text-[#0284C7] transition-colors">
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {users && users.totalPages > 1 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-xs text-slate-500">
              Page {users.page} of {users.totalPages} — {users.total.toLocaleString()} total users
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => { const next = { ...usersQuery, page: usersQuery.page - 1 }; setUsersQuery(next); loadUsers(next) }}
                disabled={users.page <= 1}
                className="h-8 px-3 rounded-lg border border-[#E2E8F0] bg-white text-xs disabled:opacity-40 hover:bg-slate-50 transition-colors"
              >Prev</button>
              <button
                onClick={() => { const next = { ...usersQuery, page: usersQuery.page + 1 }; setUsersQuery(next); loadUsers(next) }}
                disabled={users.page >= users.totalPages}
                className="h-8 px-3 rounded-lg border border-[#E2E8F0] bg-white text-xs disabled:opacity-40 hover:bg-slate-50 transition-colors"
              >Next</button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Billing tab
  // ───────────────────────────────────────────────────────────────────────────

  function renderBilling() {
    if (!billing) return <Spinner />
    const s = billing.summary

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          <StatCard title="MRR" value={fmtMoney(s.mrr)} accent="blue" />
          <StatCard title="ARR" value={fmtMoney(s.arr)} accent="blue" />
          <StatCard title="New MRR" value={fmtMoney(s.newThisMonth * PLAN_PRICES.pro)} subtitle="this month" accent="green" />
          <StatCard title="Churned MRR" value={fmtMoney(s.churnedMrr ?? 0)} subtitle="this month" accent="red" />
          <StatCard title="ARPU" value={fmtMoney(s.arpu)} subtitle="avg per user" />
          <StatCard title="Conversion" value={`${s.conversionRate}%`} subtitle="free → paid" />
        </div>

        <div className="flex items-center gap-3">
          <select
            value={billingStatusFilter}
            onChange={e => { setBillingStatusFilter(e.target.value); loadBilling(e.target.value) }}
            className="h-9 rounded-lg border border-[#E2E8F0] bg-white text-sm text-[#0F172A] px-3 outline-none focus:border-[#0369A1]"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="trialing">Trialing</option>
            <option value="past_due">Past Due</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                {['User', 'Plan', 'Status', 'Period', 'Renewal', 'Customer ID', 'Created'].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">{h}</th>
                ))}
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {billing.subscriptions.map(sub => (
                <tr key={sub.id} className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC] transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-[#0F172A] text-xs">{sub.email}</div>
                    {sub.fullName && <div className="text-xs text-slate-400">{sub.fullName}</div>}
                  </td>
                  <td className="px-4 py-3"><PlanBadge plan={sub.plan} /></td>
                  <td className="px-4 py-3"><StripeBadge status={sub.status} /></td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {sub.currentPeriodStart && sub.currentPeriodEnd
                      ? `${fmtDate(sub.currentPeriodStart)} – ${fmtDate(sub.currentPeriodEnd)}`
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {sub.currentPeriodEnd ? fmtDate(sub.currentPeriodEnd) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {sub.stripeCustomerId ? (
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-xs text-slate-600 max-w-[100px] truncate">{sub.stripeCustomerId}</span>
                        <CopyButton text={sub.stripeCustomerId} />
                        <a href={`https://dashboard.stripe.com/customers/${sub.stripeCustomerId}`} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-[#0369A1] ml-0.5">
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{fmtDate(sub.createdAt)}</td>
                  <td className="px-4 py-3">
                    {sub.status === 'past_due' && (
                      <button
                        onClick={() => handleDeactivateUser(sub.userId)}
                        className="text-xs font-medium text-red-600 hover:text-red-700 transition-colors"
                      >
                        Deactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // ───────────────────────────────────────────────────────────────────────────
  // At-Risk tab
  // ───────────────────────────────────────────────────────────────────────────

  function renderAtRisk() {
    if (!atRisk) return <Spinner />
    const pastDue = atRisk.pastDue as Record<string, unknown>[]
    const trialsEnding = atRisk.trialsEnding as Record<string, unknown>[]
    const inactivePaid = atRisk.inactivePaid as Record<string, unknown>[]

    return (
      <div className="space-y-6">
        {/* Past Due */}
        <div className="bg-white rounded-xl border border-red-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 bg-red-50 border-b border-red-200">
            <div className="flex items-center gap-2">
              <span className="text-base">🔴</span>
              <h3 className="text-sm font-bold text-red-800">Past Due ({pastDue.length})</h3>
              <span className="text-xs text-red-600">Payment failed — Stripe still retrying</span>
            </div>
            {pastDue.filter(u => u.user_status !== 'deactivated').length > 0 && (
              <button onClick={handleDeactivateAllPastDue}
                className="text-xs font-semibold text-red-700 border border-red-300 rounded-lg px-3 py-1.5 hover:bg-red-100 transition-colors">
                Deactivate All
              </button>
            )}
          </div>
          {pastDue.length === 0 ? (
            <div className="text-center py-8 text-sm text-slate-400">No past-due accounts</div>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[#F1F5F9] bg-[#F8FAFC]">
                {['Email', 'Plan', 'Days Overdue', 'Status', 'Stripe', ''].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {pastDue.map((u, i) => (
                  <tr key={i} className="border-b border-[#F1F5F9] last:border-0">
                    <td className="px-4 py-3 text-xs font-medium text-[#0F172A]">{u.email as string}</td>
                    <td className="px-4 py-3"><PlanBadge plan={u.plan as string} /></td>
                    <td className="px-4 py-3 text-xs text-red-600 font-semibold">{u.daysOverdue as number}d overdue</td>
                    <td className="px-4 py-3"><StatusBadge status={u.user_status as string ?? 'active'} /></td>
                    <td className="px-4 py-3">
                      {(u.stripe_customer_id as string) && (
                        <a href={`https://dashboard.stripe.com/customers/${u.stripe_customer_id as string}`} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-[#0369A1] hover:underline flex items-center gap-1">
                          Stripe <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {u.user_status !== 'deactivated' && (
                        <button onClick={() => handleDeactivateUser(u.id as string)}
                          className="text-xs font-medium text-red-600 hover:text-red-700 transition-colors">
                          Deactivate
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Trials Ending */}
        <div className="bg-white rounded-xl border border-yellow-200 overflow-hidden">
          <div className="px-5 py-4 bg-yellow-50 border-b border-yellow-200 flex items-center gap-2">
            <span className="text-base">🟡</span>
            <h3 className="text-sm font-bold text-yellow-800">Trials Ending Soon ({trialsEnding.length})</h3>
            <span className="text-xs text-yellow-700">Within 7 days — reach out to convert</span>
          </div>
          {trialsEnding.length === 0 ? (
            <div className="text-center py-8 text-sm text-slate-400">No trials expiring soon</div>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[#F1F5F9] bg-[#F8FAFC]">
                {['Email', 'Plan', 'Trial Ends', 'Days Left'].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {trialsEnding.map((u, i) => (
                  <tr key={i} className="border-b border-[#F1F5F9] last:border-0">
                    <td className="px-4 py-3 text-xs font-medium text-[#0F172A]">{u.email as string}</td>
                    <td className="px-4 py-3"><PlanBadge plan={u.plan as string} /></td>
                    <td className="px-4 py-3 text-xs text-slate-500">{u.current_period_end ? fmtDate(u.current_period_end as string) : '—'}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-yellow-700">{u.daysRemaining as number}d left</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Inactive Paid */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
            <span className="text-base">⚫</span>
            <h3 className="text-sm font-bold text-slate-700">Inactive Paid Users ({inactivePaid.length})</h3>
            <span className="text-xs text-slate-500">0 searches in last 30 days — churn risk</span>
          </div>
          {inactivePaid.length === 0 ? (
            <div className="text-center py-8 text-sm text-slate-400">No inactive paid users</div>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[#F1F5F9] bg-[#F8FAFC]">
                {['Email', 'Plan', 'Searches/mo', 'Last Reset'].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {inactivePaid.map((u, i) => (
                  <tr key={i} className="border-b border-[#F1F5F9] last:border-0">
                    <td className="px-4 py-3 text-xs font-medium text-[#0F172A]">{u.email as string}</td>
                    <td className="px-4 py-3"><PlanBadge plan={u.plan as string} /></td>
                    <td className="px-4 py-3 text-xs text-slate-500">{u.searches_this_month as number}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{u.last_reset_at ? fmtDate(u.last_reset_at as string) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    )
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Analytics tab
  // ───────────────────────────────────────────────────────────────────────────

  function renderAnalytics() {
    if (!analytics) return <Spinner />
    const signupTrend = (analytics.signupTrend ?? []) as { date: string; count: number }[]
    const searchTrend = (analytics.searchTrend ?? []) as { date: string; count: number }[]
    const mrrHistory = (analytics.mrrHistory ?? []) as { month: string; mrr: number }[]
    const planDist = (analytics.planDistribution ?? []) as { name: string; value: number }[]
    const topZips = (analytics.topZips ?? []) as { zip: string; count: number }[]
    const topCats = (analytics.topCategories ?? []) as { category: string; count: number }[]
    const powerUsers = (analytics.powerUsers ?? []) as Record<string, unknown>[]

    return (
      <div className="space-y-6">
        {/* Trend charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard title="New Signups — Last 30 Days">
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={signupTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94A3B8' }} tickFormatter={d => d.slice(5)} interval={6} />
                <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="count" stroke="#0369A1" strokeWidth={2} dot={false} name="Signups" />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Search Volume — Last 30 Days">
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={searchTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94A3B8' }} tickFormatter={d => d.slice(5)} interval={6} />
                <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="count" stroke="#F59E0B" strokeWidth={2} dot={false} name="Searches" />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* MRR history + plan distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <ChartCard title="MRR — Last 12 Months">
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={mrrHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94A3B8' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} tickFormatter={v => `$${v}`} />
                  <Tooltip contentStyle={{ fontSize: 12 }} formatter={(v) => [`$${v}`, 'MRR']} />
                  <Line type="monotone" dataKey="mrr" stroke="#10B981" strokeWidth={2} dot={false} name="MRR" />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
          <ChartCard title="Plan Distribution">
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={planDist} cx="50%" cy="50%" outerRadius={60} dataKey="value">
                  {planDist.map(entry => (
                    <Cell key={entry.name} fill={PLAN_COLORS[entry.name.toLowerCase()] ?? '#94A3B8'} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Top ZIPs + categories */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard title="Top Searched ZIP Codes">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={topZips} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#94A3B8' }} />
                <YAxis type="category" dataKey="zip" tick={{ fontSize: 10, fill: '#94A3B8' }} width={55} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Bar dataKey="count" fill="#0369A1" radius={[0, 4, 4, 0]} name="Searches" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Top Business Categories">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={topCats} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#94A3B8' }} />
                <YAxis type="category" dataKey="category" tick={{ fontSize: 10, fill: '#94A3B8' }} width={90} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Bar dataKey="count" fill="#F59E0B" radius={[0, 4, 4, 0]} name="Searches" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Power users */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E2E8F0]">
            <h3 className="text-sm font-bold text-[#0F172A]">Power Users — Top 10 by All-Time Searches</h3>
          </div>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-[#F1F5F9] bg-[#F8FAFC]">
              {['User', 'Plan', 'Total Searches', 'This Month', 'Joined'].map(h => (
                <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {powerUsers.map((u, i) => (
                <tr key={i} className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC]">
                  <td className="px-4 py-3">
                    <div className="font-medium text-xs text-[#0F172A]">{u.full_name as string || u.email as string}</div>
                    {(u.full_name as string) && <div className="text-xs text-slate-400">{u.email as string}</div>}
                  </td>
                  <td className="px-4 py-3"><PlanBadge plan={u.plan as string} /></td>
                  <td className="px-4 py-3 text-xs font-semibold text-[#0369A1]">{(u.total_searches as number).toLocaleString()}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{(u.searches_this_month as number).toLocaleString()}</td>
                  <td className="px-4 py-3 text-xs text-slate-400">{fmtDate(u.created_at as string)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Render
  // ───────────────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-screen-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[#0F172A]">Owner Dashboard</h1>
        <p className="text-sm text-slate-500 mt-0.5">Manage users, billing, and platform analytics</p>
      </div>

      <Tabs defaultValue="overview" onValueChange={handleTabChange}>
        <TabsList className="mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="billing">Billing & Revenue</TabsTrigger>
          <TabsTrigger value="atrisk">At-Risk</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">{renderOverview()}</TabsContent>
        <TabsContent value="users">{renderUsers()}</TabsContent>
        <TabsContent value="billing">{renderBilling()}</TabsContent>
        <TabsContent value="atrisk">{renderAtRisk()}</TabsContent>
        <TabsContent value="analytics">{renderAnalytics()}</TabsContent>
      </Tabs>

      <UserDetailSheet
        user={selectedUser}
        open={!!selectedUser}
        currentUserId={currentUserId}
        onClose={() => setSelectedUser(null)}
        onAction={handleUserAction}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function Spinner() {
  return <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-[#0369A1]" /></div>
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] p-5">
      <h3 className="text-sm font-bold text-[#0F172A] mb-4">{title}</h3>
      {children}
    </div>
  )
}

function AlertCard({ color, emoji, label, count, note }: { color: string; emoji: string; label: string; count: number; note: string }) {
  const styles: Record<string, string> = {
    red: 'bg-red-50 border-red-200',
    yellow: 'bg-yellow-50 border-yellow-200',
    orange: 'bg-orange-50 border-orange-200',
    green: 'bg-emerald-50 border-emerald-200',
  }
  return (
    <div className={cn('rounded-xl border p-4', styles[color] ?? styles.red)}>
      <div className="flex items-center gap-2 mb-1">
        <span>{emoji}</span>
        <span className="text-xs font-semibold text-[#0F172A]">{label}</span>
      </div>
      <p className="text-2xl font-bold text-[#0F172A] tabular-nums">{count}</p>
      <p className="text-xs text-slate-500 mt-0.5">{note}</p>
    </div>
  )
}

function SortTh({ label, col, current, order, onSort }: { label: string; col: string; current: string; order: string; onSort: (c: string) => void }) {
  const active = current === col
  return (
    <th
      className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3 cursor-pointer hover:text-[#0369A1] select-none"
      onClick={() => onSort(col)}
    >
      <div className="flex items-center gap-1">
        {label}
        {active ? (order === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : null}
      </div>
    </th>
  )
}
