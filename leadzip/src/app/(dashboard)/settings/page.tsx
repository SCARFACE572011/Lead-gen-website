'use client'

import { useState, useEffect } from 'react'
import {
  User,
  CreditCard,
  Bell,
  ShieldCheck,
  Check,
  ChevronRight,
  Zap,
  BarChart3,
  Bookmark,
  AlertCircle,
  Info,
  ExternalLink,
  Mail,
  Building2,
  Lock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

const isSupabaseConfigured =
  process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder.supabase.co'

type TabId = 'profile' | 'plan' | 'notifications' | 'compliance'

interface Tab {
  id: TabId
  label: string
  icon: React.ReactNode
}

const TABS: Tab[] = [
  { id: 'profile', label: 'Profile', icon: <User className="w-4 h-4" /> },
  { id: 'plan', label: 'Plan & Usage', icon: <CreditCard className="w-4 h-4" /> },
  { id: 'notifications', label: 'Notifications', icon: <Bell className="w-4 h-4" /> },
  { id: 'compliance', label: 'Compliance', icon: <ShieldCheck className="w-4 h-4" /> },
]

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={cn(
        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none',
        checked ? 'bg-[#0369A1]' : 'bg-slate-200'
      )}
    >
      <span
        className={cn(
          'inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform',
          checked ? 'translate-x-6' : 'translate-x-1'
        )}
      />
    </button>
  )
}

function UsageBar({ used, total }: { used: number; total: number | null; color?: string }) {
  const pct = total ? Math.min(100, (used / total) * 100) : 0
  const barColor = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-[#0369A1]'
  return (
    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
      <div
        className={cn('h-2 rounded-full transition-all duration-500', total === null ? 'w-0' : barColor)}
        style={{ width: total === null ? '0%' : `${pct}%` }}
      />
    </div>
  )
}

function ProfileTab() {
  const [fullName, setFullName] = useState('Alex Johnson')
  const [company, setCompany] = useState('Acme Agency')
  const [email, setEmail] = useState('alex@acmeagency.com')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function loadProfile() {
      if (!isSupabaseConfigured) return
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) return

        const { data } = await supabase
          .from('users_profile')
          .select('*')
          .eq('id', user.id)
          .single()

        if (data) {
          setFullName(data.full_name || '')
          setCompany(data.company_name || '')
          setEmail(data.email || user.email || '')
        } else if (user.email) {
          setEmail(user.email)
        }
      } catch {
        // Non-fatal — keep defaults
      }
    }
    loadProfile()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      if (isSupabaseConfigured) {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (user) {
          await supabase
            .from('users_profile')
            .update({ full_name: fullName, company_name: company })
            .eq('id', user.id)
        }
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      // Non-fatal
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[#0F172A]">Profile Information</h2>
        <p className="text-sm text-slate-500 mt-0.5">Update your account details</p>
      </div>

      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#0369A1] to-[#0F172A] flex items-center justify-center text-white font-bold text-xl">
          {fullName.charAt(0) || '?'}
        </div>
        <div>
          <p className="text-sm font-medium text-[#0F172A]">{fullName || 'Your Name'}</p>
          <p className="text-xs text-slate-400">LeadZip Pro Member</p>
        </div>
      </div>

      <div className="grid gap-5">
        <div>
          <label className="block text-sm font-medium text-[#0F172A] mb-1.5">
            <span className="flex items-center gap-2">
              <User className="w-3.5 h-3.5 text-slate-400" />
              Full Name
            </span>
          </label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0369A1]/20 focus:border-[#0369A1] transition-all"
            placeholder="Your full name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[#0F172A] mb-1.5">
            <span className="flex items-center gap-2">
              <Mail className="w-3.5 h-3.5 text-slate-400" />
              Email Address
            </span>
          </label>
          <div className="relative">
            <input
              type="email"
              value={email}
              readOnly
              className="w-full px-3 py-2.5 pr-28 text-sm border border-slate-200 rounded-xl bg-slate-50 text-slate-500 cursor-not-allowed"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
              <Check className="w-3 h-3" />
              Verified
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1.5 flex items-center gap-1">
            <Lock className="w-3 h-3" />
            Email cannot be changed. Contact support if needed.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-[#0F172A] mb-1.5">
            <span className="flex items-center gap-2">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              Company Name
            </span>
          </label>
          <input
            type="text"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0369A1]/20 focus:border-[#0369A1] transition-all"
            placeholder="Your company name"
          />
        </div>
      </div>

      <div className="pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className={cn(
            'inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl transition-all disabled:opacity-60',
            saved
              ? 'bg-emerald-500 text-white'
              : 'bg-[#0F172A] text-white hover:bg-[#0369A1]'
          )}
        >
          {saved ? (
            <>
              <Check className="w-4 h-4" />
              Saved!
            </>
          ) : saving ? (
            'Saving…'
          ) : (
            'Save Changes'
          )}
        </button>
      </div>
    </div>
  )
}

