import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { requireActiveUser } from '@/lib/requireActiveUser'
import { resolveProductAccess } from '@/lib/productAccess'

function serviceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// The session client verifies WHO is calling and that the account is still
// active; the service client above then acts on their own workspace only.
async function getAuthedUser(columns?: readonly string[]) {
  const supabase = await createServerClient()
  return requireActiveUser(supabase, columns ? { columns } : undefined)
}

// GET — return the workspace the current user belongs to (as owner or member)
export async function GET() {
  const auth = await getAuthedUser()
  if (!auth.ok) return auth.response
  const { user } = auth

  const db = serviceClient()

  // Check if owner
  const { data: ownedWorkspace } = await db
    .from('workspaces')
    .select('id, name, owner_id, created_at')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (ownedWorkspace) {
    const { data: members } = await db
      .from('workspace_members')
      .select('user_id, role, joined_at, users_profile(email, full_name)')
      .eq('workspace_id', ownedWorkspace.id)
      .order('joined_at', { ascending: true })

    const { data: pendingInvites } = await db
      .from('workspace_invitations')
      .select('id, email, created_at, expires_at')
      .eq('workspace_id', ownedWorkspace.id)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })

    return NextResponse.json({
      workspace: ownedWorkspace,
      role: 'owner',
      members: members ?? [],
      pendingInvites: pendingInvites ?? [],
    })
  }

  // Check if member.
  //
  // Membership is read from workspace_members, which only the invite flow and
  // the owner can write, NOT from users_profile.workspace_id. That column is
  // still writable by the profile owner today (the trigger that locks it ships
  // in 20260815_product_allowances.sql, which is not applied yet), so trusting
  // it would let anyone point their profile at another agency's workspace and
  // read its name and owner. workspace_members has existed since 20260519, so
  // this is correct whether or not the newer migrations have run.
  const { data: membership, error: membershipError } = await db
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (membershipError) {
    console.error('[workspace] membership lookup failed:', membershipError.message)
    return NextResponse.json({ error: 'Could not load your workspace.' }, { status: 503 })
  }

  if (membership?.workspace_id) {
    const { data: workspace } = await db
      .from('workspaces')
      .select('id, name, owner_id, created_at')
      .eq('id', membership.workspace_id)
      .maybeSingle()

    // A membership row whose workspace was deleted is not a workspace.
    if (workspace) {
      return NextResponse.json({ workspace, role: 'member', members: [], pendingInvites: [] })
    }
  }

  return NextResponse.json({ workspace: null, role: null, members: [], pendingInvites: [] })
}

// POST — create a workspace (agency plan only)
export async function POST(request: NextRequest) {
  // One round trip covers the deactivated check and the agency-plan fence.
  const auth = await getAuthedUser(['plan', 'role', 'workspace_id'])
  if (!auth.ok) return auth.response
  const { user } = auth

  const db = serviceClient()

  const access = await resolveProductAccess(db, user.id, auth.profile)
  if (
    !access ||
    (access.role !== 'admin' &&
      (access.plan !== 'agency' || access.quotaSubjectUserId !== user.id))
  ) {
    return NextResponse.json({ error: 'Agency plan required to create a workspace' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const name = (body.name as string)?.trim()
  if (!name) return NextResponse.json({ error: 'Workspace name is required' }, { status: 422 })

  const { data: workspace, error } = await db
    .from('workspaces')
    .insert({ name, owner_id: user.id })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'You already have a workspace' }, { status: 409 })
    return NextResponse.json({ error: 'Failed to create workspace' }, { status: 500 })
  }

  // Complete setup as a unit from the caller's perspective. If either link
  // fails, remove the just-created workspace instead of leaving an orphaned
  // Agency workspace that cannot be managed correctly.
  const { error: memberError } = await db
    .from('workspace_members')
    .insert({ workspace_id: workspace.id, user_id: user.id, role: 'owner' })
  if (memberError) {
    await db.from('workspaces').delete().eq('id', workspace.id)
    return NextResponse.json({ error: 'Failed to finish workspace setup' }, { status: 500 })
  }

  const { data: linkedProfile, error: profileError } = await db
    .from('users_profile')
    .update({ workspace_id: workspace.id })
    .eq('id', user.id)
    .select('id')
    .maybeSingle()
  if (profileError || !linkedProfile) {
    await db.from('workspaces').delete().eq('id', workspace.id)
    return NextResponse.json({ error: 'Failed to finish workspace setup' }, { status: 500 })
  }

  return NextResponse.json({ workspace }, { status: 201 })
}

// PATCH — rename workspace
export async function PATCH(request: NextRequest) {
  const auth = await getAuthedUser()
  if (!auth.ok) return auth.response
  const { user } = auth

  const body = await request.json().catch(() => ({}))
  const name = (body.name as string)?.trim()
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 422 })

  const { error } = await serviceClient()
    .from('workspaces')
    .update({ name })
    .eq('owner_id', user.id)

  if (error) return NextResponse.json({ error: 'Failed to update workspace' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
