import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { requireActiveUser } from '@/lib/requireActiveUser'
import { PLAN_POLICY } from '@/lib/planPolicy'
import { resolveProductAccess } from '@/lib/productAccess'

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
  // Accepting an invite inherits the workspace owner's plan, so a deactivated
  // account must not be able to do it.
  const auth = await requireActiveUser(supabase)
  if (!auth.ok) return auth.response
  const { user } = auth

  const db = serviceClient()

  const { data: invite } = await db
    .from('workspace_invitations')
    .select('id, email, expires_at, accepted_at, workspace_id')
    .eq('token', token)
    .single()

  if (!invite) return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
  if (invite.accepted_at) return NextResponse.json({ error: 'Already accepted' }, { status: 410 })
  if (new Date(invite.expires_at) < new Date()) return NextResponse.json({ error: 'Invite expired' }, { status: 410 })

  // The accepting user MUST be the invitee: otherwise anyone holding the invite
  // link would be added to the workspace and inherit the owner's (agency) plan.
  const acceptingEmail = (user.email ?? '').trim().toLowerCase()
  const invitedEmail = (invite.email ?? '').trim().toLowerCase()
  if (!acceptingEmail || acceptingEmail !== invitedEmail) {
    return NextResponse.json(
      { error: 'This invite was sent to a different email address.' },
      { status: 403 }
    )
  }

  const { data: existingMember } = await db
    .from('workspace_members')
    .select('id')
    .eq('workspace_id', invite.workspace_id)
    .eq('user_id', user.id)
    .single()

  // Link workspace to profile + inherit plan from workspace owner
  const { data: workspace } = await db
    .from('workspaces')
    .select('owner_id')
    .eq('id', invite.workspace_id)
    .single()

  if (!workspace?.owner_id) {
    return NextResponse.json({ error: 'This workspace is no longer available.' }, { status: 410 })
  }

  const { data: ownerProfile } = await db
    .from('users_profile')
    .select('plan, role, status, workspace_id')
    .eq('id', workspace.owner_id)
    .maybeSingle()
  const ownerAccess = ownerProfile
    ? await resolveProductAccess(db, workspace.owner_id, ownerProfile)
    : null
  if (
    !ownerAccess ||
    (ownerAccess.role !== 'admin' &&
      (ownerAccess.plan !== 'agency' || ownerAccess.quotaSubjectUserId !== workspace.owner_id))
  ) {
    return NextResponse.json(
      { error: 'This workspace no longer has an active Agency plan.' },
      { status: 403 }
    )
  }

  const { count: memberCount } = await db
    .from('workspace_members')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', invite.workspace_id)
  if (!existingMember && (memberCount ?? 0) >= PLAN_POLICY.agency.teamSeats) {
    return NextResponse.json(
      { error: 'This workspace has reached its 5-seat limit.' },
      { status: 409 }
    )
  }

  if (!existingMember) {
    const { error: memberError } = await db.from('workspace_members').insert({
      workspace_id: invite.workspace_id,
      user_id: user.id,
      role: 'member',
    })
    if (memberError) {
      return NextResponse.json({ error: 'Could not join this workspace.' }, { status: 409 })
    }
  }

  const ownerPlan = 'agency'

  const { error: profileError } = await db.from('users_profile')
    .update({ workspace_id: invite.workspace_id, plan: ownerPlan })
    .eq('id', user.id)

  if (profileError) {
    if (!existingMember) {
      await db
        .from('workspace_members')
        .delete()
        .eq('workspace_id', invite.workspace_id)
        .eq('user_id', user.id)
    }
    return NextResponse.json({ error: 'Could not finish joining this workspace.' }, { status: 500 })
  }

  // Mark invitation accepted
  const { error: inviteError } = await db.from('workspace_invitations')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', invite.id)

  if (inviteError) {
    return NextResponse.json(
      { error: 'Workspace joined, but the invitation could not be finalized.' },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true, workspaceId: invite.workspace_id })
}
