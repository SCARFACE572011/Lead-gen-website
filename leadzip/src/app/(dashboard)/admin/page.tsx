'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Users, Search, Bookmark, CreditCard, TrendingUp, ShieldAlert,
  MapPin, Tag, Calendar, Crown, Zap, Loader2, ChevronUp, ChevronDown,
  DollarSign, UserCheck, ChevronLeft, ChevronRight, Copy, CheckCircle,
  ExternalLink, RefreshCw,
} from 'lucide-react'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { UserDetailSheet } from './UserDetailSheet'
import type { UserRow, UsersResponse, BillingResponse, AdminAction } from './types'

// ── types ────────────────────────────────────────────────────────────────────

interface TrendPoint { date: string; count: number }
interface AdminStats {
  totalUsers: number
  totalSearches: number
  savedLeads: number
  activeSubs: number
  planCounts: Record<string, number>
  mrr: number
  zipData: { zip: string; searches: number }[]
  categoryData: { name: string; searches: number }[]
  recentUsers: { email: string; plan: string; searches: number; savedLeads: number; joined: string }[]
  signupTrend: TrendPoint[]
  searchTrend: TrendPoint[]
}

// ── helpers ──────────────────────────────────────────────────────────────────

function cap(s: string) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : '' }
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
function fmtShortDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const PLAN_COLOR: Record<string, string> = {
  free:   'bg-slate-100 text-slate-600',
  pro:    'bg-blue-50 text-blue-700',
  agency: 'bg-amber-50 text-amber-700',
}
const STRIPE_COLOR: Record<string, string> = {
  active:    'bg-emerald-50 text-emerald-700',
  trialing:  'bg-blue-50 text-blue-700',
  past_due:  'bg-orange-50 text-orange-700',
  cancelled: 'bg-red-50 text-red-700',
  canceled:  'bg-red-50 text-red-700',
  unpaid:    'bg-red-50 text-red-700',
}

function PlanBadge({ plan }: { plan: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full', PLAN_COLOR[plan] ?? PLAN_COLOR.free)}>
      {plan === 'pro' && <Zap className="w-3 h-3" />}
      {plan === 'agency' && <Crown className="w-3 h-3" />}
      {cap(plan)}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn(
      'text-xs font-semibold px-2 py-0.5 rounded-full',
      status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
    )}>
      {cap(status)}
    </span>
  )
}

function StripeBadge({ status }: { status: string }) {
  return (
    <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', STRIPE_COLOR[status] ?? 'bg-slate-100 text-slate-600')}>
      {cap(status)}
    </span>
  )
}

interface StatCardProps {
  title: string
  value: string | number
  subtitle: string
  icon: React.ReactNode
  trend?: string
  trendUp?: boolean
}
function StatCard({ title, value, subtitle, icon, trend, trendUp }: StatCardProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl bg-[#FF4D23]/10 flex items-center justify-center">
          {icon}
        </div>
        {trend && (
          <span className={cn(
            'inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full',
            trendUp !== false ? 'text-emerald-700 bg-emerald-50' : 'text-red-700 bg-red-50'
          )}>
            <TrendingUp className="w-3 h-3" />
            {trend}
          </span>
        )}
      </div>
      <div className="text-2xl font-bold text-[#17130E] mb-0.5">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      <div className="text-sm font-medium text-[#17130E]">{title}</div>
      <div className="text-xs text-slate-500 mt-0.5">{subtitle}</div>
    </div>
  )
}

function SortIcon({ col, sort, order }: { col: string; sort: string; order: string }) {
  if (sort !== col) return <ChevronUp className="w-3 h-3 text-slate-300 inline ml-0.5" />
  return order === 'asc'
    ? <ChevronUp className="w-3 h-3 text-[#FF4D23] inline ml-0.5" />
    : <ChevronDown className="w-3 h-3 text-[#FF4D23] inline ml-0.5" />
}

