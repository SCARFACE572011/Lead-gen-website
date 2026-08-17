import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { generateApiKey } from '@/lib/api-key'
import { requireActiveUser } from '@/lib/requireActiveUser'
import { getPlanPolicy } from '@/lib/planPolicy'
import { resolveProductAccess } from '@/lib/productAccess'

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// The session client verifies WHO is calling and that the account is still
// active; the service client above then acts on their own rows only.
async function getAuthedUser() {
  const supabase = await createServerClient()
  return requireActiveUser(supabase, { columns: ['plan', 'role', 'workspace_id'] })
}

export async function GET() {
  const auth = await getAuthedUser()
  if (!auth.ok) return auth.response
  const { user } = auth

  const { data, error } = await serviceClient()
    .from('api_keys')
    .select('id, name, key_prefix, created_at, last_used_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: 'Failed to fetch keys' }, { status: 500 })
  const access = await resolveProductAccess(serviceClient(), user.id, auth.profile)
  const plan = access?.plan ?? 'free'
  const role = access?.role ?? 'user'
  const policy = getPlanPolicy(plan, role)
  const canUseApi = role === 'admin' || plan === 'agency'
  return NextResponse.json({
    keys: data ?? [],
    canUseApi,
    plan,
    dailyLimit: canUseApi ? policy.apiRequestsPerDay : 0,
  })
}

export async function POST(request: NextRequest) {
  // An API key outlives the session that minted it and authenticates on its own,
  // so a deactivated account must never be able to issue one.
  const auth = await getAuthedUser()
  if (!auth.ok) return auth.response
  const { user } = auth

  const access = await resolveProductAccess(serviceClient(), user.id, auth.profile)
  if (!access || (access.role !== 'admin' && access.plan !== 'agency')) {
    return NextResponse.json(
      {
        error: 'API access is included with Agency.',
        upgradeRequired: true,
      },
      { status: 403 }
    )
  }

  const body = await request.json().catch(() => ({}))
  const name = (body.name as string)?.trim() || 'Default'

  const { raw, hash, prefix } = await generateApiKey()

  const { error } = await serviceClient()
    .from('api_keys')
    .insert({ user_id: user.id, name, key_hash: hash, key_prefix: prefix })

  if (error) return NextResponse.json({ error: 'Failed to create key' }, { status: 500 })

  return NextResponse.json({ key: raw, prefix, name }, { status: 201 })
}
