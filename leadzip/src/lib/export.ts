import type { Lead } from '@/types/lead'

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