// ── main page ────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [isAdmin, setIsAdmin]       = useState<boolean | null>(null)
  const [currentUserId, setCurrentUserId] = useState('')
  const [loading, setLoading]       = useState(true)
  const [activeTab, setActiveTab]   = useState('overview')

  const [stats, setStats]           = useState<AdminStats | null>(null)

  // Users tab
  const [users, setUsers]           = useState<UsersResponse | null>(null)
  const [usersLoading, setUsersLoading] = useState(false)
  const [usersLoadedOnce, setUsersLoadedOnce] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [usersQuery, setUsersQuery] = useState({
    page: 1, limit: 25, search: '', plan: '', status: '', sort: 'created_at', order: 'desc',
  })
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null)
  const usersQueryRef = useRef(usersQuery)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Billing tab
  const [billing, setBilling]       = useState<BillingResponse | null>(null)
  const [billingLoading, setBillingLoading] = useState(false)
  const [billingLoadedOnce, setBillingLoadedOnce] = useState(false)
  const [copiedId, setCopiedId]     = useState<string | null>(null)

  // ── auth check + initial stats load ──────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setIsAdmin(false); setLoading(false); return }
        setCurrentUserId(user.id)

        const { data } = await supabase
          .from('users_profile').select('role').eq('id', user.id).maybeSingle()

        if (data?.role !== 'admin') { setIsAdmin(false); setLoading(false); return }
        setIsAdmin(true)

        const res = await fetch('/api/admin/stats')
        if (res.ok) setStats(await res.json())
      } catch {
        setIsAdmin(false)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // ── fetch users (lazy + re-fetch on query change) ─────────────────────────
  const fetchUsers = useCallback(async (query: typeof usersQuery) => {
    setUsersLoading(true)
    try {
      const p = new URLSearchParams({
        page:   String(query.page),
        limit:  String(query.limit),
        search: query.search,
        plan:   query.plan,
        status: query.status,
        sort:   query.sort,
        order:  query.order,
      })
      const res = await fetch(`/api/admin/users?${p}`)
      if (res.ok) { setUsers(await res.json()); setUsersLoadedOnce(true) }
    } finally {
      setUsersLoading(false)
    }
  }, [])

  // Event-driven: update the query state and fetch in the same event, instead of
  // re-fetching from an effect (avoids setState-in-effect cascading renders).
  const updateUsersQuery = useCallback((update: (q: typeof usersQueryRef.current) => typeof usersQueryRef.current) => {
    const next = update(usersQueryRef.current)
    usersQueryRef.current = next
    setUsersQuery(next)
    fetchUsers(next)
  }, [fetchUsers])

  function handleSearchInput(val: string) {
    setSearchInput(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      updateUsersQuery(q => ({ ...q, search: val, page: 1 }))
    }, 300)
  }

  function handleSort(col: string) {
    updateUsersQuery(q => ({
      ...q,
      sort: col,
      order: q.sort === col && q.order === 'desc' ? 'asc' : 'desc',
      page: 1,
    }))
  }

  // ── fetch billing (lazy) ──────────────────────────────────────────────────
  const fetchBilling = useCallback(async () => {
    setBillingLoading(true)
    try {
      const res = await fetch('/api/admin/billing')
      if (res.ok) { setBilling(await res.json()); setBillingLoadedOnce(true) }
    } finally {
      setBillingLoading(false)
    }
  }, [])

  function handleTabChange(tab: string) {
    setActiveTab(tab)
    if (tab === 'users') fetchUsers(usersQueryRef.current)
    if (tab === 'billing' && !billingLoadedOnce) fetchBilling()
  }

  // ── user action handler ───────────────────────────────────────────────────
  async function handleUserAction(userId: string, action: AdminAction) {
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        action.type === 'set_status' ? { action: 'set_status', status: action.status }
        : action.type === 'set_plan'  ? { action: 'set_plan',   plan:   action.plan   }
        : { action: 'reset_usage' }
      ),
    })
    if (!res.ok) return
    const data = await res.json()

    // Optimistic update
    setUsers(prev => {
      if (!prev) return prev
      return {
        ...prev,
        users: prev.users.map(u => {
          if (u.id !== userId) return u
          if (action.type === 'set_status') return { ...u, status: action.status }
          if (action.type === 'set_plan')   return { ...u, plan: action.plan }
          if (action.type === 'reset_usage') return {
            ...u, usage: u.usage
              ? { ...u.usage, searches_this_month: 0, exports_count: 0 }
              : null
          }
          return u
        }),
      }
    })
    // Also update the slide-over if it's showing the same user
    setSelectedUser(prev => {
      if (!prev || prev.id !== userId) return prev
      if (action.type === 'set_status') return { ...prev, status: action.status }
      if (action.type === 'set_plan')   return { ...prev, plan: action.plan }
      if (action.type === 'reset_usage') return {
        ...prev, usage: prev.usage
          ? { ...prev.usage, searches_this_month: 0, exports_count: 0 }
          : null
      }
      return prev
    })
  }

  function copyId(id: string) {
    navigator.clipboard.writeText(id)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  // ── loading / access denied states ───────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#FF4D23]" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="bg-white border border-red-200 rounded-2xl p-10 max-w-sm text-center shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-[#17130E] mb-2">Access Denied</h2>
          <p className="text-sm text-slate-500">Admin access only.</p>
        </div>
      </div>
    )
  }

  const totalUsers = stats?.totalUsers ?? 0
  const planCounts = stats?.planCounts ?? { free: 0, pro: 0, agency: 0 }
  const activeSubs = stats?.activeSubs ?? 0

  const planBreakdown = [
    { plan: 'Free',   users: planCounts.free   ?? 0, color: 'bg-slate-400',  hex: '#94a3b8' },
    { plan: 'Pro',    users: planCounts.pro    ?? 0, color: 'bg-[#FF4D23]', hex: '#FF4D23' },
    { plan: 'Agency', users: planCounts.agency ?? 0, color: 'bg-[#17130E]', hex: '#17130E' },
  ]

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="max-w-[1400px] mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-[#17130E]">Owner Portal</h1>
              <span className="inline-flex items-center gap-1.5 bg-red-50 text-red-700 border border-red-200 text-xs font-semibold px-2.5 py-1 rounded-full">
                <ShieldAlert className="w-3 h-3" />
                Admin Only
              </span>
            </div>
            <p className="text-sm text-slate-500">Complete platform management for LeadZip</p>
          </div>
          <div className="text-xs text-slate-400 bg-white border border-slate-200 px-3 py-2 rounded-lg hidden sm:block">
            <span className="font-medium text-slate-600">Last updated:</span> {new Date().toLocaleString()}
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="mb-6 bg-white border border-slate-200 p-1 h-auto rounded-xl">
            <TabsTrigger value="overview"   className="px-5 py-2 text-sm font-medium rounded-lg data-[state=active]:bg-[#FF4D23] data-[state=active]:text-white data-[state=active]:shadow-sm">Overview</TabsTrigger>
            <TabsTrigger value="users"      className="px-5 py-2 text-sm font-medium rounded-lg data-[state=active]:bg-[#FF4D23] data-[state=active]:text-white data-[state=active]:shadow-sm">Users</TabsTrigger>
            <TabsTrigger value="billing"    className="px-5 py-2 text-sm font-medium rounded-lg data-[state=active]:bg-[#FF4D23] data-[state=active]:text-white data-[state=active]:shadow-sm">Billing</TabsTrigger>
            <TabsTrigger value="analytics"  className="px-5 py-2 text-sm font-medium rounded-lg data-[state=active]:bg-[#FF4D23] data-[state=active]:text-white data-[state=active]:shadow-sm">Analytics</TabsTrigger>
          </TabsList>

          {/* ── OVERVIEW ── */}
          <TabsContent value="overview">
            {/* Stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <StatCard title="Total Users"          value={totalUsers}              subtitle="Registered accounts"    icon={<Users      className="w-5 h-5 text-[#FF4D23]" />} />
              <StatCard title="Active Subscribers"   value={activeSubs}              subtitle="Pro + Agency plans"     icon={<UserCheck   className="w-5 h-5 text-[#FF4D23]" />} />
              <StatCard title="Est. Monthly Revenue" value={`$${(stats?.mrr ?? 0).toLocaleString()}`} subtitle="MRR from paid plans" icon={<DollarSign  className="w-5 h-5 text-[#FF4D23]" />} />
              <StatCard title="Total Searches"       value={stats?.totalSearches ?? 0} subtitle="All-time"            icon={<Search     className="w-5 h-5 text-[#FF4D23]" />} />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
              {/* Search analytics chart */}
              <div className="xl:col-span-2 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <SearchAnalyticsChart zipData={stats?.zipData ?? []} categoryData={stats?.categoryData ?? []} />
              </div>

              {/* Subscription breakdown */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100">
                  <h2 className="text-base font-semibold text-[#17130E]">Subscription Breakdown</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Plan distribution</p>
                </div>
                <div className="p-5 space-y-4">
                  {planBreakdown.map((s) => {
                    const pct = totalUsers > 0 ? Math.round((s.users / totalUsers) * 100) : 0
                    return (
                      <div key={s.plan}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <div className={cn('w-2.5 h-2.5 rounded-full', s.color)} />
                            <span className="text-sm font-medium text-[#17130E]">{s.plan}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-bold text-[#17130E]">{s.users}</span>
                            <span className="text-xs text-slate-400 ml-1">({pct}%)</span>
                          </div>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className={cn('h-2 rounded-full', s.color)} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                  <div className="border-t border-slate-100 pt-4 space-y-2">
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>Monthly Revenue</span>
                      <span className="font-semibold text-[#17130E]">${(stats?.mrr ?? 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>Paid Subscribers</span>
                      <span className="font-semibold text-[#17130E]">{activeSubs}</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>Conversion Rate</span>
                      <span className="font-semibold text-emerald-600">
                        {totalUsers > 0 ? ((activeSubs / totalUsers) * 100).toFixed(1) : '0.0'}%
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>Saved Leads</span>
                      <span className="font-semibold text-[#17130E]">{(stats?.savedLeads ?? 0).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ── USERS ── */}
          <TabsContent value="users">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  value={searchInput}
                  onChange={e => handleSearchInput(e.target.value)}
                  placeholder="Search by email or name…"
                  className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-white text-[#17130E] placeholder:text-slate-400 outline-none focus:border-[#FF4D23] focus:ring-2 focus:ring-[#FF4D23]/10"
                />
              </div>
              <Select value={usersQuery.plan || 'all'} onValueChange={v => updateUsersQuery(q => ({ ...q, plan: v === 'all' ? '' : (v ?? ''), page: 1 }))}>
                <SelectTrigger className="w-full sm:w-36 h-[42px] text-sm border-slate-200">
                  <SelectValue placeholder="All Plans" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Plans</SelectItem>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="agency">Agency</SelectItem>
                </SelectContent>
              </Select>
              <Select value={usersQuery.status || 'all'} onValueChange={v => updateUsersQuery(q => ({ ...q, status: v === 'all' ? '' : (v ?? ''), page: 1 }))}>
                <SelectTrigger className="w-full sm:w-36 h-[42px] text-sm border-slate-200">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="deactivated">Deactivated</SelectItem>
                </SelectContent>
              </Select>
              <button
                onClick={() => fetchUsers(usersQuery)}
                className="h-[42px] px-4 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors flex items-center gap-2 text-sm font-medium shrink-0"
              >
                <RefreshCw className="w-4 h-4" />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>

            {/* Table */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              {usersLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-5 h-5 animate-spin text-[#FF4D23]" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50">
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                          <button onClick={() => handleSort('email')} className="flex items-center gap-0.5 hover:text-slate-700">
                            User <SortIcon col="email" sort={usersQuery.sort} order={usersQuery.order} />
                          </button>
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                          <button onClick={() => handleSort('plan')} className="flex items-center gap-0.5 hover:text-slate-700">
                            Plan <SortIcon col="plan" sort={usersQuery.sort} order={usersQuery.order} />
                          </button>
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Searches/mo</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Saved Leads</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                          <button onClick={() => handleSort('created_at')} className="flex items-center gap-0.5 hover:text-slate-700">
                            Joined <SortIcon col="created_at" sort={usersQuery.sort} order={usersQuery.order} />
                          </button>
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(users?.users ?? []).length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-400">
                            {usersLoadedOnce ? 'No users match your filters' : 'Loading…'}
                          </td>
                        </tr>
                      ) : (
                        (users?.users ?? []).map((user) => (
                          <tr key={user.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-2.5">
                                <div className={cn(
                                  'w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0',
                                  user.status === 'deactivated' ? 'bg-slate-400' : 'bg-gradient-to-br from-[#FF4D23] to-[#17130E]'
                                )}>
                                  {user.email.charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <div className="text-sm font-medium text-[#17130E] truncate max-w-[180px]">{user.email}</div>
                                  {user.full_name && (
                                    <div className="text-xs text-slate-500 truncate max-w-[180px]">{user.full_name}</div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3.5"><PlanBadge plan={user.plan} /></td>
                            <td className="px-4 py-3.5"><StatusBadge status={user.status} /></td>
                            <td className="px-4 py-3.5 text-sm text-slate-700">{user.usage?.searches_this_month ?? 0}</td>
                            <td className="px-4 py-3.5 text-sm text-slate-700">{user.usage?.saved_leads_count ?? 0}</td>
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                <Calendar className="w-3 h-3" />
                                {fmtDate(user.created_at)}
                              </div>
                            </td>
                            <td className="px-4 py-3.5 text-right">
                              <button
                                onClick={() => setSelectedUser(user)}
                                className="text-xs font-medium text-[#FF4D23] hover:text-[#E23A12] border border-[#FF4D23]/20 hover:border-[#FF4D23]/40 bg-blue-50/50 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-all"
                              >
                                View
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              {(users?.totalPages ?? 0) > 1 && (
                <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    {users?.total} users total
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateUsersQuery(q => ({ ...q, page: q.page - 1 }))}
                      disabled={(users?.page ?? 1) <= 1}
                      className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-xs text-slate-600 font-medium px-2">
                      {users?.page} / {users?.totalPages}
                    </span>
                    <button
                      onClick={() => updateUsersQuery(q => ({ ...q, page: q.page + 1 }))}
                      disabled={(users?.page ?? 1) >= (users?.totalPages ?? 1)}
                      className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {!((users?.totalPages ?? 0) > 1) && usersLoadedOnce && (
                <div className="px-4 py-2 border-t border-slate-100 bg-slate-50">
                  <span className="text-xs text-slate-400">{users?.total ?? 0} users</span>
                </div>
              )}
            </div>

            {/* User detail sheet */}
            <UserDetailSheet
              user={selectedUser}
              open={!!selectedUser}
              currentUserId={currentUserId}
              onClose={() => setSelectedUser(null)}
              onAction={handleUserAction}
            />
          </TabsContent>

          {/* ── BILLING ── */}
          <TabsContent value="billing">
            {/* Summary cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <StatCard title="Monthly Revenue"   value={`$${(billing?.summary.mrr ?? 0).toLocaleString()}`}      subtitle="Est. MRR"           icon={<DollarSign  className="w-5 h-5 text-[#FF4D23]" />} />
              <StatCard title="Total Subscribers" value={billing?.summary.totalSubscribers ?? 0}                  subtitle="Pro + Agency active" icon={<CreditCard  className="w-5 h-5 text-[#FF4D23]" />} />
              <StatCard title="New This Month"    value={billing?.summary.newThisMonth ?? 0}                      subtitle="New paid subscribers" icon={<TrendingUp  className="w-5 h-5 text-[#FF4D23]" />} />
              <StatCard title="Churned This Month" value={billing?.summary.churnedThisMonth ?? 0}                 subtitle="Cancellations"       icon={<Bookmark   className="w-5 h-5 text-[#FF4D23]" />} />
            </div>

            {/* Subscriptions table */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-[#17130E]">All Subscriptions</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Conversion rate: <span className="font-semibold text-emerald-600">{billing?.summary.conversionRate ?? 0}%</span>
                    {' '}· Pro: {billing?.summary.proCount ?? 0} · Agency: {billing?.summary.agencyCount ?? 0}
                  </p>
                </div>
                <button
                  onClick={fetchBilling}
                  className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors flex items-center gap-1.5 text-sm"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Refresh
                </button>
              </div>

              {billingLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-5 h-5 animate-spin text-[#FF4D23]" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50">
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">User</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Plan</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Stripe Status</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Billing Period</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Customer ID</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Since</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(billing?.subscriptions ?? []).length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-400">
                            {billingLoadedOnce ? 'No subscriptions yet' : 'Loading…'}
                          </td>
                        </tr>
                      ) : (
                        (billing?.subscriptions ?? []).map((s) => {
                          const period = s.currentPeriodStart && s.currentPeriodEnd
                            ? `${fmtShortDate(s.currentPeriodStart)} – ${fmtShortDate(s.currentPeriodEnd)}`
                            : '—'
                          return (
                            <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                              <td className="px-4 py-3.5">
                                <div className="text-sm font-medium text-[#17130E] truncate max-w-[180px]">{s.email}</div>
                                {s.fullName && <div className="text-xs text-slate-500">{s.fullName}</div>}
                              </td>
                              <td className="px-4 py-3.5"><PlanBadge plan={s.plan} /></td>
                              <td className="px-4 py-3.5"><StripeBadge status={s.status} /></td>
                              <td className="px-4 py-3.5 text-xs text-slate-600">{period}</td>
                              <td className="px-4 py-3.5">
                                {s.stripeCustomerId ? (
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-mono text-xs text-slate-500 truncate max-w-[100px]">{s.stripeCustomerId}</span>
                                    <button onClick={() => copyId(s.stripeCustomerId!)} className="text-slate-400 hover:text-slate-600 transition-colors" title="Copy">
                                      {copiedId === s.stripeCustomerId
                                        ? <CheckCircle className="w-3 h-3 text-emerald-500" />
                                        : <Copy className="w-3 h-3" />}
                                    </button>
                                    <a href={`https://dashboard.stripe.com/customers/${s.stripeCustomerId}`} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-[#FF4D23] transition-colors">
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                  </div>
                                ) : <span className="text-xs text-slate-300">—</span>}
                              </td>
                              <td className="px-4 py-3.5 text-xs text-slate-500">{fmtDate(s.createdAt)}</td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </TabsContent>

          {/* ── ANALYTICS ── */}
          <TabsContent value="analytics">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Signups trend */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100">
                  <h2 className="text-base font-semibold text-[#17130E]">New Signups</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Last 30 days</p>
                </div>
                <div className="p-5">
                  <TrendChart data={stats?.signupTrend ?? []} color="#FF4D23" label="Signups" />
                </div>
              </div>

              {/* Search volume trend */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100">
                  <h2 className="text-base font-semibold text-[#17130E]">Search Volume</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Last 30 days</p>
                </div>
                <div className="p-5">
                  <TrendChart data={stats?.searchTrend ?? []} color="#17130E" label="Searches" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Plan distribution pie */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100">
                  <h2 className="text-base font-semibold text-[#17130E]">Plan Distribution</h2>
                  <p className="text-xs text-slate-500 mt-0.5">{totalUsers} total users</p>
                </div>
                <div className="p-5">
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={planBreakdown.filter(p => p.users > 0)}
                        dataKey="users"
                        nameKey="plan"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {planBreakdown.filter(p => p.users > 0).map((entry) => (
                          <Cell key={entry.plan} fill={entry.hex} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v) => [`${v} users`]}
                        contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex justify-center gap-4 mt-2">
                    {planBreakdown.map(p => (
                      <div key={p.plan} className="flex items-center gap-1.5">
                        <div className={cn('w-2.5 h-2.5 rounded-full', p.color)} />
                        <span className="text-xs text-slate-600">{p.plan}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Top ZIPs + Categories */}
              <div className="lg:col-span-2">
                <SearchAnalyticsChart zipData={stats?.zipData ?? []} categoryData={stats?.categoryData ?? []} />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

// ── chart components ──────────────────────────────────────────────────────────

function TrendChart({ data, color, label }: { data: TrendPoint[]; color: string; label: string }) {
  if (data.length === 0) {
    return <div className="h-[200px] flex items-center justify-center text-sm text-slate-400">No data yet</div>
  }
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 10, fill: '#94a3b8' }}
          interval={4}
          tickFormatter={(d) => fmtShortDate(d)}
        />
        <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
          labelFormatter={(d) => fmtShortDate(d)}
          formatter={(v) => [`${v}`, label]}
        />
        <Line type="monotone" dataKey="count" stroke={color} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  )
}

function SearchAnalyticsChart({
  zipData,
  categoryData,
}: {
  zipData: { zip: string; searches: number }[]
  categoryData: { name: string; searches: number }[]
}) {
  const [activeChart, setActiveChart] = useState<'zip' | 'category'>('zip')
  return (
    <div>
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <h2 className="text-base font-semibold text-[#17130E]">Search Analytics</h2>
        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveChart('zip')}
            className={cn('px-3 py-1.5 rounded-md text-xs font-medium transition-all', activeChart === 'zip' ? 'bg-white text-[#17130E] shadow-sm' : 'text-slate-500 hover:text-slate-700')}
          >
            <MapPin className="w-3 h-3 inline mr-1" />ZIP Codes
          </button>
          <button
            onClick={() => setActiveChart('category')}
            className={cn('px-3 py-1.5 rounded-md text-xs font-medium transition-all', activeChart === 'category' ? 'bg-white text-[#17130E] shadow-sm' : 'text-slate-500 hover:text-slate-700')}
          >
            <Tag className="w-3 h-3 inline mr-1" />Categories
          </button>
        </div>
      </div>
      <div className="p-5">
        {activeChart === 'zip' ? (
          <>
            <p className="text-xs text-slate-500 mb-4">Most searched ZIP codes</p>
            {zipData.length === 0 ? (
              <div className="h-[260px] flex items-center justify-center text-sm text-slate-400">No data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={zipData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="zip" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} formatter={(v) => [`${v} searches`, 'Volume']} />
                  <Bar dataKey="searches" fill="#FF4D23" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </>
        ) : (
          <>
            <p className="text-xs text-slate-500 mb-4">Most searched business categories</p>
            {categoryData.length === 0 ? (
              <div className="h-[260px] flex items-center justify-center text-sm text-slate-400">No data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={categoryData} layout="vertical" margin={{ top: 0, right: 10, left: 60, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: '#94a3b8' }} width={80} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} formatter={(v) => [`${v} searches`, 'Volume']} />
                  <Bar dataKey="searches" fill="#17130E" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </>
        )}
      </div>
    </div>
  )
}
