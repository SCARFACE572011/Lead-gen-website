import type { Lead } from '@/types/lead'
import { getWhiteLabel } from '@/lib/white-label'

export interface LeadExportField {
  key: string
  label: string
  value: (l: Lead) => string | number
}

// Single source of truth for exportable lead columns — shared by the exports
// page field picker, the client-side CSV downloads, and /api/leads/export so
// the column sets never drift.
export const LEAD_EXPORT_FIELDS: LeadExportField[] = [
  { key: 'businessName', label: 'Business Name', value: (l) => l.businessName },
  { key: 'category', label: 'Category', value: (l) => l.category },
  { key: 'address', label: 'Address', value: (l) => l.address },
  { key: 'city', label: 'City', value: (l) => l.city },
  { key: 'state', label: 'State', value: (l) => l.state },
  { key: 'zipCode', label: 'ZIP', value: (l) => l.zipCode },
  { key: 'phone', label: 'Phone', value: (l) => l.phone },
  { key: 'website', label: 'Website', value: (l) => l.website },
  { key: 'email', label: 'Email', value: (l) => l.email ?? '' },
  { key: 'emailConfidence', label: 'Email Confidence', value: (l) => l.emailConfidence ?? '' },
  { key: 'digitalHealthScore', label: 'Digital Health Score', value: (l) => l.digitalHealthScore ?? '' },
  { key: 'rating', label: 'Rating', value: (l) => l.rating ?? '' },
  { key: 'reviewCount', label: 'Review Count', value: (l) => l.reviewCount ?? '' },
  { key: 'employeeCount', label: 'Employees', value: (l) => l.employeeCount ?? '' },
  { key: 'revenueEstimate', label: 'Revenue Estimate', value: (l) => l.revenueEstimate ?? '' },
  { key: 'facebookUrl', label: 'Facebook', value: (l) => l.facebookUrl ?? '' },
  { key: 'instagramUrl', label: 'Instagram', value: (l) => l.instagramUrl ?? '' },
  { key: 'linkedinUrl', label: 'LinkedIn', value: (l) => l.linkedinUrl ?? '' },
  { key: 'leadScore', label: 'Lead Score', value: (l) => l.leadScore },
  { key: 'status', label: 'Status', value: (l) => l.status },
  { key: 'notes', label: 'Notes', value: (l) => l.notes },
  { key: 'savedAt', label: 'Date Saved', value: (l) => l.savedAt ?? '' },
]

// Quote a CSV cell and neutralize spreadsheet formula injection (OWASP):
// values starting with =, +, -, @, tab, or CR are prefixed with a single quote
// so Excel/Sheets treat them as text instead of executing them as formulas.
function csvCell(v: string | number | null): string {
  let s = String(v ?? '')
  if (/^[=+\-@\t\r]/.test(s)) {
    s = `'${s}`
  }
  return `"${s.replace(/"/g, '""')}"`
}

function toCsv(headers: string[], rows: (string | number | null)[][]): string {
  return [headers.map(csvCell).join(','), ...rows.map((row) => row.map(csvCell).join(','))].join('\n')
}

export function buildLeadsCsv(leads: Lead[], fieldKeys?: string[]): string {
  const selected = fieldKeys && fieldKeys.length > 0
    ? LEAD_EXPORT_FIELDS.filter((f) => fieldKeys.includes(f.key))
    : LEAD_EXPORT_FIELDS
  const fields = selected.length > 0 ? selected : LEAD_EXPORT_FIELDS
  return toCsv(
    fields.map((f) => f.label),
    leads.map((l) => fields.map((f) => f.value(l)))
  )
}

