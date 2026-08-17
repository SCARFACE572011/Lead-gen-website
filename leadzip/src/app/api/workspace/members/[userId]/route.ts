import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { requireActiveUser } from '@/lib/requireActiveUser'

function serviceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params
  const supabase = await createServerClient()
  const auth = await requireActiveUser(supabase)
  if (!auth.ok) return auth.response
  const { user } = auth

  const db = serviceClient()

  // Verify requester owns the workspace
  const { data: workspace } = await db
    .from('workspaces')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!workspace) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (userId === user.id) return NextResponse.json({ error: 'Cannot remove yourself' }, { status: 400 })

  const { error: membershipError } = await db
    .from('workspace_members')
    .delete()
    .eq('workspace_id', workspace.id)
    .eq('user_id', userId)
  if (membershipError) {
    return NextResponse.json({ error: 'Could not remove this workspace member.' }, { status: 500 })
  }
  // Scope to this workspace so an owner can only detach a member of their OWN
  // workspace — never null another tenant's user.
  const { data: ownSubscription } = await db
    .from('subscriptions')
    .select('plan')
    .eq('user_id', userId)
    .in('status', ['active', 'trialing'])
    .in('plan', ['pro', 'agency'])
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { error: profileError } = await db
    .from('users_profile')
    .update({
      workspace_id: null,
      // Invited members receive a copied Agency plan in the legacy model. On
      // removal restore only a subscription they personally pay for; otherwise
      // they return to Free instead of retaining Agency forever.
      plan: ownSubscription?.plan ?? 'free',
    })
    .eq('id', userId)
    .eq('workspace_id', workspace.id)

  if (profileError) {
    // The membership row is already gone, so dynamic entitlement resolution
    // fails safe even if this denormalized profile cleanup needs a retry.
    return NextResponse.json(
      { error: 'The member was removed, but profile cleanup needs to be retried.' },
      { status: 500 }
    )
  }

  return new NextResponse(null, { status: 204 })
}
