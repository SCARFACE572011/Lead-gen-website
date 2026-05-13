import { NextRequest, NextResponse } from 'next/server'
import type { Lead } from '@/types/lead'

export async function POST(request: NextRequest) {
  try {
    const { leads } = (await request.json()) as { leads: Lead[] }

    if (!leads || leads.length === 0) {
      return NextResponse.json({ error: 'No leads to export' }, { status: 400 })
    }

    // Generate CSV content server-side
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

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="leadzip-export-${Date.now()}.csv"`,
      },
    })
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json({ error: 'Export failed' }, { status: 500 })
  }
}