function downloadCSV(csv: string, filename: string, bom = false): void {
  // \uFEFF is the UTF-8 byte-order mark — required for Excel to detect UTF-8
  const blob = new Blob([bom ? `\uFEFF${csv}` : csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export interface ExportCsvOptions {
  /** Field keys (from LEAD_EXPORT_FIELDS) to include; defaults to all fields */
  fields?: string[]
  /** Prepend a UTF-8 BOM so Excel opens the file with correct encoding */
  bom?: boolean
}

export function exportToCSV(leads: Lead[], filename: string, options?: ExportCsvOptions): void {
  downloadCSV(buildLeadsCsv(leads, options?.fields), filename, options?.bom ?? false)
}

export function exportToHubSpot(leads: Lead[]): void {
  const headers = ['First Name', 'Last Name', 'Company Name', 'Phone Number', 'Website URL', 'Email', 'City', 'State/Region', 'Zip Code', 'Lead Status']
  const rows = leads.map((l) => {
    const parts = l.businessName.split(' ')
    return [parts[0] ?? '', parts.slice(1).join(' '), l.businessName, l.phone, l.website, l.email ?? '', l.city, l.state, l.zipCode, 'New']
  })
  downloadCSV(toCsv(headers, rows), 'leadzip-hubspot-export.csv')
}

export function exportToSalesforce(leads: Lead[]): void {
  const headers = ['Last Name', 'Company', 'Phone', 'Website', 'Email', 'City', 'State', 'PostalCode', 'LeadSource', 'Status', 'Rating']
  const rows = leads.map((l) => [
    l.businessName, l.businessName, l.phone, l.website, l.email ?? '', l.city, l.state, l.zipCode,
    'LeadZip', 'Open - Not Contacted',
    l.leadScore >= 80 ? 'Hot' : l.leadScore >= 50 ? 'Warm' : 'Cold',
  ])
  downloadCSV(toCsv(headers, rows), 'leadzip-salesforce-export.csv')
}

export async function exportToBrandedPDF(leads: Lead[], reportTitle?: string): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const wl = getWhiteLabel()
  const agencyName = wl.agencyName || 'Lead Report'
  const accent = wl.accentColor || '#0369A1'
  const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  // Parse hex accent to RGB
  const r = parseInt(accent.slice(1, 3), 16)
  const g = parseInt(accent.slice(3, 5), 16)
  const b = parseInt(accent.slice(5, 7), 16)

  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()

  // ── Header ────────────────────────────────────────────────────────────────
  let headerX = 40
  if (wl.logoDataUrl) {
    try {
      doc.addImage(wl.logoDataUrl, 'PNG', 40, 20, 36, 36)
      headerX = 86
    } catch { /* skip logo if invalid */ }
  }

  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(r, g, b)
  doc.text(agencyName, headerX, 36)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(120, 120, 120)
  doc.text(reportTitle ?? `Lead Report — ${dateStr}`, headerX, 50)

  // lead count top-right
  doc.setFontSize(9)
  doc.text(`${leads.length} lead${leads.length !== 1 ? 's' : ''}`, pageW - 40, 36, { align: 'right' })
  doc.text(dateStr, pageW - 40, 50, { align: 'right' })

  // divider
  doc.setDrawColor(r, g, b)
  doc.setLineWidth(1.5)
  doc.line(40, 58, pageW - 40, 58)

  // ── Table ─────────────────────────────────────────────────────────────────
  autoTable(doc, {
    startY: 68,
    head: [['Business Name', 'Category', 'Phone', 'Website', 'Email', 'Rating', 'Score', 'Status']],
    body: leads.map((l) => [
      l.businessName,
      l.category,
      l.phone || '—',
      l.website || '—',
      l.email || '—',
      l.rating != null ? `${l.rating} ★` : '—',
      String(l.leadScore),
      l.status,
    ]),
    headStyles: {
      fillColor: [r, g, b],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    bodyStyles: { fontSize: 8, textColor: [30, 30, 30] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 130 },
      1: { cellWidth: 80 },
      2: { cellWidth: 85 },
      3: { cellWidth: 105 },
      4: { cellWidth: 110 },
      5: { cellWidth: 50, halign: 'center' },
      6: { cellWidth: 40, halign: 'center' },
      7: { cellWidth: 65, halign: 'center' },
    },
    margin: { left: 40, right: 40 },
  })

  // ── Footer ────────────────────────────────────────────────────────────────
  const pageCount = (doc.internal as unknown as { getNumberOfPages: () => number }).getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    const pageH = doc.internal.pageSize.getHeight()
    doc.setFontSize(7)
    doc.setTextColor(180, 180, 180)
    doc.text(`Page ${i} of ${pageCount}`, pageW - 40, pageH - 12, { align: 'right' })
    if (!wl.agencyName) {
      doc.text('Generated by LeadZip', 40, pageH - 12)
    }
  }

  const filename = `${agencyName.replace(/\s+/g, '-').toLowerCase()}-leads-${new Date().toISOString().slice(0, 10)}.pdf`
  doc.save(filename)
}
