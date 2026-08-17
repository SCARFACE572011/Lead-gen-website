import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { requireActiveUser } from '@/lib/requireActiveUser'
import { validateHubSpotKey } from '@/lib/crm/hubspot'
import { validateGoHighLevelKey } from '@/lib/crm/gohighlevel'
import { validatePipedriveKey } from '@/lib/crm/pipedrive'
import { getLeadEntitlements } from '@/lib/leadEntitlements'
import { getPlanPolicy } from '@/lib/planPolicy'
import { resolveProductAccess } from '@/lib/productAccess'

type CrmType = 'hubspot' | 'gohighlevel' | 'pipedrive'

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// The session client verifies WHO is calling and that the account is still
// active; the service client above then acts on their own rows only.
async function getAuthedUser(columns: readonly string[] = []) {
  const supabase = await createServerClient()
  return requireActiveUser(supabase, { columns })
}

export async function GET() {
  const auth = await getAuthedUser(['plan', 'role', 'workspace_id'])
  if (!auth.ok) return auth.response
  const { user } = auth

  const db = serviceClient()
  const access = await resolveProductAccess(db, user.id, auth.profile)
  if (!access || !getLeadEntitlements(access.plan, access.role).canExportAll) {
    return NextResponse.json(
      { error: 'CRM integrations are available on Pro and Agency.', upgradeRequired: true },
      { status: 403 }
    )
  }

  const { data, error } = await db
    .from('crm_integrations')
    .select('id, crm_type, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: 'Failed to fetch integrations' }, { status: 500 })
  return NextResponse.json({
    integrations: data ?? [],
    limit: access.role === 'admin' ? null : getPlanPolicy(access.plan).crmConnections,
  })
}

export async function POST(request: NextRequest) {
  // Validating a key makes an outbound call to the CRM, so a deactivated
  // session must not reach it.
  const auth = await getAuthedUser(['plan', 'role', 'workspace_id'])
  if (!auth.ok) return auth.response
  const { user } = auth

  const db = serviceClient()
  const access = await resolveProductAccess(db, user.id, auth.profile)
  if (!access || !getLeadEntitlements(access.plan, access.role).canExportAll) {
    return NextResponse.json(
      { error: 'CRM integrations are available on Pro and Agency.', upgradeRequired: true },
      { status: 403 }
    )
  }

  const body = await request.json().catch(() => ({}))
  const crm_type = body.crm_type as CrmType
  const api_key = (body.api_key as string)?.trim()

  if (!crm_type || !['hubspot', 'gohighlevel', 'pipedrive'].includes(crm_type)) {
    return NextResponse.json({ error: 'Invalid crm_type' }, { status: 422 })
  }
  if (!api_key) {
    return NextResponse.json({ error: 'api_key is required' }, { status: 422 })
  }

  const connectionLimit = access.role === 'admin'
    ? null
    : getPlanPolicy(access.plan).crmConnections
  const { data: existingConnections } = await db
    .from('crm_integrations')
    .select('crm_type')
    .eq('user_id', user.id)
  const alreadyConnected = (existingConnections ?? []).some(
    (connection) => connection.crm_type === crm_type
  )
  if (
    connectionLimit !== null &&
    !alreadyConnected &&
    (existingConnections?.length ?? 0) >= connectionLimit
  ) {
    return NextResponse.json(
      {
        error: `${access.plan === 'pro' ? 'Pro' : 'Agency'} includes ${connectionLimit} CRM connection${connectionLimit === 1 ? '' : 's'}.`,
        limitReached: true,
        limit: connectionLimit,
        upgradeRequired: access.plan === 'pro',
      },
      { status: 409 }
    )
  }

  // Validate key against the CRM
  let valid = false
  try {
    if (crm_type === 'hubspot') valid = await validateHubSpotKey(api_key)
    else if (crm_type === 'gohighlevel') valid = await validateGoHighLevelKey(api_key)
    else if (crm_type === 'pipedrive') valid = await validatePipedriveKey(api_key)
  } catch {
    return NextResponse.json({ error: 'Could not reach CRM to validate key' }, { status: 502 })
  }

  if (!valid) {
    return NextResponse.json({ error: 'API key is invalid or lacks required permissions' }, { status: 422 })
  }

  const { error } = await db
    .from('crm_integrations')
    .upsert({ user_id: user.id, crm_type, api_key }, { onConflict: 'user_id,crm_type' })

  if (error?.code === '23514') {
    return NextResponse.json(
      { error: error.message, limitReached: true },
      { status: 409 }
    )
  }
  if (error) return NextResponse.json({ error: 'Failed to save integration' }, { status: 500 })
  return NextResponse.json({ ok: true }, { status: 201 })
}
