'use client'

import { useState, useEffect, useRef } from 'react'
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
  Palette,
  Upload,
  X,
  Code2,
  Copy,
  Trash2,
  RefreshCw,
  Eye,
  EyeOff,
  Plug,
  CheckCircle2,
  Link2Off,
  Users,
  UserMinus,
  Send,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { getWhiteLabel, saveWhiteLabel, type WhiteLabelSettings } from '@/lib/white-label'

const isSupabaseConfigured =
  process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder.supabase.co'

type TabId = 'profile' | 'plan' | 'notifications' | 'compliance' | 'whitelabel' | 'api' | 'integrations' | 'team'

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
  { id: 'whitelabel', label: 'White Label', icon: <Palette className="w-4 h-4" /> },
  { id: 'api', label: 'API', icon: <Code2 className="w-4 h-4" /> },
  { id: 'integrations', label: 'Integrations', icon: <Plug className="w-4 h-4" /> },
  { id: 'team', label: 'Team', icon: <Users className="w-4 h-4" /> },
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
      // eslint-disable-next-line react-hooks/set-state-in-effect
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

interface ApiKey {
  id: string
  name: string
  key_prefix: string
  created_at: string
  last_used_at: string | null
}

function ApiTab() {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [newKey, setNewKey] = useState<string | null>(null)
  const [newKeyName, setNewKeyName] = useState('')
  const [copied, setCopied] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [revoking, setRevoking] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/api-keys')
      .then((r) => r.json())
      .then((d) => { setKeys(d.keys ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function handleGenerate() {
    setGenerating(true)
    const res = await fetch('/api/api-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newKeyName.trim() || 'Default' }),
    })
    const data = await res.json()
    if (res.ok) {
      setNewKey(data.key)
      setShowKey(true)
      setNewKeyName('')
      const fresh = await fetch('/api/api-keys').then((r) => r.json())
      setKeys(fresh.keys ?? [])
    }
    setGenerating(false)
  }

  async function handleRevoke(id: string) {
    setRevoking(id)
    await fetch(`/api/api-keys/${id}`, { method: 'DELETE' })
    setKeys((prev) => prev.filter((k) => k.id !== id))
    setRevoking(null)
  }

  function copyKey() {
    if (!newKey) return
    navigator.clipboard.writeText(newKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const DAILY_LIMITS: Record<string, string> = { free: '100 req/day', pro: '1,000 req/day', agency: '10,000 req/day' }

  return (
    <div className="space-y-6">
      {/* New key banner */}
      {newKey && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-800 mb-1">Save this key — it won&apos;t be shown again</p>
          <div className="flex items-center gap-2 mt-2">
            <code className="flex-1 rounded-lg bg-white border border-amber-200 px-3 py-2 text-xs font-mono text-slate-700 truncate">
              {showKey ? newKey : '•'.repeat(40)}
            </code>
            <button onClick={() => setShowKey((v) => !v)} className="p-2 rounded-lg hover:bg-amber-100 text-amber-700">
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
            <button onClick={copyKey} className="p-2 rounded-lg hover:bg-amber-100 text-amber-700">
              {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
          <button onClick={() => setNewKey(null)} className="mt-2 text-xs text-amber-600 hover:underline">Dismiss</button>
        </div>
      )}

      {/* Generate */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <h2 className="text-base font-semibold text-[#0F172A] mb-1">API Keys</h2>
        <p className="text-sm text-slate-500 mb-5">Use API keys to query LeadZip programmatically. Keys are scoped to your account and plan.</p>

        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="Key name (optional)"
            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0369A1]/30 focus:border-[#0369A1]"
          />
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-2 rounded-lg bg-[#0369A1] px-4 py-2 text-sm font-medium text-white hover:bg-[#0284C7] disabled:opacity-50 transition-colors"
          >
            {generating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Code2 className="h-4 w-4" />}
            Generate key
          </button>
        </div>

        {/* Rate limits info */}
        <div className="flex flex-wrap gap-3 mt-4 mb-6">
          {Object.entries(DAILY_LIMITS).map(([plan, limit]) => (
            <span key={plan} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 font-medium capitalize">
              {plan}: {limit}
            </span>
          ))}
        </div>

        {/* Key list */}
        {loading ? (
          <p className="text-sm text-slate-400">Loading keys…</p>
        ) : keys.length === 0 ? (
          <p className="text-sm text-slate-400">No API keys yet. Generate one above.</p>
        ) : (
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden">
            {keys.map((k) => (
              <div key={k.id} className="flex items-center gap-3 px-4 py-3 bg-white">
                <code className="flex-1 text-xs font-mono text-slate-600">{k.key_prefix}••••••••••••••••••••••••</code>
                <div className="text-right min-w-[120px]">
                  <p className="text-xs font-medium text-slate-700">{k.name}</p>
                  <p className="text-xs text-slate-400">
                    {k.last_used_at
                      ? `Last used ${new Date(k.last_used_at).toLocaleDateString()}`
                      : `Created ${new Date(k.created_at).toLocaleDateString()}`}
                  </p>
                </div>
                <button
                  onClick={() => handleRevoke(k.id)}
                  disabled={revoking === k.id}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                >
                  {revoking === k.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        See the <a href="/api-docs" className="text-[#0369A1] font-medium hover:underline">API documentation</a> for endpoint reference and code examples.
      </div>
    </div>
  )
}

interface WorkspaceMember {
  user_id: string
  role: string
  joined_at: string
  users_profile: { email: string; full_name: string } | null
}

interface PendingInvite {
  id: string
  email: string
  created_at: string
  expires_at: string
}

function TeamTab() {
  const [workspaceName, setWorkspaceName] = useState<string | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [members, setMembers] = useState<WorkspaceMember[]>([])
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newWorkspaceName, setNewWorkspaceName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [userPlan, setUserPlan] = useState<string>('free')

  // State is only set in the async continuation (never synchronously), so this is
  // safe to call from an effect without triggering cascading renders.
  const load = () =>
    Promise.all([
      fetch('/api/workspace').then(r => r.json()),
      fetch('/api/leads/saved').then(() => null).catch(() => null), // just a way to get plan
    ]).then(([wsRes]) => {
      setWorkspaceName(wsRes.workspace?.name ?? null)
      setRole(wsRes.role)
      setMembers(wsRes.members ?? [])
      setPendingInvites(wsRes.pendingInvites ?? [])
      setLoading(false)
    })

  useEffect(() => {
    load()
    // Get plan from supabase
    import('@/lib/supabase/client').then(({ createClient }) => {
      const supabase = createClient()
      supabase.from('users_profile').select('plan').single().then(({ data }) => {
        if (data?.plan) setUserPlan(data.plan)
      })
    })
  }, [])

  const handleCreateWorkspace = async () => {
    if (!newWorkspaceName.trim()) return
    setCreating(true)
    const res = await fetch('/api/workspace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newWorkspaceName.trim() }),
    })
    const data = await res.json()
    setCreating(false)
    if (res.ok) {
      setWorkspaceName(data.workspace.name)
      setRole('owner')
      setNewWorkspaceName('')
    }
  }

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return
    setInviting(true)
    setInviteError(null)
    setInviteSuccess(null)
    const res = await fetch('/api/workspace/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail.trim() }),
    })
    const data = await res.json()
    setInviting(false)
    if (res.ok) {
      setInviteSuccess(`Invite sent to ${inviteEmail.trim()}`)
      setInviteEmail('')
      load()
    } else {
      setInviteError(data.error ?? 'Failed to send invite')
    }
  }

  const handleRemove = async (userId: string) => {
    setRemovingId(userId)
    await fetch(`/api/workspace/members/${userId}`, { method: 'DELETE' })
    setMembers(prev => prev.filter(m => m.user_id !== userId))
    setRemovingId(null)
  }

  const handleCancelInvite = async (inviteId: string) => {
    await fetch('/api/workspace/invite', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: inviteId }),
    })
    setPendingInvites(prev => prev.filter(i => i.id !== inviteId))
  }

  if (loading) return <div className="text-sm text-slate-400 py-6 text-center">Loading…</div>

  if (userPlan !== 'agency' && !workspaceName) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-[#0F172A]">Team Workspaces</h2>
          <p className="text-sm text-slate-500 mt-0.5">Invite teammates and share your plan across your agency.</p>
        </div>
        <div className="border border-slate-200 rounded-xl p-6 text-center space-y-3">
          <Users className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-sm font-medium text-slate-600">Agency plan required</p>
          <p className="text-xs text-slate-400">Upgrade to Agency to create a workspace and invite team members.</p>
          <a href="/pricing" className="inline-block text-sm font-medium text-[#0369A1] hover:underline">View Pricing →</a>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-[#0F172A]">Team Workspaces</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          {role === 'member' ? `You're a member of ${workspaceName}.` : 'Manage your team and send invitations.'}
        </p>
      </div>

      {/* Create workspace (agency owners without one yet) */}
      {!workspaceName && userPlan === 'agency' && (
        <div className="border border-dashed border-slate-300 rounded-xl p-5 space-y-3">
          <p className="text-sm font-medium text-[#0F172A]">Create your workspace</p>
          <p className="text-xs text-slate-500">Name your team — members will see this when they accept your invite.</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={newWorkspaceName}
              onChange={e => setNewWorkspaceName(e.target.value)}
              placeholder="e.g. Apex Marketing Agency"
              className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0369A1]/20 focus:border-[#0369A1]"
            />
            <button
              onClick={handleCreateWorkspace}
              disabled={creating || !newWorkspaceName.trim()}
              className="text-sm font-medium bg-[#0369A1] text-white px-4 py-2 rounded-lg hover:bg-[#0284c7] transition-colors disabled:opacity-50"
            >
              {creating ? 'Creating…' : 'Create'}
            </button>
          </div>
        </div>
      )}

      {/* Workspace info + invite (owner) */}
      {workspaceName && role === 'owner' && (
        <>
          <div className="bg-violet-50 border border-violet-100 rounded-xl px-4 py-3 flex items-center gap-3">
            <Users className="w-4 h-4 text-violet-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-[#0F172A]">{workspaceName}</p>
              <p className="text-xs text-slate-500">{members.length} member{members.length !== 1 ? 's' : ''} · Agency plan</p>
            </div>
          </div>

          {/* Invite form */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-[#0F172A]">Invite a teammate</p>
            <div className="flex gap-2">
              <input
                type="email"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder="teammate@company.com"
                className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0369A1]/20 focus:border-[#0369A1]"
                onKeyDown={e => e.key === 'Enter' && handleInvite()}
              />
              <button
                onClick={handleInvite}
                disabled={inviting || !inviteEmail.trim()}
                className="inline-flex items-center gap-1.5 text-sm font-medium bg-[#0369A1] text-white px-4 py-2 rounded-lg hover:bg-[#0284c7] transition-colors disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                {inviting ? 'Sending…' : 'Send Invite'}
              </button>
            </div>
            {inviteError && <p className="text-xs text-red-600">{inviteError}</p>}
            {inviteSuccess && <p className="text-xs text-emerald-600">{inviteSuccess}</p>}
          </div>

          {/* Members list */}
          {members.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-[#0F172A]">Members</p>
              <div className="space-y-1">
                {members.map(m => (
                  <div key={m.user_id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-slate-50">
                    <div>
                      <p className="text-sm text-[#0F172A]">{m.users_profile?.full_name || m.users_profile?.email}</p>
                      <p className="text-xs text-slate-400">{m.users_profile?.email} · {m.role}</p>
                    </div>
                    {m.role !== 'owner' && (
                      <button
                        onClick={() => handleRemove(m.user_id)}
                        disabled={removingId === m.user_id}
                        className="text-xs text-slate-400 hover:text-red-600 transition-colors p-1 rounded"
                      >
                        <UserMinus className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pending invites */}
          {pendingInvites.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-[#0F172A]">Pending invitations</p>
              <div className="space-y-1">
                {pendingInvites.map(inv => (
                  <div key={inv.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-amber-50 border border-amber-100">
                    <div>
                      <p className="text-sm text-[#0F172A]">{inv.email}</p>
                      <p className="text-xs text-slate-400">Expires {new Date(inv.expires_at).toLocaleDateString()}</p>
                    </div>
                    <button
                      onClick={() => handleCancelInvite(inv.id)}
                      className="text-xs text-slate-400 hover:text-red-600 transition-colors p-1 rounded"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Member view */}
      {workspaceName && role === 'member' && (
        <div className="bg-violet-50 border border-violet-100 rounded-xl px-4 py-4 space-y-1">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-violet-500" />
            <p className="text-sm font-semibold text-[#0F172A]">{workspaceName}</p>
          </div>
          <p className="text-xs text-slate-500 pl-6">You have access to all features under this team&apos;s plan.</p>
        </div>
      )}
    </div>
  )
}

type CrmType = 'hubspot' | 'gohighlevel' | 'pipedrive'

const CRM_META: Record<CrmType, { label: string; placeholder: string; helpUrl: string; help: string }> = {
  hubspot: {
    label: 'HubSpot',
    placeholder: 'pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
    helpUrl: 'https://developers.hubspot.com/docs/api/private-apps',
    help: 'Create a Private App in HubSpot → Settings → Integrations → Private Apps. Grant CRM (contacts, companies) read/write scopes.',
  },
  gohighlevel: {
    label: 'GoHighLevel',
    placeholder: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    helpUrl: 'https://highlevel.stoplight.io/docs/integrations/0443d7d1a4bd0-overview',
    help: 'Find your API key in GHL → Settings → Integrations → API Keys.',
  },
  pipedrive: {
    label: 'Pipedrive',
    placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    helpUrl: 'https://pipedrive.readme.io/docs/how-to-find-the-api-token',
    help: 'Find your API token in Pipedrive → Settings → Personal Preferences → API.',
  },
}

function IntegrationsTab() {
  const [connected, setConnected] = useState<CrmType[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState<CrmType | null>(null)
  const [keyInput, setKeyInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState<CrmType | null>(null)

  useEffect(() => {
    fetch('/api/integrations')
      .then(r => r.json())
      .then(d => setConnected((d.integrations ?? []).map((i: { crm_type: CrmType }) => i.crm_type)))
      .finally(() => setLoading(false))
  }, [])

  const handleConnect = async (crm: CrmType) => {
    if (!keyInput.trim()) return
    setSaving(true)
    setError(null)
    const res = await fetch('/api/integrations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ crm_type: crm, api_key: keyInput.trim() }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error ?? 'Failed to connect'); return }
    setConnected(prev => [...prev.filter(c => c !== crm), crm])
    setAdding(null)
    setKeyInput('')
  }

  const handleDisconnect = async (crm: CrmType) => {
    setDisconnecting(crm)
    await fetch(`/api/integrations/${crm}`, { method: 'DELETE' })
    setConnected(prev => prev.filter(c => c !== crm))
    setDisconnecting(null)
  }

  const crms: CrmType[] = ['hubspot', 'gohighlevel', 'pipedrive']

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-[#0F172A]">CRM Integrations</h2>
        <p className="text-sm text-slate-500 mt-0.5">Connect your CRM to push saved leads with one click.</p>
      </div>

      {loading ? (
        <div className="text-sm text-slate-400 py-6 text-center">Loading…</div>
      ) : (
        <div className="space-y-3">
          {crms.map(crm => {
            const meta = CRM_META[crm]
            const isConnected = connected.includes(crm)
            const isAdding = adding === crm

            return (
              <div key={crm} className="border border-slate-200 rounded-xl p-4 bg-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {isConnected ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-slate-200" />
                    )}
                    <div>
                      <p className="text-sm font-semibold text-[#0F172A]">{meta.label}</p>
                      <p className="text-xs text-slate-500">
                        {isConnected ? 'Connected' : 'Not connected'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isConnected ? (
                      <button
                        onClick={() => handleDisconnect(crm)}
                        disabled={disconnecting === crm}
                        className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-red-600 border border-slate-200 hover:border-red-200 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                      >
                        <Link2Off className="w-3.5 h-3.5" />
                        {disconnecting === crm ? 'Disconnecting…' : 'Disconnect'}
                      </button>
                    ) : (
                      <button
                        onClick={() => { setAdding(isAdding ? null : crm); setKeyInput(''); setError(null) }}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-[#0369A1] border border-[#0369A1]/30 hover:bg-[#0369A1]/5 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <Plug className="w-3.5 h-3.5" />
                        Connect
                      </button>
                    )}
                  </div>
                </div>

                {isAdding && (
                  <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
                    <p className="text-xs text-slate-500">{meta.help}{' '}
                      <a href={meta.helpUrl} target="_blank" rel="noopener noreferrer" className="text-[#0369A1] hover:underline">
                        Docs →
                      </a>
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        value={keyInput}
                        onChange={e => setKeyInput(e.target.value)}
                        placeholder={meta.placeholder}
                        className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0369A1]/20 focus:border-[#0369A1] font-mono"
                      />
                      <button
                        onClick={() => handleConnect(crm)}
                        disabled={saving || !keyInput.trim()}
                        className="text-sm font-medium bg-[#0369A1] text-white px-4 py-2 rounded-lg hover:bg-[#0284c7] transition-colors disabled:opacity-50"
                      >
                        {saving ? 'Validating…' : 'Save'}
                      </button>
                    </div>
                    {error && <p className="text-xs text-red-600">{error}</p>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function WhiteLabelTab() {
  // Lazy initializer: WhiteLabelTab only mounts client-side (tab switch), so reading
  // localStorage here is safe and avoids a setState-in-effect cascade.
  const [settings, setSettings] = useState<WhiteLabelSettings>(() => getWhiteLabel())
  const [saved, setSaved] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setSettings((prev) => ({ ...prev, logoDataUrl: ev.target?.result as string }))
    }
    reader.readAsDataURL(file)
  }

  function handleSave() {
    saveWhiteLabel(settings)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <h2 className="text-base font-semibold text-[#0F172A] mb-1">White Label Exports</h2>
        <p className="text-sm text-slate-500 mb-6">Add your agency branding to PDF exports. Your logo and colors replace LeadZip branding on all exported reports.</p>

        {/* Agency Name */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Agency Name</label>
          <input
            type="text"
            value={settings.agencyName}
            onChange={(e) => setSettings((prev) => ({ ...prev, agencyName: e.target.value }))}
            placeholder="Acme Lead Agency"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0369A1]/30 focus:border-[#0369A1]"
          />
        </div>

        {/* Logo Upload */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Agency Logo</label>
          <div className="flex items-center gap-3">
            {settings.logoDataUrl ? (
              <div className="relative flex-shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={settings.logoDataUrl} alt="Logo preview" className="h-12 w-12 rounded-lg object-contain border border-slate-200 bg-slate-50 p-1" />
                <button
                  onClick={() => setSettings((prev) => ({ ...prev, logoDataUrl: '' }))}
                  className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-slate-500 text-white flex items-center justify-center hover:bg-slate-700"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            ) : null}
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 rounded-lg border border-dashed border-slate-300 px-4 py-2.5 text-sm text-slate-600 hover:border-[#0369A1] hover:text-[#0369A1] transition-colors"
            >
              <Upload className="h-4 w-4" />
              {settings.logoDataUrl ? 'Replace logo' : 'Upload logo'}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
            <span className="text-xs text-slate-400">PNG, SVG, or JPG — shown in PDF header</span>
          </div>
        </div>

        {/* Accent Color */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Accent Color</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={settings.accentColor}
              onChange={(e) => setSettings((prev) => ({ ...prev, accentColor: e.target.value }))}
              className="h-9 w-16 cursor-pointer rounded-lg border border-slate-200 p-0.5"
            />
            <span className="text-sm font-mono text-slate-600">{settings.accentColor}</span>
            <span className="text-xs text-slate-400">Used for table headers and section titles in exports</span>
          </div>
        </div>

        {/* Preview strip */}
        {(settings.agencyName || settings.logoDataUrl) && (
          <div className="mb-6 rounded-xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-xs text-slate-400 mb-2 font-medium uppercase tracking-wide">PDF Header Preview</p>
            <div className="flex items-center gap-3 bg-white rounded-lg border border-slate-100 px-4 py-3">
              {settings.logoDataUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={settings.logoDataUrl} alt="" className="h-8 w-8 object-contain flex-shrink-0" />
              )}
              <div>
                <p className="text-sm font-bold" style={{ color: settings.accentColor }}>
                  {settings.agencyName || 'Your Agency'}
                </p>
                <p className="text-xs text-slate-400">Lead Report — {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={handleSave}
          className={cn(
            'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all',
            saved
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-[#0369A1] text-white hover:bg-[#0284C7]'
          )}
        >
          {saved ? <><Check className="h-4 w-4" /> Saved</> : 'Save branding'}
        </button>
      </div>

      <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700">
        <strong>Pro tip:</strong> After saving, go to <strong>Exports</strong> and choose <em>Branded PDF</em> to generate a report with your agency&apos;s logo and colors.
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
      case 'whitelabel': return <WhiteLabelTab />
      case 'api': return <ApiTab />
      case 'integrations': return <IntegrationsTab />
      case 'team': return <TeamTab />
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
