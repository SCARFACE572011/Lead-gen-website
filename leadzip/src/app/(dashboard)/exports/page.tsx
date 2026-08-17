'use client'

import { useState, useEffect } from 'react'
import {
  Download,
  FileText,
  CheckSquare,
  Clock,
  FileDown,
  Package,
  Eye,
  Star,
  Phone,
  Globe,
  FileImage,
} from 'lucide-react'
import { toast } from 'sonner'
import { Lead } from '@/types/lead'
import { exportToBrandedPDF, LEAD_EXPORT_FIELDS } from '@/lib/export'
import { exportReturnedLeadsCsv } from '@/lib/leadBulkActions'
import { cn } from '@/lib/utils'

const STORAGE_KEY = 'leadzip_saved_leads'
const EXPORT_HISTORY_KEY = 'leadzip_export_history'

type FormatKey = 'csv' | 'excel_csv' | 'branded_pdf'

interface ExportRecord {
  id: string
  filename: string
  leadCount: number
  format: string
  // Machine-readable format + the exact leads captured at export time, so
  // "Download again" re-exports the right rows in the right format instead of
  // guessing from the current saved list.
  formatKey?: FormatKey
  leadIds?: string[]
  fields: string[]
  createdAt: string
}

// Shared with the CSV/PDF exporters so the picker and output never drift
const ALL_FIELDS = LEAD_EXPORT_FIELDS

type TabId = 'export' | 'history'

function newExportFilename(): string {
  return `leadzip-export-${Date.now()}`
}

