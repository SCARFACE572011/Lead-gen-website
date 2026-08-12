import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

function serviceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = serviceClient()

  // Verify requester owns the workspace
  const { data: workspace } = await db
    .from('workspaces')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!workspace) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (userId === user.id) return NextResponse.json({ error: 'Cannot remove yourself' }, { status: 400 })

  await db.from('workspace_members').delete().eq('workspace_id', workspace.id).eq('user_id', userId)
  // Scope to this workspace so an owner can only detach a member of their OWN
  // workspace — never null another tenant's user.
  await db
    .from('users_profile')
    .update({ workspace_id: null })
    .eq('id', userId)
    .eq('workspace_id', workspace.id)

  return new NextResponse(null, { status: 204 })
}