function PlanTab() {
  const [billingLoading, setBillingLoading] = useState(false)
  const [billingError, setBillingError] = useState('')

  const handleManageBilling = async () => {
    setBillingLoading(true)
    setBillingError('')
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setBillingError('You must be signed in to manage billing.')
        return
      }

      const { data: sub } = await supabase
        .from('subscriptions')
        .select('stripe_customer_id')
        .eq('user_id', user.id)
        .single()

      if (!sub?.stripe_customer_id) {
        setBillingError('No active subscription found.')
        return
      }

      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: sub.stripe_customer_id }),
      })
      const json = await res.json()
      if (json.url) {
        window.location.href = json.url
      } else {
        setBillingError(json.error || 'Could not open billing portal.')
      }
    } catch {
      setBillingError('Something went wrong. Please try again.')
    } finally {
      setBillingLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[#0F172A]">Plan & Usage</h2>
        <p className="text-sm text-slate-500 mt-0.5">Monitor your usage and manage your subscription</p>
      </div>

      {/* Current Plan */}
      <div className="bg-gradient-to-br from-[#0F172A] to-[#0369A1] rounded-2xl p-6 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNCI+PHBhdGggZD0iTTAgMTBMMTAgMEgwdjEwem0wIDEwTDIwIDBIMTBMMCAyMHptMCAxMEwzMCAwSDIwTDAgMzB6bTAgMTBMNDAgMEgzMEwwIDQwek0xMCA0MEw0MCAxMEgzMEwxMCA0MHptMTAgMEw0MCAyMEgzMEwyMCA0MHptMTAgMEw0MCAzMEgzMEwzMCA0MHoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-100" />
        <div className="relative">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Zap className="w-4 h-4 text-amber-300" />
                <span className="text-xs font-semibold text-amber-300 uppercase tracking-wider">Current Plan</span>
              </div>
              <h3 className="text-2xl font-bold">Pro</h3>
              <p className="text-blue-200 text-sm mt-1">Unlimited searches · 1,000 saved leads</p>
            </div>
            <span className="text-2xl font-bold">$49<span className="text-base font-normal text-blue-300">/mo</span></span>
          </div>
          <div className="mt-4 flex gap-3">
            <a
              href="/pricing"
              className="inline-flex items-center gap-1.5 text-xs font-semibold bg-white/20 hover:bg-white/30 text-white px-3 py-2 rounded-lg transition-colors"
            >
              Upgrade to Agency
              <ChevronRight className="w-3 h-3" />
            </a>
            <button
              onClick={handleManageBilling}
              disabled={billingLoading}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-200 hover:text-white px-3 py-2 rounded-lg transition-colors disabled:opacity-60"
            >
              {billingLoading ? 'Opening…' : 'Manage Billing'}
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
          {billingError && (
            <p className="mt-3 text-xs text-red-300">{billingError}</p>
          )}
        </div>
      </div>

      {/* Usage Stats */}
      <div className="grid gap-4">
        <h3 className="text-sm font-semibold text-[#0F172A]">Usage This Month</h3>

        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#0369A1]" />
                <span className="text-sm font-medium text-[#0F172A]">Searches</span>
              </div>
              <div className="text-right">
                <span className="text-sm font-bold text-[#0F172A]">12</span>
                <span className="text-xs text-slate-400"> / Unlimited</span>
              </div>
            </div>
            <UsageBar used={12} total={null} />
            <p className="text-xs text-slate-400 mt-1.5">Unlimited searches on Pro plan</p>
          </div>

          <div className="border-t border-slate-100" />

          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Bookmark className="w-4 h-4 text-[#0369A1]" />
                <span className="text-sm font-medium text-[#0F172A]">Saved Leads</span>
              </div>
              <div className="text-right">
                <span className="text-sm font-bold text-[#0F172A]">23</span>
                <span className="text-xs text-slate-400"> / 1,000</span>
              </div>
            </div>
            <UsageBar used={23} total={1000} />
            <p className="text-xs text-slate-400 mt-1.5">977 slots remaining</p>
          </div>
        </div>

        {/* Billing info */}
        <div className="flex items-start gap-3 bg-slate-50 border border-slate-200 rounded-xl p-4">
          <CreditCard className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-700">Payments powered by Stripe</p>
            <p className="text-xs text-slate-400 mt-0.5">Click &quot;Manage Billing&quot; above to update payment method, view invoices, or cancel your plan.</p>
          </div>
          <button
            onClick={handleManageBilling}
            disabled={billingLoading}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0369A1] hover:text-[#0F172A] transition-colors disabled:opacity-60 shrink-0"
          >
            {billingLoading ? 'Opening…' : 'Open Portal'}
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  )
}

