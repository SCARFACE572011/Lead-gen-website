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
} from 'lucide-react'
import { Lead, LeadStatus, STATUS_LABELS, STATUS_COLORS } from '@/types/lead'
import { exportToCSV } from '@/lib/export'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

const STORAGE_KEY = 'leadzip_saved_leads'
const isSupabaseConfigured =
  process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder.supabase.co'

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
      ? 'bg-red-50 text-red-700 border-red-200'
      : score >= 50
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : 'bg-slate-50 text-slate-600 border-slate-200'
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border', color)}>
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
          <div className="absolute left-0 top-full mt-1 z-20 w-40 bg-white rounded-xl shadow-lg border border-slate-200 py-1 overflow-hidden">
            {statuses.map((s) => (
              <button
                key={s}
                className={cn(
                  'w-full text-left px-3 py-2 text-xs font-medium hover:bg-slate-50 transition-colors',
                  s === value && 'bg-slate-50'
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
}: {
  lead: Lead
  selected: boolean
  onSelect: (id: string, checked: boolean) => void
  onStatusChange: (id: string, status: LeadStatus) => void
  onNotesChange: (id: string, notes: string) => void
  onDelete: (id: string) => void
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
    <tr className={cn('border-b border-slate-100 hover:bg-slate-50/50 transition-colors', selected && 'bg-blue-50/40')}>
      <td className="pl-4 pr-2 py-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => onSelect(lead.id, e.target.checked)}
          className="w-4 h-4 rounded border-slate-300 text-[#0369A1] accent-[#0369A1]"
        />
      </td>
      <td className="px-3 py-3">
        <div className="font-semibold text-[#0F172A] text-sm leading-tight">{lead.businessName}</div>
        <div className="text-xs text-slate-400 mt-0.5">{lead.city}, {lead.state}</div>
      </td>
      <td className="px-3 py-3">
        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-md font-medium">
          {lead.category}
        </span>
      </td>
      <td className="px-3 py-3">
        {lead.phone ? (
          <a href={`tel:${lead.phone}`} className="inline-flex items-center gap-1 text-xs text-[#0369A1] hover:underline">
            <Phone className="w-3 h-3" />
            {lead.phone}
          </a>
        ) : (
          <span className="text-xs text-slate-300">—</span>
        )}
      </td>
      <td className="px-3 py-3">
        {lead.website ? (
          <a
            href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-[#0369A1] hover:underline max-w-[100px] truncate"
          >
            <Globe className="w-3 h-3 shrink-0" />
            <span className="truncate">{lead.website.replace(/^https?:\/\//, '')}</span>
          </a>
        ) : (
          <span className="text-xs text-slate-300">No website</span>
        )}
      </td>
      <td className="px-3 py-3">
        <ScoreBadge score={lead.leadScore} />
      </td>
      <td className="px-3 py-3">
        {lead.rating ? (
          <span className="inline-flex items-center gap-1 text-xs text-slate-600">
            <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
            {lead.rating}
          </span>
        ) : (
          <span className="text-xs text-slate-300">—</span>
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
              className="w-full text-xs border border-[#0369A1] rounded-lg px-2 py-1.5 resize-none focus:outline-none focus:ring-2 focus:ring-[#0369A1]/20"
              rows={2}
              autoFocus
            />
            <div className="flex gap-1">
              <button
                onClick={saveNotes}
                className="inline-flex items-center gap-0.5 text-xs bg-[#0369A1] text-white px-2 py-1 rounded-md hover:bg-[#0F172A] transition-colors"
              >
                <Check className="w-3 h-3" /> Save
              </button>
              <button
                onClick={cancelNotes}
                className="inline-flex items-center gap-0.5 text-xs border border-slate-200 text-slate-500 px-2 py-1 rounded-md hover:bg-slate-50 transition-colors"
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
            <span className="text-xs text-slate-500 leading-relaxed flex-1 min-h-[1.5rem]">
              {lead.notes || <span className="text-slate-300 italic">Add note…</span>}
            </span>
            <Pencil className="w-3 h-3 text-slate-300 group-hover:text-[#0369A1] shrink-0 mt-0.5 transition-colors" />
          </button>
        )}
      </td>
      <td className="px-3 py-3">
        <span className="text-xs text-slate-400">
          {lead.savedAt ? new Date(lead.savedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
        </span>
      </td>
      <td className="px-3 py-3 pr-4">
        <button
          onClick={() => onDelete(lead.id)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
          title="Delete lead"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </td>
    </tr>
  )
}

export default function SavedLeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('score')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)

    async function loadLeads() {
      if (isSupabaseConfigured) {
        try {
          const supabase = createClient()
          const {
            data: { user },
          } = await supabase.auth.getUser()

          if (user) {
            const { data } = await supabase
              .from('leads')
              .select('*')
              .eq('user_id', user.id)
              .order('created_at', { ascending: false })

            if (data && data.length > 0) {
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
                  savedAt: l.created_at,
                }))
              )
              return
            }
          }
        } catch {
          // Non-fatal — fall back to localStorage
        }
      }

      // Fallback: load from localStorage
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        try {
          setLeads(JSON.parse(raw))
        } catch {
          setLeads([])
        }
      }
    }

    loadLeads()
  }, [])

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

  const handleDelete = (id: string) => {
    saveToStorage(leads.filter((l) => l.id !== id))
    setSelectedIds((prev) => { const s = new Set(prev); s.delete(id); return s })
  }

  const handleBulkDelete = () => {
    saveToStorage(leads.filter((l) => !selectedIds.has(l.id)))
    setSelectedIds(new Set())
  }

  const handleSelect = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const s = new Set(prev)
      checked ? s.add(id) : s.delete(id)
      return s
    })
  }

  const handleSelectAll = (checked: boolean) => {
    setSelectedIds(checked ? new Set(filtered.map((l) => l.id)) : new Set())
  }

  const handleExportAll = () => {
    exportToCSV(leads, `leadzip-saved-${Date.now()}`)
  }

  const handleExportSelected = () => {
    const sel = leads.filter((l) => selectedIds.has(l.id))
    exportToCSV(sel, `leadzip-selected-${Date.now()}`)
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
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="max-w-[1400px] mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-2xl font-bold text-[#0F172A]">Saved Leads</h1>
              <p className="text-sm text-slate-500 mt-0.5">Manage and track your prospect pipeline</p>
            </div>
            <span className="bg-[#0369A1] text-white text-sm font-semibold px-3 py-1 rounded-full">
              {leads.length}
            </span>
          </div>
          <button
            onClick={handleExportAll}
            disabled={leads.length === 0}
            className="inline-flex items-center gap-2 bg-[#0F172A] text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-[#1e293b] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            Export All
          </button>
        </div>

        {someSelected && (
          <div className="mb-4 flex items-center gap-3 bg-[#0369A1] text-white px-4 py-3 rounded-xl">
            <span className="text-sm font-medium">{selectedIds.size} lead{selectedIds.size !== 1 ? 's' : ''} selected</span>
            <div className="flex-1" />
            <button
              onClick={handleExportSelected}
              className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              Export Selected
            </button>
            <button
              onClick={handleBulkDelete}
              className="inline-flex items-center gap-2 bg-red-500/80 hover:bg-red-500 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete Selected
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="p-1 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 mb-4 flex flex-wrap gap-3 items-center shadow-sm">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search leads…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0369A1]/20 focus:border-[#0369A1]"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0369A1]/20 focus:border-[#0369A1] bg-white text-slate-700"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <SortAsc className="w-4 h-4 text-slate-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0369A1]/20 focus:border-[#0369A1] bg-white text-slate-700"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>Sort: {o.label}</option>
              ))}
            </select>
          </div>
          <span className="text-xs text-slate-400 ml-auto">
            {filtered.length} of {leads.length} leads
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                <BookmarkX className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-[#0F172A] mb-1">
                {leads.length === 0 ? 'No saved leads yet' : 'No leads match your filters'}
              </h3>
              <p className="text-sm text-slate-500 max-w-xs">
                {leads.length === 0
                  ? 'Search for leads and save them to build your pipeline.'
                  : 'Try adjusting your filters or search query.'}
              </p>
              {leads.length === 0 && (
                <a
                  href="/search"
                  className="mt-5 inline-flex items-center gap-2 bg-[#0369A1] text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-[#0F172A] transition-colors"
                >
                  <Search className="w-4 h-4" />
                  Search for Leads
                </a>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="pl-4 pr-2 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 accent-[#0369A1]"
                      />
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Business</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Category</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Phone</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Website</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Score</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Rating</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Notes</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Saved</th>
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
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
