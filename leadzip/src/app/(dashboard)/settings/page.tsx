'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
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
  MessageCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { getWhiteLabel, saveWhiteLabel, type WhiteLabelSettings } from '@/lib/white-label'
import { CHAT_HIDDEN_KEY, CHAT_VISIBILITY_EVENT } from '@/components/chat/ChatWidget'
import { COOKIE_PREFERENCES_EVENT } from '@/components/CookieConsent'

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
        checked ? 'bg-signal' : 'bg-sand'
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
  const barColor = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-signal'
  return (
    <div className="w-full bg-paper-2 rounded-full h-2 overflow-hidden">
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
        <h2 className="font-display text-lg font-bold text-ink">Profile Information</h2>
        <p className="text-sm text-stone mt-0.5">Update your account details</p>
      </div>

      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-signal to-forest flex items-center justify-center text-white font-bold text-xl">
          {fullName.charAt(0) || '?'}
        </div>
        <div>
          <p className="text-sm font-medium text-ink">{fullName || 'Your Name'}</p>
          <p className="readout text-stone mt-0.5">LeadZipp member</p>
        </div>
      </div>

      <div className="grid gap-5">
        <div>
          <label className="block text-sm font-medium text-ink mb-1.5">
            <span className="flex items-center gap-2">
              <User className="w-3.5 h-3.5 text-stone" />
              Full Name
            </span>
          </label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full px-3 py-2.5 text-sm border border-sand rounded-xl bg-paper focus:outline-none focus:ring-2 focus:ring-signal/20 focus:border-signal transition-all"
            placeholder="Your full name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-ink mb-1.5">
            <span className="flex items-center gap-2">
              <Mail className="w-3.5 h-3.5 text-stone" />
              Email Address
            </span>
          </label>
          <div className="relative">
            <input
              type="email"
              value={email}
              readOnly
              className="w-full px-3 py-2.5 pr-28 text-sm border border-sand rounded-xl bg-paper-2 text-stone cursor-not-allowed"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
              <Check className="w-3 h-3" />
              Verified
            </span>
          </div>
          <p className="text-xs text-stone mt-1.5 flex items-center gap-1">
            <Lock className="w-3 h-3" />
            Email cannot be changed. Contact support if needed.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-ink mb-1.5">
            <span className="flex items-center gap-2">
              <Building2 className="w-3.5 h-3.5 text-stone" />
              Company Name
            </span>
          </label>
          <input
            type="text"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            className="w-full px-3 py-2.5 text-sm border border-sand rounded-xl bg-paper focus:outline-none focus:ring-2 focus:ring-signal/20 focus:border-signal transition-all"
            placeholder="Your company name"
          />
        </div>
      </div>

      <div className="pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className={cn(
            'inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-full transition-all disabled:opacity-60',
            saved
              ? 'bg-emerald-500 text-white'
              : 'bg-signal text-white hover:bg-signal-600'
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

type PlanId = 'free' | 'pro' | 'agency'
type EmailCreditPack = { slug: string; credits: number; amountCents: number }

// Real plan definitions — matches the public pricing page and server policy.
const PLAN_META: Record<PlanId, {
  name: string
  price: number
  searchLimit: number | null
  savedLimit: number | null
  tagline: string
  upgradeLabel?: string
}> = {
  free: {
    name: 'Free',
    price: 0,
    searchLimit: 25,
    savedLimit: 25,
    tagline: '25 searches / month · 25 saved leads',
    upgradeLabel: 'Upgrade to Pro',
  },
  pro: {
    name: 'Pro',
    price: 25,
    searchLimit: 100,
    savedLimit: 1000,
    tagline: '100 live searches · 100 email credits · 1,000 saved leads',
    upgradeLabel: 'Upgrade to Agency',
  },
  agency: {
    name: 'Agency',
    price: 50,
    searchLimit: 300,
    savedLimit: 10000,
    tagline: '300 pooled live searches · 500 email credits · 5 seats',
  },
}

function PlanTab() {
  const [plan, setPlan] = useState<PlanId>('free')
  const [searchesUsed, setSearchesUsed] = useState(0)
  const [savedUsed, setSavedUsed] = useState(0)
  const [searchLimit, setSearchLimit] = useState<number | null>(25)
  const [savedLimit, setSavedLimit] = useState<number | null>(25)
  const [workspaceShared, setWorkspaceShared] = useState(false)
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false)
  const [canManageBilling, setCanManageBilling] = useState(false)
  const [emailCreditsRemaining, setEmailCreditsRemaining] = useState(0)
  const [emailCreditsAllowance, setEmailCreditsAllowance] = useState(5)
  const [emailCreditsPurchased, setEmailCreditsPurchased] = useState(0)
  const [emailCreditsShared, setEmailCreditsShared] = useState(false)
  const [emailCreditsAvailable, setEmailCreditsAvailable] = useState(false)
  const [emailCreditPacks, setEmailCreditPacks] = useState<EmailCreditPack[]>([])
  const [canPurchaseEmailCredits, setCanPurchaseEmailCredits] = useState(false)
  const [purchasingPack, setPurchasingPack] = useState<string | null>(null)
  const [trialDaysLeft, setTrialDaysLeft] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [billingLoading, setBillingLoading] = useState(false)
  const [billingError, setBillingError] = useState('')

  useEffect(() => {
    async function load() {
      if (!isSupabaseConfigured) {
        setLoading(false)
        return
      }
      try {
        const [response, creditsResponse] = await Promise.all([
          fetch('/api/usage', { cache: 'no-store' }),
          fetch('/api/credits/email', { cache: 'no-store' }),
        ])
        if (!response.ok) throw new Error('usage unavailable')
        const data = await response.json()
        const rawPlan = data.plan
        setPlan(rawPlan === 'pro' || rawPlan === 'agency' ? rawPlan : 'free')
        setSearchesUsed(data.searches?.used ?? 0)
        setSavedUsed(data.savedLeads?.used ?? 0)
        setSearchLimit(data.searches?.limit ?? null)
        setSavedLimit(data.savedLeads?.limit ?? null)
        setWorkspaceShared(data.workspaceShared === true)
        setIsPlatformAdmin(data.isPlatformAdmin === true)
        setCanManageBilling(data.canManageBilling === true)

        if (creditsResponse.ok) {
          const credits = await creditsResponse.json()
          setEmailCreditsRemaining(credits.includedRemaining ?? 0)
          setEmailCreditsAllowance(credits.allowanceSize ?? 0)
          setEmailCreditsPurchased(credits.purchasedRemaining ?? 0)
          setEmailCreditsShared(credits.shared === true)
          setEmailCreditsAvailable(true)
          setEmailCreditPacks(Array.isArray(credits.packs) ? credits.packs : [])
          setCanPurchaseEmailCredits(credits.canPurchasePacks === true)
        }

        // During a trial, current_period_end IS the trial end date.
        if (data.subscription?.status === 'trialing' && data.subscription.current_period_end) {
          const msLeft =
            new Date(data.subscription.current_period_end).getTime() - Date.now()
          setTrialDaysLeft(Math.max(0, Math.ceil(msLeft / 86_400_000)))
        }
      } catch {
        // Non-fatal — keep the free/zero defaults rather than fabricating a plan.
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleManageBilling = async () => {
    setBillingLoading(true)
    setBillingError('')
    try {
      if (!canManageBilling) {
        setBillingError('No active subscription found.')
        return
      }

      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
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

  const handleBuyEmailCredits = async (pack: string) => {
    setPurchasingPack(pack)
    setBillingError('')
    try {
      const response = await fetch('/api/credits/email/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pack }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data.url) {
        setBillingError(data.error || 'Could not open email-credit checkout.')
        return
      }
      window.location.assign(data.url)
    } catch {
      setBillingError('Could not open email-credit checkout. Please try again.')
    } finally {
      setPurchasingPack(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="font-display text-lg font-bold text-ink">Plan &amp; Usage</h2>
          <p className="text-sm text-stone mt-0.5">Monitor your usage and manage your subscription</p>
        </div>
        <div className="h-40 rounded-2xl bg-paper-2 animate-pulse" />
        <div className="h-36 rounded-2xl bg-paper-2 animate-pulse" />
      </div>
    )
  }

  const meta = PLAN_META[plan]
  const isPaid = plan !== 'free'
  const searchesRemaining =
    searchLimit !== null ? Math.max(0, searchLimit - searchesUsed) : null
  const savedRemaining =
    savedLimit !== null ? Math.max(0, savedLimit - savedUsed) : null

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-lg font-bold text-ink">Plan &amp; Usage</h2>
        <p className="text-sm text-stone mt-0.5">Monitor your usage and manage your subscription</p>
      </div>

      {/* Current Plan */}
      <div className="bg-gradient-to-br from-forest to-signal rounded-2xl p-6 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNCI+PHBhdGggZD0iTTAgMTBMMTAgMEgwdjEwem0wIDEwTDIwIDBIMTBMMCAyMHptMCAxMEwzMCAwSDIwTDAgMzB6bTAgMTBMNDAgMEgzMEwwIDQwek0xMCA0MEw0MCAxMEgzMEwxMCA0MHptMTAgMEw0MCAyMEgzMEwyMCA0MHptMTAgMEw0MCAzMEgzMEwzMCA0MHoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-100" />
        <div className="relative">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Zap className="w-4 h-4 text-lime" />
                <span className="readout text-lime">Current Plan</span>
              </div>
              <div className="flex items-center gap-2">
                <h3 className="font-display text-2xl font-bold">{meta.name}</h3>
                {trialDaysLeft !== null && (
                  <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold text-white">
                    Trial - {trialDaysLeft} {trialDaysLeft === 1 ? 'day' : 'days'} left
                  </span>
                )}
              </div>
              <p className="text-white/80 text-sm mt-1">{meta.tagline}</p>
            </div>
            <span className="font-mono text-2xl font-bold">${meta.price}<span className="text-base font-normal text-white/70">/mo</span></span>
          </div>
          {(meta.upgradeLabel || isPaid) && (
            <div className="mt-4 flex flex-wrap gap-3">
              {meta.upgradeLabel && (
                <a
                  href="/pricing"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold bg-white/20 hover:bg-white/30 text-white px-3 py-2 rounded-full transition-colors"
                >
                  {meta.upgradeLabel}
                  <ChevronRight className="w-3 h-3" />
                </a>
              )}
              {isPaid && canManageBilling && (
                <button
                  onClick={handleManageBilling}
                  disabled={billingLoading}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-white/70 hover:text-white px-3 py-2 rounded-full transition-colors disabled:opacity-60"
                >
                  {billingLoading ? 'Opening…' : 'Manage Billing'}
                  <ExternalLink className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
          {billingError && (
            <p className="mt-3 text-xs text-red-300">{billingError}</p>
          )}
        </div>
      </div>

      {/* Usage Stats */}
      <div className="grid gap-4">
        <h3 className="font-display text-sm font-bold text-ink">Usage This Month</h3>

        <div className="bg-card border border-sand rounded-2xl p-4 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-signal" />
                <span className="text-sm font-medium text-ink">New live searches</span>
              </div>
              <div className="text-right">
                <span className="font-mono text-sm font-bold text-ink">{searchesUsed}</span>
                <span className="text-xs text-stone"> / {searchLimit ?? 'Unlimited'}</span>
              </div>
            </div>
            <UsageBar used={searchesUsed} total={searchLimit} />
            <p className="text-xs text-stone mt-1.5">
              {searchLimit === null
                ? 'Platform owner access is not metered.'
                : `${searchesRemaining?.toLocaleString()} of ${searchLimit.toLocaleString()} remaining this month. Cached reruns and filter changes are free.${workspaceShared ? ' Shared across your Agency workspace.' : ''}`}
            </p>
          </div>

          <div className="border-t border-sand" />

          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-signal" />
                <span className="text-sm font-medium text-ink">Email finder credits</span>
              </div>
              <div className="text-right">
                {emailCreditsAvailable ? (
                  <>
                    <span className="font-mono text-sm font-bold text-ink">{emailCreditsRemaining}</span>
                    <span className="text-xs text-stone"> / {emailCreditsAllowance}</span>
                  </>
                ) : (
                  <span className="text-xs text-stone">Unavailable</span>
                )}
              </div>
            </div>
            <UsageBar
              used={Math.max(0, emailCreditsAllowance - emailCreditsRemaining)}
              total={emailCreditsAvailable ? emailCreditsAllowance : null}
            />
            <p className="text-xs text-stone mt-1.5">
              {emailCreditsAvailable
                ? `${emailCreditsRemaining.toLocaleString()} included remaining${emailCreditsPurchased > 0 ? `, plus ${emailCreditsPurchased.toLocaleString()} purchased` : ''}.${emailCreditsShared ? ' Shared across your Agency workspace.' : ''} Cached and unsuccessful lookups cost 0.`
                : 'Email-credit metering will appear after the database migration is applied.'}
            </p>
            {canPurchaseEmailCredits && emailCreditPacks.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {emailCreditPacks.map((pack) => (
                  <button
                    key={pack.slug}
                    onClick={() => handleBuyEmailCredits(pack.slug)}
                    disabled={purchasingPack !== null}
                    className="rounded-full border border-sand bg-paper px-3 py-1.5 text-xs font-semibold text-ink-soft transition-colors hover:border-signal/40 hover:text-signal disabled:opacity-50"
                  >
                    {purchasingPack === pack.slug
                      ? 'Opening…'
                      : `${pack.credits.toLocaleString()} for $${(pack.amountCents / 100).toFixed(0)}`}
                  </button>
                ))}
                <span className="self-center text-[11px] text-stone">One-time credits do not expire.</span>
              </div>
            )}
          </div>

          <div className="border-t border-sand" />

          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Bookmark className="w-4 h-4 text-signal" />
                <span className="text-sm font-medium text-ink">Saved Leads</span>
              </div>
              <div className="text-right">
                <span className="font-mono text-sm font-bold text-ink">{savedUsed}</span>
                <span className="text-xs text-stone"> / {savedLimit?.toLocaleString() ?? 'Unlimited'}</span>
              </div>
            </div>
            <UsageBar used={savedUsed} total={savedLimit} />
            <p className="text-xs text-stone mt-1.5">
              {savedLimit === null ? 'Platform owner access is not metered.' : `${savedRemaining?.toLocaleString()} slots remaining`}
            </p>
          </div>
        </div>

        {/* Billing / upgrade info */}
        {isPaid && canManageBilling ? (
          <div className="flex items-start gap-3 bg-paper-2 border border-sand rounded-2xl p-4">
            <CreditCard className="w-5 h-5 text-stone shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-ink-soft">Payments powered by Stripe</p>
              <p className="text-xs text-stone mt-0.5">Click &quot;Manage Billing&quot; above to update payment method, view invoices, or cancel your plan.</p>
            </div>
            <button
              onClick={handleManageBilling}
              disabled={billingLoading}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-signal hover:text-signal-600 transition-colors disabled:opacity-60 shrink-0"
            >
              {billingLoading ? 'Opening…' : 'Open Portal'}
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        ) : isPlatformAdmin || workspaceShared ? (
          <div className="flex items-start gap-3 bg-paper-2 border border-sand rounded-2xl p-4">
            <Users className="w-5 h-5 text-stone shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-ink-soft">
                {isPlatformAdmin ? 'Platform owner access' : 'Agency workspace access'}
              </p>
              <p className="text-xs text-stone mt-0.5">
                {isPlatformAdmin
                  ? 'Customer-plan search and storage limits do not apply. Email Finder keeps a visible safety balance because provider lookups carry a real cost.'
                  : 'Your workspace owner manages billing and the team shares live-search and email-credit allowances.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3 bg-paper-2 border border-sand rounded-2xl p-4">
            <CreditCard className="w-5 h-5 text-stone shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-ink-soft">You&apos;re on the Free plan</p>
              <p className="text-xs text-stone mt-0.5">Upgrade to Pro for 100 live searches, bulk ZIP search, 100 monthly email credits, and 1,000 saved leads.</p>
            </div>
            <a
              href="/pricing"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-signal hover:text-signal-600 transition-colors shrink-0"
            >
              View Plans
              <ChevronRight className="w-3 h-3" />
            </a>
          </div>
        )}
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
  showHelpWidget: true,
}

function NotificationsTab() {
  const [prefs, setPrefs] = useState(DEFAULT_PREFS)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(NOTIF_KEY)
      const showHelpWidget = localStorage.getItem(CHAT_HIDDEN_KEY) !== 'true'
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPrefs({ ...DEFAULT_PREFS, ...(raw ? JSON.parse(raw) : {}), showHelpWidget })
    } catch { /* ignore */ }
  }, [])

  const toggle = (key: keyof typeof prefs) => {
    setPrefs((p) => ({ ...p, [key]: !p[key] }))
    setSaved(false)
  }

  const handleSave = () => {
    try {
      localStorage.setItem(NOTIF_KEY, JSON.stringify(prefs))
      localStorage.setItem(CHAT_HIDDEN_KEY, prefs.showHelpWidget ? 'false' : 'true')
      window.dispatchEvent(new CustomEvent(CHAT_VISIBILITY_EVENT, {
        detail: { hidden: !prefs.showHelpWidget },
      }))
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch { /* ignore */ }
  }

  const items = [
    {
      key: 'emailLeadsFound' as const,
      label: 'Email when leads found',
      desc: 'Get notified when a search returns new results',
      icon: <Mail className="w-4 h-4 text-signal" />,
    },
    {
      key: 'weeklyDigest' as const,
      label: 'Weekly digest',
      desc: 'Summary of your pipeline activity every Monday',
      icon: <BarChart3 className="w-4 h-4 text-signal" />,
    },
    {
      key: 'systemUpdates' as const,
      label: 'System updates',
      desc: 'Maintenance windows and downtime alerts',
      icon: <AlertCircle className="w-4 h-4 text-signal" />,
    },
    {
      key: 'newFeatures' as const,
      label: 'New features',
      desc: 'Be the first to know about new LeadZipp features',
      icon: <Zap className="w-4 h-4 text-signal" />,
    },
    {
      key: 'usageAlerts' as const,
      label: 'Usage limit alerts',
      desc: 'Alert when you reach 80% of your plan limits',
      icon: <Bell className="w-4 h-4 text-signal" />,
    },
    {
      key: 'showHelpWidget' as const,
      label: 'Show help widget',
      desc: 'Keep the support button visible; you can restore it here after hiding it',
      icon: <MessageCircle className="w-4 h-4 text-signal" />,
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-lg font-bold text-ink">Notification Preferences</h2>
        <p className="text-sm text-stone mt-0.5">Choose how and when you want to be notified</p>
      </div>

      <div className="bg-card border border-sand rounded-2xl divide-y divide-sand overflow-hidden">
        {items.map((item) => (
          <div key={item.key} className="flex items-center gap-4 px-5 py-4">
            <div className="w-9 h-9 rounded-xl bg-signal-50 flex items-center justify-center shrink-0">
              {item.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-ink">{item.label}</p>
              <p className="text-xs text-stone mt-0.5">{item.desc}</p>
            </div>
            <ToggleSwitch checked={prefs[item.key]} onChange={() => toggle(item.key)} />
          </div>
        ))}
      </div>

      <button
        onClick={handleSave}
        className={cn(
          'inline-flex items-center gap-2 text-white text-sm font-semibold px-5 py-2.5 rounded-full transition-colors',
          saved ? 'bg-emerald-600' : 'bg-signal hover:bg-signal-600'
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
        'LeadZipp provides business contact information from publicly available sources. You are solely responsible for ensuring your outreach complies with all applicable laws. Never send unsolicited bulk emails or calls without proper consent mechanisms in place.',
    },
    {
      icon: <Mail className="w-5 h-5 text-signal" />,
      bg: 'bg-signal-50 border-signal/20',
      iconBg: 'bg-signal/10',
      title: 'CAN-SPAM Compliance',
      content:
        'All commercial email must include your physical address, a working unsubscribe mechanism, and honest subject lines. Honor opt-out requests within 10 business days. Subject lines must accurately reflect email content.',
    },
    {
      icon: <Info className="w-5 h-5 text-lime" />,
      bg: 'bg-paper-2 border-sand',
      iconBg: 'bg-forest',
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
        'All business data in LeadZipp is sourced from publicly available business directories, map services, and business registrations. We do not scrape private profiles or purchase consumer data. Contact information shown represents publicly listed business contact details.',
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-lg font-bold text-ink">Compliance &amp; Legal</h2>
        <p className="text-sm text-stone mt-0.5">Important information about responsible lead generation</p>
      </div>

      <div className="grid gap-4">
        {cards.map((card) => (
          <div key={card.title} className={cn('border rounded-2xl p-5', card.bg)}>
            <div className="flex items-start gap-4">
              <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', card.iconBg)}>
                {card.icon}
              </div>
              <div>
                <h3 className="font-display text-sm font-bold text-ink mb-1.5">{card.title}</h3>
                <p className="text-sm text-ink-soft leading-relaxed">{card.content}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-start gap-3 bg-paper-2 border border-sand rounded-2xl p-4">
        <AlertCircle className="w-4 h-4 text-stone shrink-0 mt-0.5" />
        <p className="text-xs text-stone leading-relaxed">
          This information is provided for general guidance only and does not constitute legal advice.
          Consult a qualified attorney for compliance advice specific to your situation and jurisdiction.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sand bg-card p-4">
        <div>
          <p className="text-sm font-semibold text-ink">Your cookie choice</p>
          <p className="mt-0.5 text-xs text-stone">Review or change whether LeadZipp may use analytics cookies.</p>
        </div>
        <button
          onClick={() => window.dispatchEvent(new Event(COOKIE_PREFERENCES_EVENT))}
          className="rounded-full border border-sand px-4 py-2 text-xs font-semibold text-ink-soft transition-colors hover:border-signal hover:text-signal"
        >
          Cookie preferences
        </button>
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
  const [confirmingRevokeId, setConfirmingRevokeId] = useState<string | null>(null)
  const [canUseApi, setCanUseApi] = useState(false)
  const [apiError, setApiError] = useState('')

  useEffect(() => {
    fetch('/api/api-keys')
      .then((r) => r.json())
      .then((d) => { setKeys(d.keys ?? []); setCanUseApi(d.canUseApi === true); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function handleGenerate() {
    setGenerating(true)
    setApiError('')
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
    } else setApiError(data.error ?? 'Could not create an API key.')
    setGenerating(false)
  }

  async function handleRevoke(id: string) {
    setRevoking(id)
    setApiError('')
    try {
      const res = await fetch(`/api/api-keys/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setKeys((prev) => prev.filter((k) => k.id !== id))
      } else {
        const data = await res.json().catch(() => ({}))
        setApiError(data.error ?? 'Could not revoke that key. Please try again.')
      }
    } catch {
      setApiError('Could not revoke that key. Please try again.')
    } finally {
      setRevoking(null)
      setConfirmingRevokeId(null)
    }
  }

  function copyKey() {
    if (!newKey) return
    navigator.clipboard.writeText(newKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-6">
      {/* New key banner */}
      {newKey && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-800 mb-1">Save this key — it won&apos;t be shown again</p>
          <div className="flex items-center gap-2 mt-2">
            <code className="flex-1 rounded-lg bg-card border border-amber-200 px-3 py-2 text-xs font-mono text-ink-soft truncate">
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
      <div className="bg-card rounded-2xl border border-sand p-6">
        <h2 className="font-display text-base font-bold text-ink mb-1">API Keys</h2>
        <p className="text-sm text-stone mb-5">Use API keys to query LeadZipp programmatically. Keys are scoped to your account and plan.</p>

        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="Key name (optional)"
            className="flex-1 rounded-xl border border-sand bg-paper px-3 py-2 text-sm text-ink placeholder:text-stone focus:outline-none focus:ring-2 focus:ring-signal/30 focus:border-signal"
          />
          <button
            onClick={handleGenerate}
            disabled={generating || !canUseApi}
            className="flex items-center gap-2 rounded-full bg-signal px-4 py-2 text-sm font-semibold text-white hover:bg-signal-600 disabled:opacity-50 transition-colors"
          >
            {generating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Code2 className="h-4 w-4" />}
            Generate key
          </button>
        </div>

        {apiError && <p className="mb-3 text-xs text-red-600">{apiError}</p>}
        {!loading && !canUseApi && (
          <div className="mb-5 rounded-xl border border-sand bg-paper-2 px-4 py-3 text-sm text-ink-soft">
            API access is included with Agency. <a href="/pricing" className="font-semibold text-signal hover:underline">View Agency</a>
          </div>
        )}

        {/* Rate limits info */}
        <div className="flex flex-wrap gap-3 mt-4 mb-6">
          <span className="rounded-full bg-paper-2 px-3 py-1 text-xs text-ink-soft font-medium">
            Agency: <span className="font-mono">500 req/day</span>
          </span>
          <span className="rounded-full bg-paper-2 px-3 py-1 text-xs text-ink-soft font-medium">
            Live searches share the <span className="font-mono">300/month</span> workspace pool
          </span>
        </div>

        {/* Key list */}
        {loading ? (
          <p className="text-sm text-stone">Loading keys…</p>
        ) : keys.length === 0 ? (
          <p className="text-sm text-stone">No API keys yet. Generate one above.</p>
        ) : (
          <div className="divide-y divide-sand rounded-xl border border-sand overflow-hidden">
            {keys.map((k) => (
              <div key={k.id} className="flex items-center gap-3 px-4 py-3 bg-card">
                <code className="flex-1 text-xs font-mono text-ink-soft">{k.key_prefix}••••••••••••••••••••••••</code>
                <div className="text-right min-w-[120px]">
                  <p className="text-xs font-medium text-ink">{k.name}</p>
                  <p className="text-xs text-stone">
                    {k.last_used_at
                      ? `Last used ${new Date(k.last_used_at).toLocaleDateString()}`
                      : `Created ${new Date(k.created_at).toLocaleDateString()}`}
                  </p>
                </div>
                {confirmingRevokeId === k.id ? (
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      onClick={() => handleRevoke(k.id)}
                      disabled={revoking === k.id}
                      className="rounded-full bg-red-500 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-600 transition-colors disabled:opacity-50"
                    >
                      {revoking === k.id ? 'Revoking…' : 'Revoke?'}
                    </button>
                    <button
                      onClick={() => setConfirmingRevokeId(null)}
                      disabled={revoking === k.id}
                      className="rounded-full px-2 py-1 text-xs font-medium text-stone hover:text-ink transition-colors disabled:opacity-40"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmingRevokeId(k.id)}
                    aria-label={`Revoke ${k.name}`}
                    className="p-1.5 rounded-lg text-stone hover:text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-sand bg-paper-2 px-4 py-3 text-sm text-ink-soft">
        See the <a href="/api-docs" className="text-signal font-medium hover:underline">API documentation</a> for endpoint reference and code examples.
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
  const [confirmingRemoveId, setConfirmingRemoveId] = useState<string | null>(null)
  const [memberError, setMemberError] = useState<string | null>(null)
  const [cancelInviteError, setCancelInviteError] = useState<string | null>(null)
  const [userPlan, setUserPlan] = useState<string>('free')
  const [loadError, setLoadError] = useState(false)

  // State is only set in the async continuation (never synchronously), so this is
  // safe to call from an effect without triggering cascading renders.
  // Both calls must succeed: a failed usage read would otherwise leave the plan
  // at "free" and show an Agency customer the upgrade wall.
  const load = useCallback(
    (options?: { silent?: boolean }) =>
      Promise.all([
        fetch('/api/workspace').then(r => {
          if (!r.ok) throw new Error(`workspace responded ${r.status}`)
          return r.json()
        }),
        fetch('/api/usage', { cache: 'no-store' }).then(r => {
          if (!r.ok) throw new Error(`usage responded ${r.status}`)
          return r.json()
        }),
      ])
        .then(([wsRes, usageRes]) => {
          setWorkspaceName(wsRes.workspace?.name ?? null)
          setRole(wsRes.role)
          setMembers(wsRes.members ?? [])
          setPendingInvites(wsRes.pendingInvites ?? [])
          if (usageRes?.plan) setUserPlan(usageRes.plan)
          setLoadError(false)
        })
        .catch((error) => {
          console.error('[settings/team] workspace load failed', error)
          // A background refresh keeps the list it already has rather than
          // replacing a confirmed action with an error screen.
          if (!options?.silent) setLoadError(true)
        })
        .finally(() => setLoading(false)),
    []
  )

  useEffect(() => {
    load()
  }, [load])

  const handleRetryLoad = () => {
    setLoading(true)
    load()
  }

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
      load({ silent: true })
    } else {
      setInviteError(data.error ?? 'Failed to send invite')
    }
  }

  const handleRemove = async (userId: string) => {
    setRemovingId(userId)
    setMemberError(null)
    try {
      const res = await fetch(`/api/workspace/members/${userId}`, { method: 'DELETE' })
      if (res.ok) {
        setMembers(prev => prev.filter(m => m.user_id !== userId))
      } else {
        const data = await res.json().catch(() => ({}))
        setMemberError(data.error ?? 'Could not remove that member. Please try again.')
      }
    } catch {
      setMemberError('Could not remove that member. Please try again.')
    } finally {
      setRemovingId(null)
      setConfirmingRemoveId(null)
    }
  }

  const handleCancelInvite = async (inviteId: string) => {
    setCancelInviteError(null)
    try {
      const res = await fetch('/api/workspace/invite', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: inviteId }),
      })
      if (res.ok) {
        setPendingInvites(prev => prev.filter(i => i.id !== inviteId))
      } else {
        const data = await res.json().catch(() => ({}))
        setCancelInviteError(data.error ?? 'Could not cancel that invite. Please try again.')
      }
    } catch {
      setCancelInviteError('Could not cancel that invite. Please try again.')
    }
  }

  if (loading) return <div className="text-sm text-stone py-6 text-center">Loading…</div>

  if (loadError) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="font-display text-base font-bold text-ink">Team Workspaces</h2>
          <p className="text-sm text-stone mt-0.5">Invite teammates and share your plan across your agency.</p>
        </div>
        <div className="border border-sand rounded-2xl p-6 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-stone mx-auto" aria-hidden="true" />
          <p className="text-sm font-medium text-ink-soft">We could not load your team</p>
          <p className="text-xs text-stone">
            Nothing has changed with your workspace or your plan. Please try again in a moment.
          </p>
          <button
            onClick={handleRetryLoad}
            className="inline-flex items-center gap-2 rounded-full bg-signal px-4 py-2 text-sm font-semibold text-white hover:bg-signal-600"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Try again
          </button>
        </div>
      </div>
    )
  }

  if (userPlan !== 'agency') {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="font-display text-base font-bold text-ink">Team Workspaces</h2>
          <p className="text-sm text-stone mt-0.5">Invite teammates and share your plan across your agency.</p>
        </div>
        <div className="border border-sand rounded-2xl p-6 text-center space-y-3">
          <Users className="w-8 h-8 text-stone mx-auto" />
          <p className="text-sm font-medium text-ink-soft">Agency plan required</p>
          <p className="text-xs text-stone">Upgrade to Agency to create a workspace and invite team members.</p>
          <a href="/pricing" className="inline-block text-sm font-medium text-signal hover:underline">View Pricing →</a>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-base font-bold text-ink">Team Workspaces</h2>
        <p className="text-sm text-stone mt-0.5">
          {role === 'member' ? `You're a member of ${workspaceName}.` : 'Manage your team and send invitations.'}
        </p>
      </div>

      {/* Create workspace (agency owners without one yet) */}
      {!workspaceName && userPlan === 'agency' && (
        <div className="border border-dashed border-sand rounded-2xl p-5 space-y-3">
          <p className="text-sm font-medium text-ink">Create your workspace</p>
          <p className="text-xs text-stone">Name your team — members will see this when they accept your invite.</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={newWorkspaceName}
              onChange={e => setNewWorkspaceName(e.target.value)}
              placeholder="e.g. Apex Marketing Agency"
              className="flex-1 text-sm border border-sand bg-paper rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-signal/20 focus:border-signal"
            />
            <button
              onClick={handleCreateWorkspace}
              disabled={creating || !newWorkspaceName.trim()}
              className="text-sm font-semibold bg-signal text-white px-4 py-2 rounded-full hover:bg-signal-600 transition-colors disabled:opacity-50"
            >
              {creating ? 'Creating…' : 'Create'}
            </button>
          </div>
        </div>
      )}

      {/* Workspace info + invite (owner) */}
      {workspaceName && role === 'owner' && (
        <>
          <div className="bg-signal-50 border border-signal/20 rounded-2xl px-4 py-3 flex items-center gap-3">
            <Users className="w-4 h-4 text-signal flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-ink">{workspaceName}</p>
              <p className="text-xs text-stone"><span className="font-mono">{members.length}</span> member{members.length !== 1 ? 's' : ''} · Agency plan</p>
            </div>
          </div>

          {/* Invite form */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-ink">Invite a teammate</p>
            <div className="flex gap-2">
              <input
                type="email"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder="teammate@company.com"
                className="flex-1 text-sm border border-sand bg-paper rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-signal/20 focus:border-signal"
                onKeyDown={e => e.key === 'Enter' && handleInvite()}
              />
              <button
                onClick={handleInvite}
                disabled={inviting || !inviteEmail.trim()}
                className="inline-flex items-center gap-1.5 text-sm font-semibold bg-signal text-white px-4 py-2 rounded-full hover:bg-signal-600 transition-colors disabled:opacity-50"
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
              <p className="text-sm font-medium text-ink">Members</p>
              {memberError && <p className="text-xs text-red-600">{memberError}</p>}
              <div className="space-y-1">
                {members.map(m => (
                  <div key={m.user_id} className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-paper-2">
                    <div>
                      <p className="text-sm text-ink">{m.users_profile?.full_name || m.users_profile?.email}</p>
                      <p className="text-xs text-stone">{m.users_profile?.email} · {m.role}</p>
                    </div>
                    {m.role !== 'owner' && (
                      confirmingRemoveId === m.user_id ? (
                        <div className="flex shrink-0 items-center gap-1.5">
                          <button
                            onClick={() => handleRemove(m.user_id)}
                            disabled={removingId === m.user_id}
                            className="rounded-full bg-red-500 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-600 transition-colors disabled:opacity-50"
                          >
                            {removingId === m.user_id ? 'Removing…' : 'Remove?'}
                          </button>
                          <button
                            onClick={() => setConfirmingRemoveId(null)}
                            disabled={removingId === m.user_id}
                            className="rounded-full px-2 py-1 text-xs font-medium text-stone hover:text-ink transition-colors disabled:opacity-40"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmingRemoveId(m.user_id)}
                          aria-label={`Remove ${m.users_profile?.email ?? 'member'}`}
                          className="text-xs text-stone hover:text-red-600 transition-colors p-1 rounded"
                        >
                          <UserMinus className="w-4 h-4" />
                        </button>
                      )
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pending invites */}
          {pendingInvites.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-ink">Pending invitations</p>
              {cancelInviteError && <p className="text-xs text-red-600">{cancelInviteError}</p>}
              <div className="space-y-1">
                {pendingInvites.map(inv => (
                  <div key={inv.id} className="flex items-center justify-between py-2 px-3 rounded-xl bg-amber-50 border border-amber-100">
                    <div>
                      <p className="text-sm text-ink">{inv.email}</p>
                      <p className="text-xs text-stone">Expires {new Date(inv.expires_at).toLocaleDateString()}</p>
                    </div>
                    <button
                      onClick={() => handleCancelInvite(inv.id)}
                      aria-label={`Cancel invite to ${inv.email}`}
                      className="text-xs text-stone hover:text-red-600 transition-colors p-1 rounded"
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
        <div className="bg-signal-50 border border-signal/20 rounded-2xl px-4 py-4 space-y-1">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-signal" />
            <p className="text-sm font-semibold text-ink">{workspaceName}</p>
          </div>
          <p className="text-xs text-stone pl-6">You have access to all features under this team&apos;s plan.</p>
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
  const [upgradeRequired, setUpgradeRequired] = useState(false)
  const [adding, setAdding] = useState<CrmType | null>(null)
  const [keyInput, setKeyInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState<CrmType | null>(null)
  const [connectionLimit, setConnectionLimit] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/integrations')
      .then(async (response) => ({
        ok: response.ok,
        status: response.status,
        data: await response.json().catch(() => ({})),
      }))
      .then(({ ok, status, data }) => {
        if (!ok && status === 403 && data.upgradeRequired === true) {
          setUpgradeRequired(true)
          return
        }
        setConnected((data.integrations ?? []).map((i: { crm_type: CrmType }) => i.crm_type))
        setConnectionLimit(typeof data.limit === 'number' ? data.limit : null)
      })
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
        <h2 className="font-display text-base font-bold text-ink">CRM Integrations</h2>
        <p className="text-sm text-stone mt-0.5">Connect your CRM to push saved leads with one click.</p>
      </div>

      {loading ? (
        <div className="text-sm text-stone py-6 text-center">Loading…</div>
      ) : upgradeRequired ? (
        <div className="rounded-2xl border border-sand bg-paper-2 p-6 text-center">
          <Plug className="mx-auto h-8 w-8 text-stone" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold text-ink">CRM integrations are included with Pro and Agency</p>
          <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-stone">
            Upgrade to connect HubSpot, GoHighLevel, or Pipedrive and push saved leads without rebuilding your list.
          </p>
          <a href="/pricing" className="mt-4 inline-flex rounded-full bg-signal px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-signal-600">
            View paid plans
          </a>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-stone">
            {connectionLimit === null
              ? `${connected.length} connected`
              : `${connected.length} of ${connectionLimit} CRM connection${connectionLimit === 1 ? '' : 's'} used`}
          </p>
          {crms.map(crm => {
            const meta = CRM_META[crm]
            const isConnected = connected.includes(crm)
            const isAdding = adding === crm
            const connectionLimitReached =
              connectionLimit !== null && connected.length >= connectionLimit && !isConnected

            return (
              <div key={crm} className="border border-sand rounded-2xl p-4 bg-card">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {isConnected ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-sand" />
                    )}
                    <div>
                      <p className="text-sm font-semibold text-ink">{meta.label}</p>
                      <p className="text-xs text-stone">
                        {isConnected ? 'Connected' : 'Not connected'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isConnected ? (
                      <button
                        onClick={() => handleDisconnect(crm)}
                        disabled={disconnecting === crm}
                        className="inline-flex items-center gap-1.5 text-xs text-stone hover:text-red-600 border border-sand hover:border-red-200 px-3 py-1.5 rounded-full transition-colors disabled:opacity-50"
                      >
                        <Link2Off className="w-3.5 h-3.5" />
                        {disconnecting === crm ? 'Disconnecting…' : 'Disconnect'}
                      </button>
                    ) : (
                      <button
                        onClick={() => { setAdding(isAdding ? null : crm); setKeyInput(''); setError(null) }}
                        disabled={connectionLimitReached}
                        title={connectionLimitReached ? 'Your plan connection limit is reached' : undefined}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-signal border border-signal/30 hover:bg-signal-50 px-3 py-1.5 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Plug className="w-3.5 h-3.5" />
                        Connect
                      </button>
                    )}
                  </div>
                </div>

                {isAdding && (
                  <div className="mt-4 pt-4 border-t border-sand space-y-3">
                    <p className="text-xs text-stone">{meta.help}{' '}
                      <a href={meta.helpUrl} target="_blank" rel="noopener noreferrer" className="text-signal hover:underline">
                        Docs →
                      </a>
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        value={keyInput}
                        onChange={e => setKeyInput(e.target.value)}
                        placeholder={meta.placeholder}
                        className="flex-1 text-sm border border-sand bg-paper rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-signal/20 focus:border-signal font-mono"
                      />
                      <button
                        onClick={() => handleConnect(crm)}
                        disabled={saving || !keyInput.trim()}
                        className="text-sm font-semibold bg-signal text-white px-4 py-2 rounded-full hover:bg-signal-600 transition-colors disabled:opacity-50"
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
  const [accessLoading, setAccessLoading] = useState(true)
  const [accessError, setAccessError] = useState(false)
  const [canUseWhiteLabel, setCanUseWhiteLabel] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // A failed plan check must not read as "you do not have Pro". Show the
  // customer an honest error with a retry instead of locking them out.
  // State is only set in the async continuation (never synchronously), so this
  // is safe to call from an effect without triggering cascading renders.
  const loadAccess = useCallback(
    () =>
      fetch('/api/usage', { cache: 'no-store' })
        .then((response) => {
          if (!response.ok) throw new Error(`usage responded ${response.status}`)
          return response.json()
        })
        .then((data) => {
          setCanUseWhiteLabel(data?.plan === 'pro' || data?.plan === 'agency')
          setAccessError(false)
        })
        .catch((error) => {
          console.error('[settings/white-label] plan check failed', error)
          setAccessError(true)
        })
        .finally(() => setAccessLoading(false)),
    []
  )

  useEffect(() => {
    loadAccess()
  }, [loadAccess])

  const handleRetryAccess = () => {
    setAccessLoading(true)
    loadAccess()
  }

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

  if (accessLoading) {
    return <div className="py-8 text-center text-sm text-stone">Loading…</div>
  }

  if (accessError) {
    return (
      <div className="rounded-2xl border border-sand bg-paper-2 p-8 text-center">
        <AlertCircle className="mx-auto h-9 w-9 text-stone" aria-hidden="true" />
        <h2 className="mt-3 font-display text-base font-bold text-ink">We could not check your plan</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-stone">
          Your branding settings are untouched. This is a connection problem on our side, not a change to your plan.
        </p>
        <button
          onClick={handleRetryAccess}
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-signal px-4 py-2 text-sm font-semibold text-white hover:bg-signal-600"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Try again
        </button>
      </div>
    )
  }

  if (!canUseWhiteLabel) {
    return (
      <div className="rounded-2xl border border-sand bg-paper-2 p-8 text-center">
        <Palette className="mx-auto h-9 w-9 text-stone" aria-hidden="true" />
        <h2 className="mt-3 font-display text-base font-bold text-ink">White-label exports are included with Pro</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-stone">
          Upgrade to add your agency name, logo, and colors to client-ready PDF reports.
        </p>
        <a href="/pricing" className="mt-4 inline-flex rounded-full bg-signal px-4 py-2 text-sm font-semibold text-white hover:bg-signal-600">
          View plans
        </a>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-2xl border border-sand p-6">
        <h2 className="font-display text-base font-bold text-ink mb-1">White Label Exports</h2>
        <p className="text-sm text-stone mb-6">Add your agency branding to PDF exports. Your logo and colors replace LeadZipp branding on all exported reports.</p>

        {/* Agency Name */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-ink-soft mb-1.5">Agency Name</label>
          <input
            type="text"
            value={settings.agencyName}
            onChange={(e) => setSettings((prev) => ({ ...prev, agencyName: e.target.value }))}
            placeholder="Acme Lead Agency"
            className="w-full rounded-xl border border-sand bg-paper px-3 py-2 text-sm text-ink placeholder:text-stone focus:outline-none focus:ring-2 focus:ring-signal/30 focus:border-signal"
          />
        </div>

        {/* Logo Upload */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-ink-soft mb-1.5">Agency Logo</label>
          <div className="flex items-center gap-3">
            {settings.logoDataUrl ? (
              <div className="relative flex-shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={settings.logoDataUrl} alt="Logo preview" className="h-12 w-12 rounded-lg object-contain border border-sand bg-paper-2 p-1" />
                <button
                  onClick={() => setSettings((prev) => ({ ...prev, logoDataUrl: '' }))}
                  className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-ink text-white flex items-center justify-center hover:bg-signal"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            ) : null}
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 rounded-xl border border-dashed border-sand px-4 py-2.5 text-sm text-ink-soft hover:border-signal hover:text-signal transition-colors"
            >
              <Upload className="h-4 w-4" />
              {settings.logoDataUrl ? 'Replace logo' : 'Upload logo'}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
            <span className="text-xs text-stone">PNG, SVG, or JPG — shown in PDF header</span>
          </div>
        </div>

        {/* Accent Color */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-ink-soft mb-1.5">Accent Color</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={settings.accentColor}
              onChange={(e) => setSettings((prev) => ({ ...prev, accentColor: e.target.value }))}
              className="h-9 w-16 cursor-pointer rounded-lg border border-sand p-0.5"
            />
            <span className="text-sm font-mono text-ink-soft">{settings.accentColor}</span>
            <span className="text-xs text-stone">Used for table headers and section titles in exports</span>
          </div>
        </div>

        {/* Preview strip */}
        {(settings.agencyName || settings.logoDataUrl) && (
          <div className="mb-6 rounded-xl border border-sand bg-paper-2 p-4">
            <p className="readout text-stone mb-2">PDF Header Preview</p>
            <div className="flex items-center gap-3 bg-card rounded-lg border border-sand px-4 py-3">
              {settings.logoDataUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={settings.logoDataUrl} alt="" className="h-8 w-8 object-contain flex-shrink-0" />
              )}
              <div>
                <p className="text-sm font-bold" style={{ color: settings.accentColor }}>
                  {settings.agencyName || 'Your Agency'}
                </p>
                <p className="text-xs text-stone">Lead Report — {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={handleSave}
          className={cn(
            'flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all',
            saved
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-signal text-white hover:bg-signal-600'
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
    <div className="mx-auto max-w-6xl">
        <div className="mb-5">
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">Settings</h1>
          <p className="text-sm text-stone mt-0.5">Manage your account, plan, and preferences</p>
        </div>

        <div className="space-y-4">
          <div className="overflow-x-auto pb-1">
            <nav className="flex min-w-max gap-1 rounded-2xl border border-sand bg-card p-1.5 shadow-card" aria-label="Settings sections">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all',
                    activeTab === tab.id
                      ? 'bg-signal text-white shadow-sm'
                      : 'text-ink-soft hover:bg-paper-2 hover:text-ink'
                  )}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="rounded-3xl border border-sand bg-card p-5 sm:p-7">
            {renderTab()}
          </div>
        </div>
    </div>
  )
}
