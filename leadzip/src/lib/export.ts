import type { Lead } from '@/types/lead'
import { getWhiteLabel } from '@/lib/white-label'

function downloadCSV(headers: string[], rows: (string | number | null)[][], filename: string): void {
  const csvRows = rows.map((row) =>
    row.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')
  )
  const csv = [headers.map((h) => `"${h}"`).join(','), ...csvRows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function exportToCSV(leads: Lead[], filename: string): void {
  const headers = [
    'Business Name',
    'Category',
    'Address',
    'City',
    'State',
    'ZIP',
    'Phone',
    'Website',
    'Email',
    'Digital Health Score',
    'Rating',
    'Review Count',
    'Employees',
    'Revenue Estimate',
    'Facebook',
    'Instagram',
    'LinkedIn',
    'Lead Score',
    'Status',
    'Notes',
    'Date Saved',
  ]

  const rows = leads.map((l) => [
    l.businessName,
    l.category,
    l.address,
    l.city,
    l.state,
    l.zipCode,
    l.phone,
    l.website,
    l.email ?? '',
    l.digitalHealthScore ?? '',
    l.rating ?? '',
    l.reviewCount ?? '',
    l.employeeCount ?? '',
    l.revenueEstimate ?? '',
    l.facebookUrl ?? '',
    l.instagramUrl ?? '',
    l.linkedinUrl ?? '',
    l.leadScore,
    l.status,
    l.notes,
    l.savedAt ?? '',
  ])

  downloadCSV(headers, rows, filename)
}

export function exportToHubSpot(leads: Lead[]): void {
  const headers = ['First Name', 'Last Name', 'Company Name', 'Phone Number', 'Website URL', 'City', 'State/Region', 'Zip Code', 'Lead Status']
  const rows = leads.map((l) => {
    const parts = l.businessName.split(' ')
    return [parts[0] ?? '', parts.slice(1).join(' '), l.businessName, l.phone, l.website, l.city, l.state, l.zipCode, 'New']
  })
  downloadCSV(headers, rows, 'leadzip-hubspot-export.csv')
}

export function exportToSalesforce(leads: Lead[]): void {
  const headers = ['Last Name', 'Company', 'Phone', 'Website', 'City', 'State', 'PostalCode', 'LeadSource', 'Status', 'Rating']
  const rows = leads.map((l) => [
    l.businessName, l.businessName, l.phone, l.website, l.city, l.state, l.zipCode,
    'LeadZip', 'Open - Not Contacted',
    l.leadScore >= 80 ? 'Hot' : l.leadScore >= 50 ? 'Warm' : 'Cold',
  ])
  downloadCSV(headers, rows, 'leadzip-salesforce-export.csv')
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
    head: [['Business Name', 'Category', 'Phone', 'Website', 'Rating', 'Score', 'Status']],
    body: leads.map((l) => [
      l.businessName,
      l.category,
      l.phone || '—',
      l.website || '—',
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
      0: { cellWidth: 140 },
      1: { cellWidth: 90 },
      2: { cellWidth: 90 },
      3: { cellWidth: 110 },
      4: { cellWidth: 50, halign: 'center' },
      5: { cellWidth: 40, halign: 'center' },
      6: { cellWidth: 65, halign: 'center' },
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