function newExportRecord(data: Omit<ExportRecord, 'id' | 'createdAt'>): ExportRecord {
  return {
    ...data,
    id: `exp-${Date.now()}`,
    createdAt: new Date().toISOString(),
  }
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function ExportsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('export')
  const [leads, setLeads] = useState<Lead[]>([])
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set())
  const [selectedFields, setSelectedFields] = useState<Set<string>>(
    new Set(ALL_FIELDS.map((f) => f.key))
  )
  const [format, setFormat] = useState<FormatKey>('csv')
  const [exportHistory, setExportHistory] = useState<ExportRecord[]>([])
  const [mounted, setMounted] = useState(false)
  const [userPlan, setUserPlan] = useState<'free' | 'pro' | 'agency'>('free')

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      try { setLeads(JSON.parse(raw)) } catch { /* noop */ }
    }
    const histRaw = localStorage.getItem(EXPORT_HISTORY_KEY)
    if (histRaw) {
      try { setExportHistory(JSON.parse(histRaw)) } catch { /* noop */ }
    }

    fetch('/api/usage', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (data?.plan === 'pro' || data?.plan === 'agency') setUserPlan(data.plan)
      })
      .catch(() => {})
  }, [])

  const toggleLeadSelect = (id: string) => {
    setSelectedLeadIds((prev) => {
      const s = new Set(prev)
      if (s.has(id)) { s.delete(id) } else { s.add(id) }
      return s
    })
  }

  const toggleField = (key: string) => {
    setSelectedFields((prev) => {
      const s = new Set(prev)
      if (s.has(key)) { s.delete(key) } else { s.add(key) }
      return s
    })
  }

  const handleSelectAllLeads = (checked: boolean) => {
    setSelectedLeadIds(checked ? new Set(leads.map((l) => l.id)) : new Set())
  }

  const handleSelectAllFields = (checked: boolean) => {
    setSelectedFields(checked ? new Set(ALL_FIELDS.map((f) => f.key)) : new Set())
  }

  const selectedLeads = leads.filter((l) => selectedLeadIds.has(l.id))
  const previewLeads = selectedLeads.slice(0, 5)
  const isPaid = userPlan === 'pro' || userPlan === 'agency'

  const handleExport = async () => {
    if (selectedLeads.length === 0) return
    const filename = newExportFilename()
    const leadIds = selectedLeads.map((l) => l.id)

    try {
      if (format === 'branded_pdf') {
        if (!isPaid) {
          toast.info('Branded PDF export is included with Pro and Agency.')
          return
        }
        await exportToBrandedPDF(selectedLeads)
        const record = newExportRecord({
          filename: `${filename}.pdf`,
          leadCount: selectedLeads.length,
          format: 'Branded PDF',
          formatKey: 'branded_pdf',
          leadIds,
          fields: ['All fields'],
        })
        const updated = [record, ...exportHistory]
        setExportHistory(updated)
        localStorage.setItem(EXPORT_HISTORY_KEY, JSON.stringify(updated))
        toast.success(`Exported ${selectedLeads.length} lead${selectedLeads.length !== 1 ? 's' : ''} as Branded PDF`)
        return
      }

      const exportResult = await exportReturnedLeadsCsv(selectedLeads, {
        filename,
        fields: Array.from(selectedFields),
        bom: format === 'excel_csv',
      })

      // Record export
      const record = newExportRecord({
        filename: `${filename}.csv`,
        leadCount: exportResult.exportedCount,
        format: format === 'excel_csv' ? 'Excel CSV' : 'CSV',
        formatKey: format,
        leadIds: leadIds.slice(0, exportResult.exportedCount),
        fields: Array.from(selectedFields),
      })
      const updated = [record, ...exportHistory]
      setExportHistory(updated)
      localStorage.setItem(EXPORT_HISTORY_KEY, JSON.stringify(updated))
      toast.success(`Exported ${exportResult.exportedCount} lead${exportResult.exportedCount !== 1 ? 's' : ''}`)
      if (exportResult.planCapped && exportResult.upgradeNotice) {
        toast.info(exportResult.upgradeNotice)
      }
    } catch {
      toast.error('Export failed — please try again')
    }
  }

  const handleDownloadAgain = async (record: ExportRecord) => {
    // Re-export exactly the leads captured at export time. Fall back to the
    // legacy "first N saved" behavior only for old records saved before we
    // persisted lead IDs.
    const relevantLeads = record.leadIds && record.leadIds.length > 0
      ? record.leadIds
          .map((id) => leads.find((l) => l.id === id))
          .filter((l): l is Lead => Boolean(l))
      : leads.slice(0, record.leadCount)

    if (relevantLeads.length === 0) {
      toast.error('Those leads are no longer in your saved list')
      return
    }

    // Derive the format for old records that predate formatKey
    const formatKey: FormatKey = record.formatKey
      ?? (record.format === 'Excel CSV'
        ? 'excel_csv'
        : record.format === 'Branded PDF'
          ? 'branded_pdf'
          : 'csv')

    try {
      if (formatKey === 'branded_pdf') {
        if (!isPaid) {
          toast.info('Branded PDF export is included with Pro and Agency.')
          return
        }
        await exportToBrandedPDF(relevantLeads)
        toast.success('Re-exported Branded PDF')
        return
      }

      const validKeys = new Set(ALL_FIELDS.map((f) => f.key))
      const fields = record.fields.filter((f) => validKeys.has(f))
      const exportResult = await exportReturnedLeadsCsv(relevantLeads, {
        filename: record.filename,
        fields: fields.length > 0 ? fields : undefined,
        bom: formatKey === 'excel_csv',
      })
      toast.success(`Re-exported ${exportResult.exportedCount} lead${exportResult.exportedCount !== 1 ? 's' : ''}`)
      if (exportResult.planCapped && exportResult.upgradeNotice) {
        toast.info(exportResult.upgradeNotice)
      }
    } catch {
      toast.error('Export failed — please try again')
    }
  }

  if (!mounted) return null

  return (
    <div className="min-h-screen bg-paper">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-6">
          <span className="readout text-signal">Export</span>
          <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-ink">Export Leads</h1>
          <p className="text-sm text-ink-soft mt-1.5">Download your leads in CSV format for outreach tools and CRMs</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-paper-2 border border-sand p-1 rounded-full mb-6 w-fit">
          {([['export', 'Export Now'], ['history', 'Export History']] as [TabId, string][]).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                'px-4 py-2 rounded-full text-sm font-semibold transition-all',
                activeTab === id
                  ? 'bg-card text-ink shadow-sm'
                  : 'text-stone hover:text-ink'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {activeTab === 'export' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Lead Selection */}
            <div className="lg:col-span-2 space-y-4">
              {/* Lead selection card */}
              <div className="bg-card border border-sand rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-sand flex items-center justify-between">
                  <h2 className="font-display text-sm font-bold text-ink flex items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-signal" />
                    Select Leads
                  </h2>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-stone"><span className="font-mono">{selectedLeadIds.size}</span> of <span className="font-mono">{leads.length}</span> selected</span>
                    <button
                      onClick={() => handleSelectAllLeads(selectedLeadIds.size !== leads.length)}
                      className="text-xs text-signal hover:text-signal-600 font-semibold"
                    >
                      {selectedLeadIds.size === leads.length ? 'Deselect all' : 'Select all'}
                    </button>
                  </div>
                </div>

                {leads.length === 0 ? (
                  <div className="py-12 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-signal-50 flex items-center justify-center mx-auto mb-3">
                      <Package className="w-7 h-7 text-signal" />
                    </div>
                    <p className="text-sm text-stone">No saved leads yet.</p>
                    <a href="/search" className="text-xs text-signal hover:text-signal-600 font-semibold mt-1 inline-block">
                      Search for leads →
                    </a>
                  </div>
                ) : (
                  <div className="max-h-80 overflow-y-auto divide-y divide-sand">
                    {leads.map((lead) => (
                      <label
                        key={lead.id}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-signal-50/50 cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={selectedLeadIds.has(lead.id)}
                          onChange={() => toggleLeadSelect(lead.id)}
                          className="w-4 h-4 rounded border-sand accent-signal"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-ink truncate">{lead.businessName}</div>
                          <div className="text-xs text-stone">{lead.category} · {lead.city}, {lead.state}</div>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-stone shrink-0">
                          {lead.phone && <Phone className="w-3 h-3" />}
                          {lead.website && <Globe className="w-3 h-3" />}
                          {lead.rating && (
                            <span className="flex items-center gap-0.5 font-mono">
                              <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                              {lead.rating}
                            </span>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Preview */}
              {selectedLeads.length > 0 && (
                <div className="bg-card border border-sand rounded-2xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-sand flex items-center gap-2">
                    <Eye className="w-4 h-4 text-signal" />
                    <h2 className="font-display text-sm font-bold text-ink">
                      Preview — First {Math.min(5, selectedLeads.length)} rows
                    </h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-paper-2 border-b border-sand">
                          {Array.from(selectedFields).slice(0, 6).map((f) => (
                            <th key={f} className="px-3 py-2 text-left readout font-semibold text-stone">
                              {ALL_FIELDS.find((af) => af.key === f)?.label ?? f}
                            </th>
                          ))}
                          {selectedFields.size > 6 && (
                            <th className="px-3 py-2 readout text-stone">+{selectedFields.size - 6} more</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {previewLeads.map((lead) => (
                          <tr key={lead.id} className="border-b border-sand hover:bg-signal-50/50">
                            {Array.from(selectedFields).slice(0, 6).map((f) => (
                              <td key={f} className="px-3 py-2 text-ink-soft max-w-[120px] truncate">
                                {String((lead as unknown as Record<string, unknown>)[f] ?? '')}
                              </td>
                            ))}
                            {selectedFields.size > 6 && <td className="px-3 py-2 text-stone/50">…</td>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Right: Options */}
            <div className="space-y-4">
              {/* Format */}
              <div className="bg-card border border-sand rounded-2xl p-4">
                <h2 className="font-display text-sm font-bold text-ink mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-signal" />
                  Export Format
                </h2>
                <div className="space-y-2">
                  {[
                    { value: 'csv', label: 'Standard CSV', desc: 'Compatible with all tools', paidOnly: false },
                    { value: 'excel_csv', label: 'Excel-ready CSV', desc: 'UTF-8 BOM for Excel', paidOnly: false },
                    { value: 'branded_pdf', label: 'Branded PDF', desc: 'Agency logo, colors, and name — configure in Settings → White Label', icon: <FileImage className="w-3.5 h-3.5 text-signal" />, paidOnly: true },
                  ].map((f) => (
                    <label
                      key={f.value}
                      className={cn(
                        'flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all',
                        f.paidOnly && !isPaid && 'cursor-not-allowed opacity-60',
                        format === f.value
                          ? 'border-signal bg-signal-50'
                          : 'border-sand hover:border-stone/40'
                      )}
                    >
                      <input
                        type="radio"
                        name="format"
                        value={f.value}
                        checked={format === f.value}
                        disabled={f.paidOnly && !isPaid}
                        onChange={() => setFormat(f.value as FormatKey)}
                        className="mt-0.5 accent-signal"
                      />
                      <div>
                        <div className="text-sm font-semibold text-ink flex items-center gap-1.5">
                          {f.label}
                          {'icon' in f && f.icon}
                          {f.paidOnly && !isPaid && (
                            <span className="rounded-full bg-signal-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-signal">Paid</span>
                          )}
                        </div>
                        <div className="text-xs text-stone">{f.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Fields — the Branded PDF uses a fixed, designed column set, so
                  the field picker only applies to CSV formats */}
              {format === 'branded_pdf' ? (
                <div className="bg-card border border-sand rounded-2xl p-4">
                  <h2 className="font-display text-sm font-bold text-ink flex items-center gap-2 mb-2">
                    <CheckSquare className="w-4 h-4 text-signal" />
                    Fields to Include
                  </h2>
                  <p className="text-xs text-stone">
                    Branded PDF uses a fixed, print-ready layout: Business, Category, Phone, Website, Email, Rating, Score, and Status. Choose a CSV format to pick your own columns.
                  </p>
                </div>
              ) : (
                <div className="bg-card border border-sand rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="font-display text-sm font-bold text-ink flex items-center gap-2">
                      <CheckSquare className="w-4 h-4 text-signal" />
                      Fields to Include
                    </h2>
                    <button
                      onClick={() => handleSelectAllFields(selectedFields.size !== ALL_FIELDS.length)}
                      className="text-xs text-signal hover:text-signal-600 font-semibold"
                    >
                      {selectedFields.size === ALL_FIELDS.length ? 'Deselect all' : 'Select all'}
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {ALL_FIELDS.map((f) => (
                      <label
                        key={f.key}
                        className="flex items-center gap-2.5 py-1 cursor-pointer group"
                      >
                        <input
                          type="checkbox"
                          checked={selectedFields.has(f.key)}
                          onChange={() => toggleField(f.key)}
                          className="w-4 h-4 rounded border-sand accent-signal"
                        />
                        <span className="text-sm text-ink-soft group-hover:text-ink transition-colors">
                          {f.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Export Button */}
              <button
                onClick={handleExport}
                disabled={selectedLeads.length === 0 || (format !== 'branded_pdf' && selectedFields.size === 0)}
                className="w-full inline-flex items-center justify-center gap-2 bg-signal text-white text-sm font-semibold px-4 py-3 rounded-full hover:bg-signal-600 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
              >
                <Download className="w-4 h-4" />
                Export {selectedLeads.length > 0 ? `${selectedLeads.length} Lead${selectedLeads.length !== 1 ? 's' : ''}` : 'Leads'}
              </button>

              {selectedLeads.length === 0 ? (
                <p className="text-xs text-stone text-center">Select at least one lead to export</p>
              ) : format !== 'branded_pdf' && selectedFields.size === 0 ? (
                <p className="text-xs text-stone text-center">Select at least one field to export</p>
              ) : null}
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="bg-card border border-sand rounded-2xl overflow-hidden">
            {exportHistory.length === 0 ? (
              <div className="py-16 text-center">
                <div className="w-14 h-14 rounded-2xl bg-signal-50 flex items-center justify-center mx-auto mb-3">
                  <FileDown className="w-7 h-7 text-signal" />
                </div>
                <h3 className="font-display text-base font-bold text-ink mb-1">No exports yet</h3>
                <p className="text-sm text-stone">Your export history will appear here.</p>
                <button
                  onClick={() => setActiveTab('export')}
                  className="mt-4 text-sm text-signal hover:text-signal-600 font-semibold"
                >
                  Export your first leads →
                </button>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-sand bg-paper-2">
                        <th className="px-4 py-3 text-left readout font-semibold text-stone">Filename</th>
                        <th className="px-4 py-3 text-left readout font-semibold text-stone">Date</th>
                        <th className="px-4 py-3 text-left readout font-semibold text-stone">Leads</th>
                        <th className="px-4 py-3 text-left readout font-semibold text-stone">Format</th>
                        <th className="px-4 py-3 text-left readout font-semibold text-stone">Fields</th>
                        <th className="px-4 py-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {exportHistory.map((record) => (
                        <tr key={record.id} className="border-b border-sand hover:bg-signal-50/50 transition-colors">
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg bg-forest flex items-center justify-center">
                                <FileText className="w-4 h-4 text-lime" />
                              </div>
                              <span className="text-sm font-medium text-ink truncate max-w-[200px]">
                                {record.filename}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-1.5 text-xs text-stone">
                              <Clock className="w-3 h-3" />
                              {formatDate(record.createdAt)}
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="text-sm font-mono font-semibold text-ink">{record.leadCount}</span>
                            <span className="text-xs text-stone ml-1">leads</span>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="text-xs bg-paper-2 text-ink-soft px-2 py-1 rounded-md font-medium border border-sand">
                              {record.format}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="text-xs text-stone"><span className="font-mono">{record.fields.length}</span> fields</span>
                          </td>
                          <td className="px-4 py-3.5 pr-4">
                            <button
                              onClick={() => handleDownloadAgain(record)}
                              className="inline-flex items-center gap-1.5 text-xs font-semibold border border-signal text-signal px-3 py-1.5 rounded-full hover:bg-signal hover:text-white transition-all"
                            >
                              <Download className="w-3 h-3" />
                              Download
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-4 py-3 border-t border-sand bg-paper-2">
                  <span className="text-xs text-stone"><span className="font-mono">{exportHistory.length}</span> export{exportHistory.length !== 1 ? 's' : ''} total</span>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
