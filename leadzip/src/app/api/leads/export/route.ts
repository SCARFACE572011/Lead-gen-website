import { NextRequest, NextResponse } from 'next/server'
import type { Lead } from '@/types/lead'
import { buildLeadsCsv } from '@/lib/export'

export async function POST(request: NextRequest) {
  try {
    // Require an authenticated Supabase session
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: { leads?: Lead[]; fields?: string[] }
    try {
      body = (await request.json()) as { leads?: Lead[]; fields?: string[] }
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { leads, fields } = body

    if (!leads || leads.length === 0) {
      return NextResponse.json({ error: 'No leads to export' }, { status: 400 })
    }

    // Same field set (and formula-injection escaping) as the client exporter
    const csv = buildLeadsCsv(leads, fields)

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
