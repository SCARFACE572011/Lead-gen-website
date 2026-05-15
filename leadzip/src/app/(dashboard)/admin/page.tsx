'use client'

import { useState, useEffect } from 'react'
import {
  Users,
  Search,
  Bookmark,
  CreditCard,
  TrendingUp,
  ShieldAlert,
  MapPin,
  Tag,
  Calendar,
  Crown,
  Zap,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { cn } from '@/lib/utils'
import { MOCK_PROFILE } from '@/lib/mock-auth'
import { createClient } from '@/lib/supabase/client'

const isSupabaseConfigured =
  process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder.supabase.co'

// Mock data
const ZIP_CHART_DATA = [
  { zip: '10019', searches: 342 },
  { zip: '90210', searches: 289 },
  { zip: '60601', searches: 241 },
  { zip: '77001', searches: 198 },
  { zip: '85001', searches: 187 },
  { zip: '30301', searches: 154 },
  { zip: '98101', searches: 132 },
  { zip: '33101', searches: 119 },
  { zip: '75201', searches: 108 },
  { zip: '19101', searches: 97 },
]

const CATEGORY_CHART_DATA = [
  { name: 'Restaurants', searches: 847 },
  { name: 'Contractors', searches: 623 },
  { name: 'HVAC Services', searches: 541 },
  { name: 'Plumbers', searches: 489 },
  { name: 'Auto Shops', searches: 412 },
  { name: 'Dentists', searches: 387 },
  { name: 'Hair & Beauty', searches: 334 },
  { name: 'Landscaping', searches: 298 },
]

const RECENT_USERS = [
  { email: 'sarah.chen@digitalmktg.co', plan: 'Pro', searches: 87, savedLeads: 234, joined: '2025-04-12' },
  { email: 'marcus@outreachhq.com', plan: 'Agency', searches: 243, savedLeads: 891, joined: '2025-03-28' },
  { email: 'jenna.williams@salespro.io', plan: 'Free', searches: 12, savedLeads: 18, joined: '2025-05-08' },
  { email: 'derek.r@localbizseo.net', plan: 'Pro', searches: 54, savedLeads: 167, joined: '2025-04-22' },
  { email: 'aisha.k@growthleads.com', plan: 'Agency', searches: 312, savedLeads: 1024, joined: '2025-03-05' },
  { email: 'tommy.h@freelancedev.io', plan: 'Free', searches: 5, savedLeads: 9, joined: '2025-05-10' },
  { email: 'priya.s@nextstepagency.com', plan: 'Pro', searches: 71, savedLeads: 198, joined: '2025-04-18' },
  { email: 'carlos.m@outboundsales.co', plan: 'Pro', searches: 93, savedLeads: 287, joined: '2025-04-01' },
]

const SUBSCRIPTION_DATA = [
  { plan: 'Free', users: 714, color: 'bg-slate-400', pct: 84 },
  { plan: 'Pro', users: 89, color: 'bg-[#0369A1]', pct: 11 },
  { plan: 'Agency', users: 44, color: 'bg-[#0F172A]', pct: 5 },
]

const PLAN_BADGE: Record<string, { color: string; icon: React.ReactNode }> = {
  Free: { color: 'bg-slate-100 text-slate-600', icon: null },
  Pro: { color: 'bg-blue-50 text-blue-700', icon: <Zap className="w-3 h-3" /> },
  Agency: { color: 'bg-amber-50 text-amber-700', icon: <Crown className="w-3 h-3" /> },
}

interface StatCardProps {
  title: string
  value: string | number
  subtitle: string
  icon: React.ReactNode
  trend?: string
}

function StatCard({ title, value, subtitle, icon, trend }: StatCardProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl bg-[#0369A1]/10 flex items-center justify-center">
          {icon}
        </div>
        {trend && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
            <TrendingUp className="w-3 h-3" />
            {trend}
          </span>
        )}
      </div>
      <div className="text-2xl font-bold text-[#0F172A] mb-0.5">{value.toLocaleString()}</div>
      <div className="text-sm font-medium text-[#0F172A]">{title}</div>
      <div className="text-xs text-slate-500 mt-0.5">{subtitle}</div>
    </div>
  )
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function AdminPage() {
  const [activeChart, setActiveChart] = useState<'zip' | 'category'>('zip')
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)

  useEffect(() => {
    async function checkAdmin() {
      if (!isSupabaseConfigured) {
        setIsAdmin(MOCK_PROFILE.role === 'admin')
        return
      }
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setIsAdmin(false); return }
        const { data } = await supabase
          .from('users_profile')
          .select('role')
          .eq('id', user.id)
          .maybeSingle()
        setIsAdmin(data?.role === 'admin')
      } catch {
        setIsAdmin(false)
      }
    }
    checkAdmin()
  }, [])

  if (isAdmin === null) return null

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="bg-white border border-red-200 rounded-2xl p-10 max-w-sm text-center shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-[#0F172A] mb-2">Access Denied</h2>
          <p className="text-sm text-slate-500">You do not have permission to view this page. Admin access only.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="max-w-[1400px] mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-[#0F172A]">Admin Dashboard</h1>
              <span className="inline-flex items-center gap-1.5 bg-red-50 text-red-700 border border-red-200 text-xs font-semibold px-2.5 py-1 rounded-full">
                <ShieldAlert className="w-3 h-3" />
                Admin Only
              </span>
            </div>
            <p className="text-sm text-slate-500">Platform overview and user management</p>
          </div>
          <div className="text-xs text-slate-400 bg-white border border-slate-200 px-3 py-2 rounded-lg">
            <span className="font-medium text-slate-600">Last updated:</span> {new Date().toLocaleString()}
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            title="Total Users"
            value={847}
            subtitle="Registered accounts"
            icon={<Users className="w-5 h-5 text-[#0369A1]" />}
            trend="+12% this month"
          />
          <StatCard
            title="Total Searches"
            value={3241}
            subtitle="All-time searches run"
            icon={<Search className="w-5 h-5 text-[#0369A1]" />}
            trend="+8% this week"
          />
          <StatCard
            title="Saved Leads"
            value={12847}
            subtitle="Leads in user CRMs"
            icon={<Bookmark className="w-5 h-5 text-[#0369A1]" />}
            trend="+23% this month"
          />
          <StatCard
            title="Active Subscriptions"
            value={133}
            subtitle="Pro + Agency plans"
            icon={<CreditCard className="w-5 h-5 text-[#0369A1]" />}
            trend="+5 this week"
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">
          {/* Charts */}
          <div className="xl:col-span-2 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-base font-semibold text-[#0F172A]">Search Analytics</h2>
              <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                <button
                  onClick={() => setActiveChart('zip')}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                    activeChart === 'zip' ? 'bg-white text-[#0F172A] shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  )}
                >
                  <MapPin className="w-3 h-3 inline mr-1" />
                  ZIP Codes
                </button>
                <button
                  onClick={() => setActiveChart('category')}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                    activeChart === 'category' ? 'bg-white text-[#0F172A] shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  )}
                >
                  <Tag className="w-3 h-3 inline mr-1" />
                  Categories
                </button>
              </div>
            </div>
            <div className="p-5">
              {activeChart === 'zip' ? (
                <>
                  <p className="text-xs text-slate-500 mb-4">Most searched ZIP codes by search volume</p>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={ZIP_CHART_DATA} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="zip" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                      <Tooltip
                        contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                        formatter={(v) => [`${v} searches`, 'Volume']}
                      />
                      <Bar dataKey="searches" fill="#0369A1" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </>
              ) : (
                <>
                  <p className="text-xs text-slate-500 mb-4">Most searched business categories by volume</p>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={CATEGORY_CHART_DATA} layout="vertical" margin={{ top: 0, right: 10, left: 60, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                      <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: '#94a3b8' }} width={80} />
                      <Tooltip
                        contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                        formatter={(v) => [`${v} searches`, 'Volume']}
                      />
                      <Bar dataKey="searches" fill="#0F172A" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </>
              )}
            </div>
          </div>

          {/* Subscription breakdown */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-[#0F172A]">Subscription Breakdown</h2>
              <p className="text-xs text-slate-500 mt-0.5">Active plan distribution</p>
            </div>
            <div className="p-5 space-y-4">
              {SUBSCRIPTION_DATA.map((s) => (
                <div key={s.plan}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className={cn('w-2.5 h-2.5 rounded-full', s.color)} />
                      <span className="text-sm font-medium text-[#0F172A]">{s.plan}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-[#0F172A]">{s.users}</span>
                      <span className="text-xs text-slate-400 ml-1">({s.pct}%)</span>
                    </div>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={cn('h-2 rounded-full', s.color)}
                      style={{ width: `${s.pct}%` }}
                    />
                  </div>
                </div>
              ))}

              <div className="border-t border-slate-100 pt-4 mt-4">
                <div className="text-xs text-slate-500 space-y-2">
                  <div className="flex justify-between">
                    <span>Monthly Recurring Revenue</span>
                    <span className="font-semibold text-[#0F172A]">$6,531</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Avg. Revenue Per User</span>
                    <span className="font-semibold text-[#0F172A]">$7.72</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Free → Paid Conversion</span>
                    <span className="font-semibold text-emerald-600">15.7%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Users Table */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-[#0F172A]">Recent Users</h2>
              <p className="text-xs text-slate-500 mt-0.5">Most recently registered accounts</p>
            </div>
            <button className="text-xs text-[#0369A1] hover:underline font-medium">
              View all users →
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Plan</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Searches</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Saved Leads</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Joined</th>
                </tr>
              </thead>
              <tbody>
                {RECENT_USERS.map((user, i) => {
                  const badge = PLAN_BADGE[user.plan]
                  return (
                    <tr
                      key={i}
                      className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors"
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#0369A1] to-[#0F172A] flex items-center justify-center text-white text-xs font-bold">
                            {user.email.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm text-[#0F172A] font-medium">{user.email}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={cn('inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full', badge.color)}>
                          {badge.icon}
                          {user.plan}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-sm text-slate-700">{user.searches}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-sm text-slate-700">{user.savedLeads}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <Calendar className="w-3 h-3" />
                          {formatDate(user.joined)}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-slate-100 bg-slate-50">
            <span className="text-xs text-slate-400">Showing 8 of 847 users · All data is mock for UI demonstration</span>
          </div>
        </div>
      </div>
    </div>
  )
}