const NOTIF_KEY = 'leadzip_notifications'

const DEFAULT_PREFS = {
  emailLeadsFound: true,
  weeklyDigest: false,
  systemUpdates: true,
  newFeatures: true,
  usageAlerts: true,
}

function NotificationsTab() {
  const [prefs, setPrefs] = useState(DEFAULT_PREFS)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(NOTIF_KEY)
      if (raw) setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(raw) })
    } catch { /* ignore */ }
  }, [])

  const toggle = (key: keyof typeof prefs) => {
    setPrefs((p) => ({ ...p, [key]: !p[key] }))
    setSaved(false)
  }

  const handleSave = () => {
    try {
      localStorage.setItem(NOTIF_KEY, JSON.stringify(prefs))
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch { /* ignore */ }
  }

  const items = [
    {
      key: 'emailLeadsFound' as const,
      label: 'Email when leads found',
      desc: 'Get notified when a search returns new results',
      icon: <Mail className="w-4 h-4 text-[#0369A1]" />,
    },
    {
      key: 'weeklyDigest' as const,
      label: 'Weekly digest',
      desc: 'Summary of your pipeline activity every Monday',
      icon: <BarChart3 className="w-4 h-4 text-[#0369A1]" />,
    },
    {
      key: 'systemUpdates' as const,
      label: 'System updates',
      desc: 'Maintenance windows and downtime alerts',
      icon: <AlertCircle className="w-4 h-4 text-[#0369A1]" />,
    },
    {
      key: 'newFeatures' as const,
      label: 'New features',
      desc: 'Be the first to know about new LeadZip features',
      icon: <Zap className="w-4 h-4 text-[#0369A1]" />,
    },
    {
      key: 'usageAlerts' as const,
      label: 'Usage limit alerts',
      desc: 'Alert when you reach 80% of your plan limits',
      icon: <Bell className="w-4 h-4 text-[#0369A1]" />,
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[#0F172A]">Notification Preferences</h2>
        <p className="text-sm text-slate-500 mt-0.5">Choose how and when you want to be notified</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
        {items.map((item) => (
          <div key={item.key} className="flex items-center gap-4 px-5 py-4">
            <div className="w-9 h-9 rounded-xl bg-[#0369A1]/8 flex items-center justify-center shrink-0">
              {item.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#0F172A]">{item.label}</p>
              <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
            </div>
            <ToggleSwitch checked={prefs[item.key]} onChange={() => toggle(item.key)} />
          </div>
        ))}
      </div>

      <button
        onClick={handleSave}
        className={cn(
          'inline-flex items-center gap-2 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors',
          saved ? 'bg-green-600' : 'bg-[#0F172A] hover:bg-[#0369A1]'
        )}
      >
        <Check className="w-4 h-4" />
        {saved ? 'Saved!' : 'Save Preferences'}
      </button>
    </div>
  )
}

function ComplianceTab() {
  const cards = [
    {
      icon: <ShieldCheck className="w-5 h-5 text-amber-600" />,
      bg: 'bg-amber-50 border-amber-200',
      iconBg: 'bg-amber-100',
      title: 'Your Outreach Responsibility',
      content:
        'LeadZip provides business contact information from publicly available sources. You are solely responsible for ensuring your outreach complies with all applicable laws. Never send unsolicited bulk emails or calls without proper consent mechanisms in place.',
    },
    {
      icon: <Mail className="w-5 h-5 text-[#0369A1]" />,
      bg: 'bg-blue-50 border-blue-200',
      iconBg: 'bg-blue-100',
      title: 'CAN-SPAM Compliance',
      content:
        'All commercial email must include your physical address, a working unsubscribe mechanism, and honest subject lines. Honor opt-out requests within 10 business days. Subject lines must accurately reflect email content.',
    },
    {
      icon: <Info className="w-5 h-5 text-purple-600" />,
      bg: 'bg-purple-50 border-purple-200',
      iconBg: 'bg-purple-100',
      title: 'GDPR Considerations',
      content:
        'If you contact businesses in the European Union, you must have a lawful basis for processing their data. Legitimate interest may apply for B2B outreach in some cases. Maintain records of your data processing activities.',
    },
    {
      icon: <Check className="w-5 h-5 text-emerald-600" />,
      bg: 'bg-emerald-50 border-emerald-200',
      iconBg: 'bg-emerald-100',
      title: 'Our Data Sources',
      content:
        'All business data in LeadZip is sourced from publicly available business directories, map services, and business registrations. We do not scrape private profiles or purchase consumer data. Contact information shown represents publicly listed business contact details.',
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[#0F172A]">Compliance & Legal</h2>
        <p className="text-sm text-slate-500 mt-0.5">Important information about responsible lead generation</p>
      </div>

      <div className="grid gap-4">
        {cards.map((card) => (
          <div key={card.title} className={cn('border rounded-xl p-5', card.bg)}>
            <div className="flex items-start gap-4">
              <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', card.iconBg)}>
                {card.icon}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[#0F172A] mb-1.5">{card.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{card.content}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-start gap-3 bg-slate-50 border border-slate-200 rounded-xl p-4">
        <AlertCircle className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
        <p className="text-xs text-slate-500 leading-relaxed">
          This information is provided for general guidance only and does not constitute legal advice.
          Consult a qualified attorney for compliance advice specific to your situation and jurisdiction.
        </p>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('profile')

  const renderTab = () => {
    switch (activeTab) {
      case 'profile': return <ProfileTab />
      case 'plan': return <PlanTab />
      case 'notifications': return <NotificationsTab />
      case 'compliance': return <ComplianceTab />
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#0F172A]">Settings</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage your account, plan, and preferences</p>
        </div>

        <div className="flex gap-6">
          <div className="w-52 shrink-0">
            <nav className="space-y-1">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all text-left',
                    activeTab === tab.id
                      ? 'bg-[#0369A1] text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  )}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="flex-1 bg-white border border-slate-200 rounded-xl shadow-sm p-6">
            {renderTab()}
          </div>
        </div>
      </div>
    </div>
  )
}
