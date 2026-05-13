import type { Lead } from '@/types/lead'

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
    'Rating',
    'Review Count',
    'Lead Score',
    'Status',
    'Notes',
    'Date Saved',
  ]

  const rows = leads.map((l) =>
    [
      l.businessName,
      l.category,
      l.address,
      l.city,
      l.state,
      l.zipCode,
      l.phone,
      l.website,
      l.rating ?? '',
      l.reviewCount ?? '',
      l.leadScore,
      l.status,
      l.notes,
      l.savedAt ?? '',
    ]
      .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
      .join(',')
  )

  const csv = [headers.join(','), ...rows].join('\n')
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
