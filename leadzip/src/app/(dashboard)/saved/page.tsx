'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Search,
  Download,
  Trash2,
  Pencil,
  Check,
  X,
  ChevronDown,
  Star,
  Phone,
  Globe,
  BookmarkX,
  SortAsc,
  Plug,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Wand2,
  List as ListIcon,
  Columns3,
} from 'lucide-react'
import { toast } from 'sonner'
import { Lead, LeadStatus, PipelineStage, STATUS_LABELS, STATUS_COLORS } from '@/types/lead'
import { exportToCSV } from '@/lib/export'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import PipelineBoard from '@/components/leads/PipelineBoard'
import ProposalModal from '@/components/leads/ProposalModal'

const STORAGE_KEY = 'leadzip_saved_leads'
const VIEW_KEY = 'leadzip_saved_view'
const isSupabaseConfigured =
  process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder.supabase.co'

type SavedView = 'list' | 'board'

type SortOption = 'score' | 'date' | 'category' | 'rating' | 'name'
type StatusFilter = 'all' | LeadStatus

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'interested', label: 'Interested' },
  { value: 'not_interested', label: 'Not Interested' },
  { value: 'follow_up', label: 'Follow Up' },
  { value: 'converted', label: 'Converted' },
]

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'score', label: 'Lead Score' },
  { value: 'date', label: 'Date Saved' },
  { value: 'name', label: 'Business Name' },
  { value: 'category', label: 'Category' },
  { value: 'rating', label: 'Rating' },
]

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 80
      ? 'bg-signal-50 text-signal border-signal/20'
      : score >= 50
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : 'bg-paper-2 text-stone border-sand'
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono font-semibold border', color)}>
      {score}
    </span>
  )
}

