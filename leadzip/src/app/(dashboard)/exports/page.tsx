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
import { Lead } from '@/types/lead'
import { exportToCSV, exportToBrandedPDF } from '@/lib/export'
import { cn } from '@/lib/utils'

const STORAGE_KEY = 'leadzip_saved_leads'
const EXPORT_HISTORY_KEY = 'leadzip_export_history'

interface ExportRecord {
  id: string
  filename: string
  leadCount: number
  format: string
  fields: string[]
  createdAt: string
}

const ALL_FIELDS = [
  { key: 'businessName', label: 'Business Name' },
  { key: 'category', label: 'Category' },
  { key: 'address', label: 'Address' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'zipCode', label: 'ZIP Code' },
  { key: 'phone', label: 'Phone' },
  { key: 'website', label: 'Website' },
  { key: 'rating', label: 'Rating' },
  { key: 'reviewCount', label: 'Review Count' },
  { key: 'leadScore', label: 'Lead Score' },
  { key: 'status', label: 'Status' },
  { key: 'notes', label: 'Notes' },
  { key: 'savedAt', label: 'Date Saved' },
]

type TabId = 'export' | 'history'

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
  const [format, setFormat] = useState<'csv' | 'excel_csv' | 'branded_pdf'>('csv')
  const [exportHistory, setExportHistory] = useState<ExportRecord[]>([])
  const [mounted, setMounted] = useState(false)

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

  const handleExport = async () => {
    if (selectedLeads.length === 0) return
    // eslint-disable-next-line react-hooks/purity
    const filename = `leadzip-export-${Date.now()}`

    if (format === 'branded_pdf') {
      await exportToBrandedPDF(selectedLeads)
      const record: ExportRecord = {
        id: `exp-${Date.now()}`,
        filename: `${filename}.pdf`,
        leadCount: selectedLeads.length,
        format: 'Branded PDF',
        fields: ['All fields'],
        createdAt: new Date().toISOString(),
      }
      const updated = [record, ...exportHistory]
      setExportHistory(updated)
      localStorage.setItem(EXPORT_HISTORY_KEY, JSON.stringify(updated))
      return
    }

    // Filter fields for CSV
    const filteredLeads = selectedLeads.map((lead) => {
      const filtered: Partial<Lead> = {}
      for (const key of selectedFields) {
        ; (filtered as unknown as Record<string, unknown>)[key] = (lead as unknown as Record<string, unknown>)[key]
      }
      return filtered as Lead
    })
    exportToCSV(filteredLeads, filename)

    // Record export
    const record: ExportRecord = {
      // eslint-disable-next-line react-hooks/purity
      id: `exp-${Date.now()}`,
      filename: `${filename}.csv`,
      leadCount: selectedLeads.length,
      format: format === 'excel_csv' ? 'Excel CSV' : 'CSV',
      fields: Array.from(selectedFields),
      createdAt: new Date().toISOString(),
    }
    const updated = [record, ...exportHistory]
    setExportHistory(updated)
    localStorage.setItem(EXPORT_HISTORY_KEY, JSON.stringify(updated))
  }

  const handleDownloadAgain = (record: ExportRecord) => {
    const relevantLeads = leads.slice(0, record.leadCount)
    exportToCSV(relevantLeads, record.filename)
  }

  if (!mounted) return null

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#0F172A]">Export Leads</h1>
          <p className="text-sm text-slate-500 mt-0.5">Download your leads in CSV format for outreach tools and CRMs</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-6 w-fit">
          {([['export', 'Export Now'], ['history', 'Export History']] as [TabId, string][]).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                activeTab === id
                  ? 'bg-white text-[#0F172A] shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
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
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-[#0F172A] flex items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-[#0369A1]" />
                    Select Leads
                  </h2>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500">{selectedLeadIds.size} of {leads.length} selected</span>
                    <button
                      onClick={() => handleSelectAllLeads(selectedLeadIds.size !== leads.length)}
                      className="text-xs text-[#0369A1] hover:underline font-medium"
                    >
                      {selectedLeadIds.size === leads.length ? 'Deselect all' : 'Select all'}
                    </button>
                  </div>
                </div>

                {leads.length === 0 ? (
                  <div className="py-12 text-center">
                    <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                    <p className="text-sm text-slate-500">No saved leads yet.</p>
                    <a href="/search" className="text-xs text-[#0369A1] hover:underline mt-1 inline-block">
                      Search for leads →
                    </a>
                  </div>
                ) : (
                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-50">
                    {leads.map((lead) => (
                      <label
                        key={lead.id}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={selectedLeadIds.has(lead.id)}
                          onChange={() => toggleLeadSelect(lead.id)}
                          className="w-4 h-4 rounded border-slate-300 accent-[#0369A1]"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-[#0F172A] truncate">{lead.businessName}</div>
                          <div className="text-xs text-slate-400">{lead.category} · {lead.city}, {lead.state}</div>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-400 shrink-0">
                          {lead.phone && <Phone className="w-3 h-3" />}
                          {lead.website && <Globe className="w-3 h-3" />}
                          {lead.rating && (
                            <span className="flex items-center gap-0.5">
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
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                    <Eye className="w-4 h-4 text-[#0369A1]" />
                    <h2 className="text-sm font-semibold text-[#0F172A]">
                      Preview — First {Math.min(5, selectedLeads.length)} rows
                    </h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                          {Array.from(selectedFields).slice(0, 6).map((f) => (
                            <th key={f} className="px-3 py-2 text-left font-semibold text-slate-500 uppercase tracking-wide">
                              {ALL_FIELDS.find((af) => af.key === f)?.label ?? f}
                            </th>
                          ))}
                          {selectedFields.size > 6 && (
                            <th className="px-3 py-2 text-slate-400">+{selectedFields.size - 6} more</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {previewLeads.map((lead) => (
                          <tr key={lead.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                            {Array.from(selectedFields).slice(0, 6).map((f) => (
                              <td key={f} className="px-3 py-2 text-slate-600 max-w-[120px] truncate">
                                {String((lead as unknown as Record<string, unknown>)[f] ?? '')}
                              </td>
                            ))}
                            {selectedFields.size > 6 && <td className="px-3 py-2 text-slate-300">…</td>}
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
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
                <h2 className="text-sm font-semibold text-[#0F172A] mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#0369A1]" />
                  Export Format
                </h2>
                <div className="space-y-2">
                  {[
                    { value: 'csv', label: 'Standard CSV', desc: 'Compatible with all tools' },
                    { value: 'excel_csv', label: 'Excel-ready CSV', desc: 'UTF-8 BOM for Excel' },
                    { value: 'branded_pdf', label: 'Branded PDF', desc: 'Agency logo, colors, and name — configure in Settings → White Label', icon: <FileImage className="w-3.5 h-3.5 text-[#0369A1]" /> },
                  ].map((f) => (
                    <label
                      key={f.value}
                      className={cn(
                        'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all',
                        format === f.value
                          ? 'border-[#0369A1] bg-[#0369A1]/5'
                          : 'border-slate-200 hover:border-slate-300'
                      )}
                    >
                      <input
                        type="radio"
                        name="format"
                        value={f.value}
                        checked={format === f.value}
                        onChange={() => setFormat(f.value as 'csv' | 'excel_csv' | 'branded_pdf')}
                        className="mt-0.5 accent-[#0369A1]"
                      />
                      <div>
                        <div className="text-sm font-medium text-[#0F172A] flex items-center gap-1.5">
                          {f.label}
                          {'icon' in f && f.icon}
                        </div>
                        <div className="text-xs text-slate-500">{f.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Fields */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-[#0F172A] flex items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-[#0369A1]" />
                    Fields to Include
                  </h2>
                  <button
                    onClick={() => handleSelectAllFields(selectedFields.size !== ALL_FIELDS.length)}
                    className="text-xs text-[#0369A1] hover:underline font-medium"
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
                        className="w-4 h-4 rounded border-slate-300 accent-[#0369A1]"
                      />
                      <span className="text-sm text-slate-600 group-hover:text-slate-900 transition-colors">
                        {f.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Export Button */}
              <button
                onClick={handleExport}
                disabled={selectedLeads.length === 0 || selectedFields.size === 0}
                className="w-full inline-flex items-center justify-center gap-2 bg-[#0369A1] text-white text-sm font-semibold px-4 py-3 rounded-xl hover:bg-[#0F172A] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Download className="w-4 h-4" />
                Export {selectedLeads.length > 0 ? `${selectedLeads.length} Lead${selectedLeads.length !== 1 ? 's' : ''}` : 'Leads'}
              </button>

              {selectedLeads.length === 0 && (
                <p className="text-xs text-slate-400 text-center">Select at least one lead to export</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            {exportHistory.length === 0 ? (
              <div className="py-16 text-center">
                <FileDown className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <h3 className="text-base font-semibold text-[#0F172A] mb-1">No exports yet</h3>
                <p className="text-sm text-slate-500">Your export history will appear here.</p>
                <button
                  onClick={() => setActiveTab('export')}
                  className="mt-4 text-sm text-[#0369A1] hover:underline font-medium"
                >
                  Export your first leads →
                </button>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50">
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Filename</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Leads</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Format</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Fields</th>
                        <th className="px-4 py-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {exportHistory.map((record) => (
                        <tr key={record.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                                <FileText className="w-4 h-4 text-emerald-600" />
                              </div>
                              <span className="text-sm font-medium text-[#0F172A] truncate max-w-[200px]">
                                {record.filename}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-1.5 text-xs text-slate-500">
                              <Clock className="w-3 h-3" />
                              {formatDate(record.createdAt)}
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="text-sm font-semibold text-[#0F172A]">{record.leadCount}</span>
                            <span className="text-xs text-slate-400 ml-1">leads</span>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-md font-medium">
                              {record.format}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="text-xs text-slate-500">{record.fields.length} fields</span>
                          </td>
                          <td className="px-4 py-3.5 pr-4">
                            <button
                              onClick={() => handleDownloadAgain(record)}
                              className="inline-flex items-center gap-1.5 text-xs font-medium border border-[#0369A1] text-[#0369A1] px-3 py-1.5 rounded-lg hover:bg-[#0369A1] hover:text-white transition-all"
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
                <div className="px-4 py-3 border-t border-slate-100 bg-slate-50">
                  <span className="text-xs text-slate-400">{exportHistory.length} export{exportHistory.length !== 1 ? 's' : ''} total</span>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
