import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { exportToHubSpot } from '@/lib/crm/hubspot'
import { exportToGoHighLevel } from '@/lib/crm/gohighlevel'
import { exportToPipedrive } from '@/lib/crm/pipedrive'
import type { CrmLead } from '@/lib/crm/types'
import { requireActiveUser } from '@/lib/requireActiveUser'
import { getLeadEntitlements } from '@/lib/leadEntitlements'
import { resolveProductAccess } from '@/lib/productAccess'

const VALID_CRMS = new Set(['hubspot', 'gohighlevel', 'pipedrive'])

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ crm: string }> }
) {
  const { crm } = await params
  if (!VALID_CRMS.has(crm)) {
    return NextResponse.json({ error: 'Unknown CRM' }, { status: 422 })
  }

  const supabase = await createServerClient()
  // Pushes rows into a third-party CRM over the network, so a deactivated
  // session must not reach it.
  const auth = await requireActiveUser(supabase, { columns: ['plan', 'role', 'workspace_id'] })
  if (!auth.ok) return auth.response
  const { user } = auth

  const db = serviceClient()
  const access = await resolveProductAccess(db, user.id, auth.profile)
  if (!access || !getLeadEntitlements(access.plan, access.role).canExportAll) {
    return NextResponse.json(
      { error: 'CRM export is available on Pro and Agency.', upgradeRequired: true },
      { status: 403 }
    )
  }

  const body = await request.json().catch(() => ({}))
  const leads: CrmLead[] = body.leads ?? []

  if (!Array.isArray(leads) || leads.length === 0) {
    return NextResponse.json({ error: 'leads array is required' }, { status: 422 })
  }
  if (leads.length > 100) {
    return NextResponse.json({ error: 'Max 100 leads per export' }, { status: 422 })
  }

  // Fetch the stored API key
  const { data: integration, error: intErr } = await db
    .from('crm_integrations')
    .select('api_key')
    .eq('user_id', user.id)
    .eq('crm_type', crm)
    .single()

  if (intErr || !integration) {
    return NextResponse.json({ error: `No ${crm} integration connected` }, { status: 404 })
  }

  try {
    let result
    if (crm === 'hubspot') result = await exportToHubSpot(integration.api_key, leads)
    else if (crm === 'gohighlevel') result = await exportToGoHighLevel(integration.api_key, leads)
    else if (crm === 'pipedrive') result = await exportToPipedrive(integration.api_key, leads)
    else return NextResponse.json({ error: 'Unknown CRM' }, { status: 422 })

    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: 'Export failed — check your CRM connection' }, { status: 502 })
  }
}