function StatusSelect({
  value,
  onChange,
}: {
  value: LeadStatus
  onChange: (v: LeadStatus) => void
}) {
  const [open, setOpen] = useState(false)
  const statuses: LeadStatus[] = ['new', 'contacted', 'interested', 'not_interested', 'follow_up', 'converted']

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border transition-all',
          STATUS_COLORS[value]
        )}
      >
        {STATUS_LABELS[value]}
        <ChevronDown className="w-3 h-3 opacity-60" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-20 w-40 bg-card rounded-xl shadow-lg border border-sand py-1 overflow-hidden">
            {statuses.map((s) => (
              <button
                key={s}
                className={cn(
                  'w-full text-left px-3 py-2 text-xs font-medium hover:bg-signal-50/60 transition-colors',
                  s === value && 'bg-paper-2'
                )}
                onClick={() => {
                  onChange(s)
                  setOpen(false)
                }}
              >
                <span className={cn('inline-flex px-2 py-0.5 rounded-md', STATUS_COLORS[s])}>
                  {STATUS_LABELS[s]}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function LeadRow({
  lead,
  selected,
  onSelect,
  onStatusChange,
  onNotesChange,
  onDelete,
  onGenerate,
}: {
  lead: Lead
  selected: boolean
  onSelect: (id: string, checked: boolean) => void
  onStatusChange: (id: string, status: LeadStatus) => void
  onNotesChange: (id: string, notes: string) => void
  onDelete: (id: string) => void
  onGenerate: (lead: Lead) => void
}) {
  const [editingNotes, setEditingNotes] = useState(false)
  const [noteDraft, setNoteDraft] = useState(lead.notes)

  const saveNotes = () => {
    onNotesChange(lead.id, noteDraft)
    setEditingNotes(false)
  }

  const cancelNotes = () => {
    setNoteDraft(lead.notes)
    setEditingNotes(false)
  }

  return (
    <tr className={cn('border-b border-sand hover:bg-signal-50/50 transition-colors', selected && 'bg-signal-50')}>
      <td className="pl-4 pr-2 py-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => onSelect(lead.id, e.target.checked)}
          className="w-4 h-4 rounded border-sand text-signal accent-signal"
        />
      </td>
      <td className="px-3 py-3">
        <div className="font-semibold text-ink text-sm leading-tight">{lead.businessName}</div>
        <div className="text-xs text-stone mt-0.5">{lead.city}, {lead.state}</div>
      </td>
      <td className="px-3 py-3">
        <span className="text-xs bg-paper-2 text-ink-soft px-2 py-1 rounded-md font-medium border border-sand">
          {lead.category}
        </span>
      </td>
      <td className="px-3 py-3">
        {lead.phone ? (
          <a href={`tel:${lead.phone}`} className="inline-flex items-center gap-1 text-xs font-mono text-signal hover:text-signal-600 hover:underline">
            <Phone className="w-3 h-3" />
            {lead.phone}
          </a>
        ) : (
          <span className="text-xs text-stone/50">—</span>
        )}
      </td>
      <td className="px-3 py-3">
        {lead.website ? (
          <a
            href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-signal hover:text-signal-600 hover:underline max-w-[100px] truncate"
          >
            <Globe className="w-3 h-3 shrink-0" />
            <span className="truncate">{lead.website.replace(/^https?:\/\//, '')}</span>
          </a>
        ) : (
          <span className="text-xs text-stone/50">No website</span>
        )}
      </td>
      <td className="px-3 py-3">
        <ScoreBadge score={lead.leadScore} />
      </td>
      <td className="px-3 py-3">
        {lead.rating ? (
          <span className="inline-flex items-center gap-1 text-xs font-mono text-ink-soft">
            <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
            {lead.rating}
          </span>
        ) : (
          <span className="text-xs text-stone/50">—</span>
        )}
      </td>
      <td className="px-3 py-3">
        <StatusSelect
          value={lead.status}
          onChange={(s) => onStatusChange(lead.id, s)}
        />
      </td>
      <td className="px-3 py-3 max-w-[180px]">
        {editingNotes ? (
          <div className="flex flex-col gap-1">
            <textarea
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              className="w-full text-xs border border-signal rounded-lg px-2 py-1.5 resize-none bg-card focus:outline-none focus:ring-2 focus:ring-signal/20"
              rows={2}
              autoFocus
            />
            <div className="flex gap-1">
              <button
                onClick={saveNotes}
                className="inline-flex items-center gap-0.5 text-xs bg-signal text-white px-2 py-1 rounded-md hover:bg-signal-600 transition-colors"
              >
                <Check className="w-3 h-3" /> Save
              </button>
              <button
                onClick={cancelNotes}
                className="inline-flex items-center gap-0.5 text-xs border border-sand text-stone px-2 py-1 rounded-md hover:bg-paper-2 transition-colors"
              >
                <X className="w-3 h-3" /> Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setEditingNotes(true)}
            className="group flex items-start gap-1 w-full text-left"
          >
            <span className="text-xs text-ink-soft leading-relaxed flex-1 min-h-[1.5rem]">
              {lead.notes || <span className="text-stone/50 italic">Add note…</span>}
            </span>
            <Pencil className="w-3 h-3 text-stone/50 group-hover:text-signal shrink-0 mt-0.5 transition-colors" />
          </button>
        )}
      </td>
      <td className="px-3 py-3">
        <span className="text-xs font-mono text-stone">
          {lead.savedAt ? new Date(lead.savedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
        </span>
      </td>
      <td className="px-3 py-3 pr-4">
        <div className="flex items-center gap-1">
          <button
            onClick={() => onGenerate(lead)}
            className="p-1.5 rounded-lg text-stone hover:text-signal hover:bg-signal-50 transition-all"
            title="Generate outreach"
          >
            <Wand2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(lead.id)}
            className="p-1.5 rounded-lg text-stone hover:text-red-500 hover:bg-red-50 transition-all"
            title="Delete lead"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  )
}

type CrmType = 'hubspot' | 'gohighlevel' | 'pipedrive'
const CRM_LABELS: Record<CrmType, string> = { hubspot: 'HubSpot', gohighlevel: 'GoHighLevel', pipedrive: 'Pipedrive' }

export default function SavedLeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('score')
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [confirmingBulkDelete, setConfirmingBulkDelete] = useState(false)
  const [view, setView] = useState<SavedView>('list')
  const [proposalLead, setProposalLead] = useState<Lead | null>(null)
  const [pipelineMigrationNeeded, setPipelineMigrationNeeded] = useState(false)
  const [connectedCrms, setConnectedCrms] = useState<CrmType[]>([])
  const [crmModal, setCrmModal] = useState(false)
  const [pushingCrm, setPushingCrm] = useState<CrmType | null>(null)
  const [pushResult, setPushResult] = useState<{ succeeded: number; failed: number; errors: string[] } | null>(null)

  useEffect(() => {
    if (isSupabaseConfigured) {
      fetch('/api/integrations')
        .then(r => r.json())
        .then(d => setConnectedCrms((d.integrations ?? []).map((i: { crm_type: CrmType }) => i.crm_type)))
        .catch(() => {})
    }
  }, [])

  const loadLeads = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      if (isSupabaseConfigured) {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (user) {
          const { data, error } = await supabase
            .from('leads')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })

          if (error) throw error

          if (data && data.length > 0) {
            // Feature-detect the pipeline columns: select('*') simply omits them
            // when the one-time migration hasn't run yet.
            setPipelineMigrationNeeded(!('pipeline_stage' in data[0]))
            setLeads(
              data.map((l) => ({
                id: l.id,
                businessName: l.business_name,
                category: l.category,
                address: l.address ?? '',
                city: l.city ?? '',
                state: l.state ?? '',
                zipCode: l.zip_code ?? '',
                phone: l.phone ?? '',
                website: l.website ?? '',
                rating: l.rating ?? null,
                reviewCount: l.review_count ?? null,
                latitude: null,
                longitude: null,
                distanceMiles: null,
                leadScore: l.lead_score ?? 0,
                status: (l.status as LeadStatus) ?? 'new',
                notes: l.notes ?? '',
                savedAt: l.saved_at,
                employeeCount: l.employee_count ?? null,
                revenueEstimate: l.revenue_estimate ?? null,
                facebookUrl: l.facebook_url ?? null,
                instagramUrl: l.instagram_url ?? null,
                linkedinUrl: l.linkedin_url ?? null,
                email: l.email ?? undefined,
                pipelineStage: (l.pipeline_stage as PipelineStage) ?? 'new',
                stageUpdatedAt: l.stage_updated_at ?? undefined,
              }))
            )
            return
          }
          // Signed in but no server-side leads yet — fall through to localStorage
        }
      }

      // Fallback: load from localStorage (Supabase not configured / no user / empty)
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        try {
          setLeads(JSON.parse(raw) as Lead[])
        } catch {
          setLeads([])
        }
      } else {
        setLeads([])
      }
    } catch {
      // Genuine failure — try localStorage before surfacing an error so a
      // transient network blip doesn't hide an existing pipeline
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        try {
          setLeads(JSON.parse(raw) as Lead[])
          return
        } catch {
          // corrupt cache — fall through to the error state
        }
      }
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
    try {
      const savedView = localStorage.getItem(VIEW_KEY)
      if (savedView === 'board' || savedView === 'list') {
        setView(savedView)
      }
    } catch { /* non-fatal */ }
    loadLeads()
  }, [loadLeads])

  const switchView = (v: SavedView) => {
    setView(v)
    try { localStorage.setItem(VIEW_KEY, v) } catch { /* non-fatal */ }
  }

  const saveToStorage = useCallback((updated: Lead[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    setLeads(updated)
  }, [])

  const handleStatusChange = async (id: string, status: LeadStatus) => {
    const updated = leads.map((l) => (l.id === id ? { ...l, status } : l))
    saveToStorage(updated)

    if (isSupabaseConfigured) {
      try {
        const supabase = createClient()
        await supabase.from('leads').update({ status }).eq('id', id)
      } catch {
        // Non-fatal
      }
    }
  }

  const handleNotesChange = async (id: string, notes: string) => {
    const updated = leads.map((l) => (l.id === id ? { ...l, notes } : l))
    saveToStorage(updated)

    if (isSupabaseConfigured) {
      try {
        const supabase = createClient()
        await supabase.from('leads').update({ notes }).eq('id', id)
      } catch {
        // Non-fatal
      }
    }
  }

  const handleStageChange = async (id: string, stage: PipelineStage) => {
    const snapshot = leads
    const updated = leads.map((l) =>
      l.id === id
        ? { ...l, pipelineStage: stage, stageUpdatedAt: new Date().toISOString() }
        : l
    )
    saveToStorage(updated)

    if (!isSupabaseConfigured) return
    try {
      const res = await fetch('/api/leads/pipeline', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: id, stage }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        if (data?.migrationRequired) {
          // Column not migrated yet — keep the move locally and surface the banner
          setPipelineMigrationNeeded(true)
          return
        }
        throw new Error(data?.error ?? 'Stage update failed')
      }
    } catch {
      saveToStorage(snapshot)
      toast.error('Failed to move lead')
    }
  }

  const restoreLead = useCallback(async (lead: Lead) => {
    setLeads((prev) => {
      const next = [lead, ...prev.filter((l) => l.id !== lead.id)]
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
    if (isSupabaseConfigured) {
      try {
        await fetch('/api/leads/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lead }),
        })
      } catch {
        // Non-fatal — localStorage is already restored
      }
    }
  }, [])

  const handleDelete = async (id: string) => {
    const removed = leads.find((l) => l.id === id)
    const snapshot = leads
    saveToStorage(leads.filter((l) => l.id !== id))
    setSelectedIds((prev) => { const s = new Set(prev); s.delete(id); return s })

    if (isSupabaseConfigured) {
      try {
        const supabase = createClient()
        const { error } = await supabase.from('leads').delete().eq('id', id)
        if (error) throw error
      } catch {
        // Persisting the delete failed — roll back so the row doesn't reappear
        // out of sync on the next load
        saveToStorage(snapshot)
        toast.error('Failed to delete lead')
        return
      }
    }

    toast.success('Lead deleted', removed ? {
      action: { label: 'Undo', onClick: () => restoreLead(removed) },
    } : undefined)
  }

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    const count = ids.length
    const snapshot = leads
    saveToStorage(leads.filter((l) => !selectedIds.has(l.id)))
    setSelectedIds(new Set())
    setConfirmingBulkDelete(false)

    if (isSupabaseConfigured) {
      try {
        const supabase = createClient()
        const { error } = await supabase.from('leads').delete().in('id', ids)
        if (error) throw error
      } catch {
        // Persisting the deletes failed — roll back the whole batch
        saveToStorage(snapshot)
        toast.error('Failed to delete leads')
        return
      }
    }

    toast.success(`${count} lead${count !== 1 ? 's' : ''} deleted`)
  }

  const handlePushToCrm = async (crm: CrmType) => {
    setPushingCrm(crm)
    setPushResult(null)
    const sel = leads.filter(l => selectedIds.has(l.id))
    const payload = sel.map(l => ({
      businessName: l.businessName,
      phone: l.phone,
      website: l.website,
      address: l.address,
      city: l.city,
      state: l.state,
      category: l.category,
    }))
    try {
      const res = await fetch(`/api/integrations/${crm}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leads: payload }),
      })
      const data = await res.json()
      setPushResult({ succeeded: data.succeeded ?? 0, failed: data.failed ?? 0, errors: data.errors ?? [] })
    } catch {
      setPushResult({ succeeded: 0, failed: sel.length, errors: ['Network error — please try again'] })
    } finally {
      setPushingCrm(null)
    }
  }

  const handleSelect = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const s = new Set(prev)
      if (checked) { s.add(id) } else { s.delete(id) }
      return s
    })
  }

  const handleSelectAll = (checked: boolean) => {
    setSelectedIds(checked ? new Set(filtered.map((l) => l.id)) : new Set())
    setConfirmingBulkDelete(false)
  }

  const handleExportAll = () => {
    if (leads.length === 0) return
    exportToCSV(leads, `leadzip-saved-${Date.now()}`)
    toast.success(`Exported ${leads.length} lead${leads.length !== 1 ? 's' : ''}`)
  }

  const handleExportSelected = () => {
    const sel = leads.filter((l) => selectedIds.has(l.id))
    if (sel.length === 0) return
    exportToCSV(sel, `leadzip-selected-${Date.now()}`)
    toast.success(`Exported ${sel.length} lead${sel.length !== 1 ? 's' : ''}`)
  }

  const filtered = leads
    .filter((l) => {
      if (statusFilter !== 'all' && l.status !== statusFilter) return false
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        return (
          l.businessName.toLowerCase().includes(q) ||
          l.category.toLowerCase().includes(q) ||
          l.city.toLowerCase().includes(q) ||
          l.phone.includes(q)
        )
      }
      return true
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'score': return b.leadScore - a.leadScore
        case 'date': return (b.savedAt ?? '').localeCompare(a.savedAt ?? '')
        case 'name': return a.businessName.localeCompare(b.businessName)
        case 'category': return a.category.localeCompare(b.category)
        case 'rating': return (b.rating ?? 0) - (a.rating ?? 0)
        default: return 0
      }
    })

  const allSelected = filtered.length > 0 && filtered.every((l) => selectedIds.has(l.id))
  const someSelected = selectedIds.size > 0

  if (!mounted) return null

  return (
    <div className="min-h-screen bg-paper">
      <div className="max-w-[1400px] mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div>
              <span className="readout text-signal">Pipeline</span>
              <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-ink">Saved Leads</h1>
              <p className="text-sm text-ink-soft mt-1.5">Manage and track your prospect pipeline</p>
            </div>
            <span className="bg-signal text-white text-sm font-mono font-semibold px-3 py-1 rounded-full self-start">
              {leads.length}
            </span>
          </div>
          <button
            onClick={handleExportAll}
            disabled={leads.length === 0}
            className="inline-flex items-center gap-2 bg-ink text-paper text-sm font-semibold px-5 py-2.5 rounded-full hover:bg-forest transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            Export All
          </button>
        </div>

        {someSelected && (
          <div className="mb-4 flex flex-wrap items-center gap-2 bg-signal text-white px-4 py-3 rounded-2xl">
            <span className="text-sm font-medium"><span className="font-mono">{selectedIds.size}</span> lead{selectedIds.size !== 1 ? 's' : ''} selected</span>
            <button
              onClick={handleExportSelected}
              className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors sm:ml-auto"
            >
              <Download className="w-4 h-4" />
              Export Selected
            </button>
            {connectedCrms.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => { setCrmModal(o => !o); setPushResult(null) }}
                  className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Plug className="w-4 h-4" />
                  Push to CRM
                </button>
                {crmModal && (
                  <div className="absolute right-0 top-full mt-1 bg-card rounded-xl shadow-lg border border-sand p-3 z-20 min-w-[220px]">
                    {pushResult ? (
                      <div className="space-y-2">
                        <div className={cn('flex items-center gap-2 text-sm font-medium', pushResult.failed === 0 ? 'text-forest' : 'text-amber-600')}>
                          {pushResult.failed === 0 ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                          <span className="font-mono">{pushResult.succeeded}</span> pushed{pushResult.failed > 0 ? `, ${pushResult.failed} failed` : ''}
                        </div>
                        {pushResult.errors.slice(0, 3).map((e, i) => (
                          <p key={i} className="text-xs text-red-600 truncate">{e}</p>
                        ))}
                        <button onClick={() => { setCrmModal(false); setPushResult(null) }} className="text-xs text-stone hover:text-ink mt-1">Close</button>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <p className="readout text-stone mb-2">Choose CRM</p>
                        {connectedCrms.map(crm => (
                          <button
                            key={crm}
                            onClick={() => handlePushToCrm(crm)}
                            disabled={pushingCrm !== null}
                            className="w-full text-left text-sm px-3 py-2 rounded-lg hover:bg-signal-50/60 text-ink-soft disabled:opacity-50 transition-colors"
                          >
                            {pushingCrm === crm ? 'Pushing…' : CRM_LABELS[crm]}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            {confirmingBulkDelete ? (
              <div className="inline-flex items-center gap-2">
                <button
                  onClick={handleBulkDelete}
                  className="inline-flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete {selectedIds.size}?
                </button>
                <button
                  onClick={() => setConfirmingBulkDelete(false)}
                  className="bg-white/20 hover:bg-white/30 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmingBulkDelete(true)}
                className="inline-flex items-center gap-2 bg-red-500/80 hover:bg-red-500 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete Selected
              </button>
            )}
            <button
              onClick={() => { setSelectedIds(new Set()); setConfirmingBulkDelete(false) }}
              aria-label="Clear selection"
              className="p-1 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="bg-card border border-sand rounded-2xl px-4 py-3 mb-4 flex flex-wrap gap-3 items-center">
          <div className="inline-flex items-center rounded-full border border-sand bg-paper-2 p-0.5" role="tablist" aria-label="View">
            <button
              role="tab"
              aria-selected={view === 'list'}
              onClick={() => switchView('list')}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors',
                view === 'list' ? 'bg-card text-ink shadow-sm border border-sand' : 'text-stone hover:text-ink'
              )}
            >
              <ListIcon className="w-3.5 h-3.5" />
              List
            </button>
            <button
              role="tab"
              aria-selected={view === 'board'}
              onClick={() => switchView('board')}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors',
                view === 'board' ? 'bg-card text-ink shadow-sm border border-sand' : 'text-stone hover:text-ink'
              )}
            >
              <Columns3 className="w-3.5 h-3.5" />
              Pipeline
            </button>
          </div>
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone" />
            <input
              type="text"
              placeholder="Search leads…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-paper-2 border border-sand rounded-full focus:outline-none focus:ring-2 focus:ring-signal/20 focus:border-signal"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="text-sm border border-sand rounded-full px-3 py-2 focus:outline-none focus:ring-2 focus:ring-signal/20 focus:border-signal bg-card text-ink-soft"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <SortAsc className="w-4 h-4 text-stone" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="text-sm border border-sand rounded-full px-3 py-2 focus:outline-none focus:ring-2 focus:ring-signal/20 focus:border-signal bg-card text-ink-soft"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>Sort: {o.label}</option>
              ))}
            </select>
          </div>
          <span className="text-xs text-stone ml-auto">
            <span className="font-mono">{filtered.length}</span> of <span className="font-mono">{leads.length}</span> leads
          </span>
        </div>

        {loading ? (
          <div className="bg-card border border-sand rounded-2xl overflow-hidden">
            <div className="divide-y divide-sand">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-4">
                  <div className="h-4 w-4 shrink-0 rounded bg-paper-2 animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 w-40 max-w-full rounded bg-paper-2 animate-pulse" />
                    <div className="h-3 w-24 rounded bg-paper-2 animate-pulse" />
                  </div>
                  <div className="hidden sm:block h-6 w-16 rounded-md bg-paper-2 animate-pulse" />
                  <div className="h-6 w-10 rounded-md bg-paper-2 animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        ) : loadError ? (
          <div className="bg-card border border-sand rounded-2xl">
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-2xl bg-signal-50 flex items-center justify-center mb-4">
                <AlertCircle className="w-8 h-8 text-signal" />
              </div>
              <h3 className="font-display text-lg font-bold text-ink mb-1">Couldn&apos;t load your leads</h3>
              <p className="text-sm text-stone max-w-xs">
                Something went wrong while loading your pipeline. Check your connection and try again.
              </p>
              <button
                onClick={() => loadLeads()}
                className="mt-5 inline-flex items-center gap-2 bg-signal text-white text-sm font-semibold px-5 py-2.5 rounded-full hover:bg-signal-600 transition-all active:scale-95"
              >
                <RefreshCw className="w-4 h-4" />
                Retry
              </button>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-card border border-sand rounded-2xl">
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-2xl bg-signal-50 flex items-center justify-center mb-4">
                <BookmarkX className="w-8 h-8 text-signal" />
              </div>
              <h3 className="font-display text-lg font-bold text-ink mb-1">
                {leads.length === 0 ? 'No saved leads yet' : 'No leads match your filters'}
              </h3>
              <p className="text-sm text-stone max-w-xs">
                {leads.length === 0
                  ? 'Search for leads and save them to build your pipeline.'
                  : 'Try adjusting your filters or search query.'}
              </p>
              {leads.length === 0 && (
                <a
                  href="/search"
                  className="mt-5 inline-flex items-center gap-2 bg-signal text-white text-sm font-semibold px-5 py-2.5 rounded-full hover:bg-signal-600 transition-all active:scale-95"
                >
                  <Search className="w-4 h-4" />
                  Search for Leads
                </a>
              )}
            </div>
          </div>
        ) : view === 'board' ? (
          <div>
            {pipelineMigrationNeeded && isSupabaseConfigured && (
              <div className="mb-4 flex items-start gap-2.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl px-4 py-3">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <div className="text-sm">
                  <p className="font-semibold">Pipeline needs a one-time database migration</p>
                  <p className="text-xs mt-0.5 text-amber-700">
                    Run <span className="font-mono">supabase/migrations/20260812_pipeline.sql</span> in the Supabase SQL editor.
                    Until then, stage changes are kept on this device only.
                  </p>
                </div>
              </div>
            )}
            <PipelineBoard
              leads={filtered}
              onStageChange={handleStageChange}
              onGenerate={setProposalLead}
            />
          </div>
        ) : (
          <div className="bg-card border border-sand rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-sand bg-paper-2">
                    <th className="pl-4 pr-2 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="w-4 h-4 rounded border-sand accent-signal"
                      />
                    </th>
                    <th className="px-3 py-3 text-left readout font-semibold text-stone">Business</th>
                    <th className="px-3 py-3 text-left readout font-semibold text-stone">Category</th>
                    <th className="px-3 py-3 text-left readout font-semibold text-stone">Phone</th>
                    <th className="px-3 py-3 text-left readout font-semibold text-stone">Website</th>
                    <th className="px-3 py-3 text-left readout font-semibold text-stone">Score</th>
                    <th className="px-3 py-3 text-left readout font-semibold text-stone">Rating</th>
                    <th className="px-3 py-3 text-left readout font-semibold text-stone">Status</th>
                    <th className="px-3 py-3 text-left readout font-semibold text-stone">Notes</th>
                    <th className="px-3 py-3 text-left readout font-semibold text-stone">Saved</th>
                    <th className="px-3 py-3 pr-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((lead) => (
                    <LeadRow
                      key={lead.id}
                      lead={lead}
                      selected={selectedIds.has(lead.id)}
                      onSelect={handleSelect}
                      onStatusChange={handleStatusChange}
                      onNotesChange={handleNotesChange}
                      onDelete={handleDelete}
                      onGenerate={setProposalLead}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <ProposalModal lead={proposalLead} onClose={() => setProposalLead(null)} />
    </div>
  )
}
