import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

function serviceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// GET — public: get invite info (workspace name, inviter, expiry)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const db = serviceClient()

  const { data: invite } = await db
    .from('workspace_invitations')
    .select('id, email, expires_at, accepted_at, workspace_id, workspaces(name, owner_id)')
    .eq('token', token)
    .single()

  if (!invite) return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
  if (invite.accepted_at) return NextResponse.json({ error: 'Invite already accepted' }, { status: 410 })
  if (new Date(invite.expires_at) < new Date()) return NextResponse.json({ error: 'Invite expired' }, { status: 410 })

  return NextResponse.json({
    email: invite.email,
    workspace: invite.workspaces,
    expiresAt: invite.expires_at,
  })
}

// POST — authed: accept invite
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = serviceClient()

  const { data: invite } = await db
    .from('workspace_invitations')
    .select('id, email, expires_at, accepted_at, workspace_id')
    .eq('token', token)
    .single()

  if (!invite) return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
  if (invite.accepted_at) return NextResponse.json({ error: 'Already accepted' }, { status: 410 })
  if (new Date(invite.expires_at) < new Date()) return NextResponse.json({ error: 'Invite expired' }, { status: 410 })

  // Check user email matches invite (soft check — allow any authed user to accept)
  const { data: existingMember } = await db
    .from('workspace_members')
    .select('id')
    .eq('workspace_id', invite.workspace_id)
    .eq('user_id', user.id)
    .single()

  if (!existingMember) {
    await db.from('workspace_members').insert({
      workspace_id: invite.workspace_id,
      user_id: user.id,
      role: 'member',
    })
  }

  // Link workspace to profile + inherit plan from workspace owner
  const { data: workspace } = await db
    .from('workspaces')
    .select('owner_id')
    .eq('id', invite.workspace_id)
    .single()

  let ownerPlan = 'agency'
  if (workspace?.owner_id) {
    const { data: ownerProfile } = await db
      .from('users_profile')
      .select('plan')
      .eq('id', workspace.owner_id)
      .single()
    if (ownerProfile?.plan) ownerPlan = ownerProfile.plan
  }

  await db.from('users_profile')
    .update({ workspace_id: invite.workspace_id, plan: ownerPlan })
    .eq('id', user.id)

  // Mark invitation accepted
  await db.from('workspace_invitations')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', invite.id)

  return NextResponse.json({ ok: true, workspaceId: invite.workspace_id })
}
