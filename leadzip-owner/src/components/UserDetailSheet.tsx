'use client'

import { useState, useCallback } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Copy, ExternalLink, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { UserRow, AdminAction } from '@/types'

const PLAN_LIMITS = {
  free:   { searches: 20,   savedLeads: 25,   exports: 3   },
  pro:    { searches: 200,  savedLeads: 500,  exports: 30  },
  agency: { searches: 1000, savedLeads: 5000, exports: 100 },
}

interface Props {
  user: UserRow | null
  open: boolean
  currentUserId: string
  onClose: () => void
  onAction: (userId: string, action: AdminAction) => Promise<void>
}

export function UserDetailSheet({ user, open, currentUserId, onClose, onAction }: Props) {
  const [loadingAction, setLoadingAction] = useState<'status' | 'plan' | 'reset' | 'notes' | null>(null)
  const [resetConfirming, setResetConfirming] = useState(false)
  const [copied, setCopied] = useState(false)
  const [notes, setNotes] = useState<string>(user?.admin_notes ?? '')

  const syncNotes = useCallback((u: UserRow | null) => {
    if (u) setNotes(u.admin_notes ?? '')
  }, [])

  if (user && notes !== user.admin_notes && loadingAction !== 'notes') {
    syncNotes(user)
  }

  async function handleStatusToggle() {
    if (!user) return
    setLoadingAction('status')
    await onAction(user.id, { type: 'set_status', status: user.status === 'active' ? 'deactivated' : 'active' })
    setLoadingAction(null)
  }

  async function handlePlanChange(plan: string | null | undefined) {
    if (!user || !plan) return
    setLoadingAction('plan')
    await onAction(user.id, { type: 'set_plan', plan: plan as 'free' | 'pro' | 'agency' })
    setLoadingAction(null)
  }

  async function handleResetUsage() {
    if (!user) return
    if (!resetConfirming) { setResetConfirming(true); return }
    setLoadingAction('reset')
    setResetConfirming(false)
    await onAction(user.id, { type: 'reset_usage' })
    setLoadingAction(null)
  }

  async function handleNotesSave() {
    if (!user || notes === user.admin_notes) return
    setLoadingAction('notes')
    await onAction(user.id, { type: 'update_notes', notes })
    setLoadingAction(null)
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!user) return null

  const isSelf = user.id === currentUserId
  const limits = PLAN_LIMITS[user.plan as keyof typeof PLAN_LIMITS] ?? PLAN_LIMITS.free
  const usage = user.usage
  const sub = user.subscription

  function periodLabel() {
    if (!sub?.current_period_start || !sub?.current_period_end) return 'N/A'
    const fmt = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    return `${fmt(sub.current_period_start)} – ${fmt(sub.current_period_end)}`
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-[460px] overflow-y-auto">
        <SheetHeader className="mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#0369A1] to-[#0F172A] flex items-center justify-center text-white text-lg font-bold shrink-0">
              {user.email.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <SheetTitle className="text-left text-base font-bold text-[#0F172A] truncate">
                {user.full_name || user.email}
              </SheetTitle>
              <p className="text-xs text-slate-500 mt-0.5 truncate">{user.email}</p>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-6">
          {/* Profile */}
          <Section title="Profile">
            <Row label="Company" value={user.company_name || '—'} />
            <Row label="Plan"><PlanBadge plan={user.plan} /></Row>
            <Row label="Status">
              <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full',
                user.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700')}>
                {cap(user.status)}
              </span>
            </Row>
            <Row label="Joined" value={fmtDate(user.created_at)} />
          </Section>

          {/* Usage */}
          <Section title="Usage This Month">
            <UsageStat label="Searches" used={usage?.searches_this_month ?? 0} limit={limits.searches} />
            <UsageStat label="Saved Leads" used={usage?.saved_leads_count ?? 0} limit={limits.savedLeads} />
            <UsageStat label="Exports" used={usage?.exports_count ?? 0} limit={limits.exports} />
          </Section>

          {/* Subscription */}
          <Section title="Subscription">
            {sub ? (
              <>
                <Row label="Stripe Plan" value={cap(sub.plan)} />
                <Row label="Status">
                  <StripeBadge status={sub.status} />
                </Row>
                <Row label="Billing Period" value={periodLabel()} />
                {sub.stripe_customer_id && (
                  <Row label="Customer ID">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs text-slate-600 truncate max-w-[140px]">
                        {sub.stripe_customer_id}
                      </span>
                      <button onClick={() => copyToClipboard(sub.stripe_customer_id!)} className="text-slate-400 hover:text-slate-600">
                        {copied ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                      <a href={`https://dashboard.stripe.com/customers/${sub.stripe_customer_id}`} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-[#0369A1]">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </Row>
                )}
                {sub.stripe_subscription_id && (
                  <Row label="Sub ID">
                    <span className="font-mono text-xs text-slate-600 truncate max-w-[180px]">
                      {sub.stripe_subscription_id}
                    </span>
                  </Row>
                )}
              </>
            ) : (
              <p className="text-sm text-slate-400">No Stripe subscription on record</p>
            )}
          </Section>

          {/* Notes */}
          <Section title="Owner Notes">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={handleNotesSave}
              rows={3}
              placeholder="Private notes about this user..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-[#0F172A] placeholder:text-slate-400 outline-none focus:border-[#0369A1] focus:ring-1 focus:ring-[#0369A1]/20 resize-none transition-colors"
            />
            {loadingAction === 'notes' && (
              <p className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Saving...
              </p>
            )}
          </Section>

          {/* Quick Actions */}
          <Section title="Quick Actions">
            <div className="space-y-3 pt-1">
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1.5 block">Change Plan</label>
                <Select value={user.plan} onValueChange={handlePlanChange} disabled={!!loadingAction || isSelf}>
                  <SelectTrigger className="h-9 text-sm">
                    {loadingAction === 'plan' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <SelectValue />}
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="pro">Pro — $25/mo</SelectItem>
                    <SelectItem value="agency">Agency — $50/mo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {resetConfirming ? (
                <div className="flex gap-2">
                  <button onClick={handleResetUsage} disabled={loadingAction === 'reset'}
                    className="flex-1 h-9 rounded-lg border border-orange-300 bg-orange-50 text-orange-700 text-sm font-medium hover:bg-orange-100 transition-colors disabled:opacity-50 flex items-center justify-center">
                    {loadingAction === 'reset' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Confirm Reset'}
                  </button>
                  <button onClick={() => setResetConfirming(false)} className="flex-1 h-9 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors">
                    Cancel
                  </button>
                </div>
              ) : (
                <button onClick={() => setResetConfirming(true)} disabled={!!loadingAction}
                  className="w-full h-9 rounded-lg border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-50">
                  Reset Monthly Usage
                </button>
              )}

              <button onClick={handleStatusToggle} disabled={loadingAction === 'status' || isSelf}
                className={cn('w-full h-9 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center',
                  user.status === 'active'
                    ? 'border border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
                    : 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100')}>
                {loadingAction === 'status' ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : user.status === 'active' ? 'Deactivate Account' : 'Reactivate Account'}
              </button>

              <a href={`mailto:${user.email}`}
                className="w-full h-9 rounded-lg border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors flex items-center justify-center">
                Send Email
              </a>

              {isSelf && <p className="text-xs text-slate-400 text-center">Cannot modify your own account</p>}
            </div>
          </Section>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">{title}</p>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

function Row({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
      <span className="text-xs text-slate-500">{label}</span>
      {children ?? <span className="text-xs font-medium text-[#0F172A]">{value}</span>}
    </div>
  )
}

function UsageStat({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0
  const hot = pct >= 90
  return (
    <div className="py-1.5">
      <div className="flex justify-between text-xs mb-1.5">
        <span className="text-slate-500">{label}</span>
        <span className={cn('font-medium', hot ? 'text-red-600' : 'text-[#0F172A]')}>
          {used.toLocaleString()} / {limit.toLocaleString()}
        </span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={cn('h-1.5 rounded-full transition-all', hot ? 'bg-red-400' : 'bg-[#0369A1]')} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function PlanBadge({ plan }: { plan: string }) {
  const s: Record<string, string> = { free: 'bg-slate-100 text-slate-600', pro: 'bg-blue-50 text-blue-700', agency: 'bg-amber-50 text-amber-700' }
  return <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', s[plan] ?? s.free)}>{cap(plan)}</span>
}

function StripeBadge({ status }: { status: string }) {
  const s: Record<string, string> = {
    active: 'bg-emerald-50 text-emerald-700', trialing: 'bg-blue-50 text-blue-700',
    past_due: 'bg-orange-50 text-orange-700', cancelled: 'bg-red-50 text-red-700',
    canceled: 'bg-red-50 text-red-700', unpaid: 'bg-red-50 text-red-700',
  }
  return <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', s[status] ?? 'bg-slate-100 text-slate-600')}>{cap(status)}</span>
}

function cap(s: string) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : '' }
function fmtDate(d: string) { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }
