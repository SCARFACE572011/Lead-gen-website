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

    // Plan fence: free/starter users can only export the first 25 rows. Paid
    // (pro/agency) and admins export everything. We cap rather than hard-error
    // so a free user still gets a usable file (preserves activation) while the
    // paywall is visibly enforced via a trailing note + response header.
    const { data: profile } = await supabase
      .from('users_profile')
      .select('plan, role')
      .eq('id', user.id)
      .maybeSingle()

    const plan = profile?.plan ?? 'free'
    const role = profile?.role ?? 'user'
    const isPaid = role === 'admin' || plan === 'pro' || plan === 'agency'

    const FREE_EXPORT_LIMIT = 25
    const totalRequested = leads.length
    const capped = !isPaid && totalRequested > FREE_EXPORT_LIMIT
    const exportLeads = capped ? leads.slice(0, FREE_EXPORT_LIMIT) : leads

    // Same field set (and formula-injection escaping) as the client exporter
    let csv = buildLeadsCsv(exportLeads, fields)

    const headers: Record<string, string> = {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="leadzip-export-${Date.now()}.csv"`,
    }

    if (capped) {
      const upgradeNote = `Upgrade to Pro to export all ${totalRequested} leads.`
      // Trailing CSV line (quoted as a single cell) + header so both the file
      // and the fetch response surface the paywall message.
      csv += `\n"${upgradeNote.replace(/"/g, '""')}"`
      headers['X-Export-Capped'] = 'true'
      headers['X-Export-Limit'] = String(FREE_EXPORT_LIMIT)
      headers['X-Export-Total'] = String(totalRequested)
      headers['X-Upgrade-Notice'] = upgradeNote
    }

    return new NextResponse(csv, { headers })
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json({ error: 'Export failed' }, { status: 500 })
  }
}
