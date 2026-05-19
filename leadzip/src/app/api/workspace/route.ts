import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

function serviceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

async function getAuthedUser() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// GET — return the workspace the current user belongs to (as owner or member)
export async function GET() {
  const user = await getAuthedUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = serviceClient()

  // Check if owner
  const { data: ownedWorkspace } = await db
    .from('workspaces')
    .select('id, name, owner_id, created_at')
    .eq('owner_id', user.id)
    .single()

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

  // Check if member
  const { data: profile } = await db
    .from('users_profile')
    .select('workspace_id')
    .eq('id', user.id)
    .single()

  if (profile?.workspace_id) {
    const { data: workspace } = await db
      .from('workspaces')
      .select('id, name, owner_id, created_at')
      .eq('id', profile.workspace_id)
      .single()

    return NextResponse.json({ workspace, role: 'member', members: [], pendingInvites: [] })
  }

  return NextResponse.json({ workspace: null, role: null, members: [], pendingInvites: [] })
}

// POST — create a workspace (agency plan only)
export async function POST(request: NextRequest) {
  const user = await getAuthedUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = serviceClient()
  const { data: profile } = await db
    .from('users_profile')
    .select('plan')
    .eq('id', user.id)
    .single()

  if (profile?.plan !== 'agency') {
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

  // Add owner as a member
  await db.from('workspace_members').insert({ workspace_id: workspace.id, user_id: user.id, role: 'owner' })
  // Link profile
  await db.from('users_profile').update({ workspace_id: workspace.id }).eq('id', user.id)

  return NextResponse.json({ workspace }, { status: 201 })
}

// PATCH — rename workspace
export async function PATCH(request: NextRequest) {
  const user = await getAuthedUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
